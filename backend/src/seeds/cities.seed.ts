import { inflateRawSync } from 'zlib';
import { DataSource } from 'typeorm';
import { City } from '../modules/cities/entities/city.entity';

/**
 * Cities for land travel (2026-08-17): GeoNames cities1000 - every place
 * on earth with population over 1,000, ~130k rows (CC-BY 4.0,
 * geonames.org). Same vendored-open-data pattern as airports: one
 * seed-time download, no runtime calls to anyone.
 *
 * cities1000 over cities15000 by owner decision: the small towns people
 * actually drive to (Bansko, Sozopol) sit under the 15k population line.
 */
const CITIES_ZIP_URL = 'https://download.geonames.org/export/dump/cities1000.zip';

/*
  GeoNames only distributes this file zipped. Rather than adding a zip
  dependency for one seed, this reads the one-entry archive directly:
  find the End Of Central Directory record, walk to the entry, inflate.
  Handles exactly what GeoNames produces - a single deflate or stored
  entry - and refuses anything else loudly.
*/
function unzipSingleEntry(zip: Buffer): Buffer {
  // EOCD signature 0x06054b50, scanned from the tail (comment may follow).
  let eocd = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65558); i--) {
    if (zip.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Not a zip: no end-of-central-directory');
  const cdOffset = zip.readUInt32LE(eocd + 16);

  if (zip.readUInt32LE(cdOffset) !== 0x02014b50) {
    throw new Error('Not a zip: central directory signature missing');
  }
  const method = zip.readUInt16LE(cdOffset + 10);
  const compressedSize = zip.readUInt32LE(cdOffset + 20);
  const localOffset = zip.readUInt32LE(cdOffset + 42);

  // Local header: 30 fixed bytes + name + extra, then the data. Name and
  // extra lengths must come from the LOCAL header - they can differ from
  // the central directory's.
  if (zip.readUInt32LE(localOffset) !== 0x04034b50) {
    throw new Error('Not a zip: local header signature missing');
  }
  const nameLen = zip.readUInt16LE(localOffset + 26);
  const extraLen = zip.readUInt16LE(localOffset + 28);
  const dataStart = localOffset + 30 + nameLen + extraLen;
  const data = zip.subarray(dataStart, dataStart + compressedSize);

  if (method === 0) return Buffer.from(data);
  if (method === 8) return inflateRawSync(data);
  throw new Error(`Unsupported zip compression method ${method}`);
}

export async function seedCities(dataSource: DataSource): Promise<void> {
  const cityRepository = dataSource.getRepository(City);

  const existingCount = await cityRepository.count();
  if (existingCount > 0) {
    console.log('Cities already seeded. Skipping...');
    return;
  }

  console.log('Downloading GeoNames cities1000...');
  const response = await fetch(CITIES_ZIP_URL);
  if (!response.ok) {
    throw new Error(`GeoNames download failed: ${response.status}`);
  }
  const zip = Buffer.from(await response.arrayBuffer());
  const tsv = unzipSingleEntry(zip).toString('utf8');

  /*
    GeoNames TSV columns (readme.txt): 0 geonameid, 1 name, 2 asciiname,
    3 alternatenames, 4 latitude, 5 longitude, 6 feature class,
    7 feature code, 8 country code, ..., 14 population.
  */
  const cities: Partial<City>[] = [];
  for (const line of tsv.split('\n')) {
    if (!line) continue;
    const cols = line.split('\t');
    if (cols.length < 15 || cols[6] !== 'P') continue;
    const latitude = Number(cols[4]);
    const longitude = Number(cols[5]);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    if (!cols[8] || cols[8].length !== 2) continue;
    cities.push({
      geonamesId: Number(cols[0]),
      name: cols[1].slice(0, 200),
      asciiName: (cols[2] || cols[1]).slice(0, 200),
      countryIso: cols[8],
      latitude,
      longitude,
      population: Number(cols[14]) || 0,
    });
  }

  console.log(`Seeding ${cities.length} cities...`);
  // Chunked: a single 130k-row save exhausts the parameter limit.
  const CHUNK = 1000;
  for (let i = 0; i < cities.length; i += CHUNK) {
    await cityRepository
      .createQueryBuilder()
      .insert()
      .values(cities.slice(i, i + CHUNK))
      .orIgnore()
      .execute();
  }
  console.log(`Seeded ${cities.length} cities.`);
}
