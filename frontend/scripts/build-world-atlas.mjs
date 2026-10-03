/*
  Builds the vendored world atlas (public/geo/countries-{50m,110m}.json)
  from Natural Earth, with the United Kingdom drawn as its four countries.

  Why not world-atlas@2 any more (2026-10-03): world-atlas is built from
  Natural Earth's admin-0 COUNTRIES, where the UK is one polygon. Natural
  Earth's admin-0 MAP UNITS split it into England, Scotland, Wales and
  Northern Ireland. Every other country is grouped back into a single
  feature here (France, Belgium, Portugal... each have several map units),
  so the rest of the world is exactly what world-atlas ships, built with
  the same pipeline: quantize 1e5, spherical simplify 1e-7, drop detached
  rings under that weight, land = merge of all countries.

  Also emits backend/src/geo/uk-map-units.data.ts: the four 50m polygons
  the backend uses to decide which country a UK airport or city is in.

  Usage (from frontend/):  node scripts/build-world-atlas.mjs
  Source is pinned to one Natural Earth commit so the build is reproducible.
*/
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { topology } from 'topojson-server';
import { mergeArcs, quantize } from 'topojson-client';
import {
  presimplify,
  simplify,
  filter,
  filterAttachedWeight,
  sphericalTriangleArea,
  sphericalRingArea,
} from 'topojson-simplify';

const NE_COMMIT = 'ca96624a56bd078437bca8184e78163e5039ad19'; // v5.1.1
const NE_BASE = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${NE_COMMIT}/geojson/`;
const QUANTIZATION = 1e5;
const MIN_WEIGHT = 1e-7;

const here = dirname(fileURLToPath(import.meta.url));
const frontendRoot = join(here, '..');
const geoDir = join(frontendRoot, 'public', 'geo');
const backendDataFile = join(frontendRoot, '..', 'backend', 'src', 'geo', 'uk-map-units.data.ts');
const cacheDir = join(tmpdir(), `natural-earth-${NE_COMMIT.slice(0, 8)}`);

/** The UK's map units: Natural Earth unit code -> how the app names it. */
const UK_UNITS = {
  ENG: { name: 'England', iso2: 'GB-ENG' },
  SCT: { name: 'Scotland', iso2: 'GB-SCT' },
  WLS: { name: 'Wales', iso2: 'GB-WLS' },
  NIR: { name: 'Northern Ireland', iso2: 'GB-NIR' },
};

async function fetchCached(file) {
  mkdirSync(cacheDir, { recursive: true });
  const local = join(cacheDir, file);
  if (!existsSync(local)) {
    process.stdout.write(`  downloading ${file}... `);
    const response = await fetch(NE_BASE + file);
    if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
    writeFileSync(local, Buffer.from(await response.arrayBuffer()));
    process.stdout.write('ok\n');
  }
  return JSON.parse(readFileSync(local, 'utf8'));
}

/** world-atlas ids: ISO 3166-1 numeric as a 3-digit string, or none. */
function numericId(props) {
  const id = props.ISO_N3_EH;
  return /^\d{3}$/.test(id) ? id : undefined;
}

async function buildTier(resolution) {
  console.log(`${resolution}:`);
  const units = await fetchCached(`ne_${resolution}_admin_0_map_units.geojson`);
  const countries = await fetchCached(`ne_${resolution}_admin_0_countries.geojson`);
  const countryByAdm0 = new Map(countries.features.map((f) => [f.properties.ADM0_A3, f.properties]));

  // One topology over every unit, so shared borders become shared arcs.
  const unitGeometries = units.features.map((f) => ({
    type: 'Feature',
    properties: { adm0: f.properties.ADM0_A3, unit: f.properties.GU_A3 },
    geometry: f.geometry,
  }));
  const topo = topology({ units: { type: 'FeatureCollection', features: unitGeometries } }, QUANTIZATION);

  // Group units back into countries - except the UK, which stays split.
  const groups = new Map();
  for (const geometry of topo.objects.units.geometries) {
    const { adm0, unit } = geometry.properties;
    const key = adm0 === 'GBR' ? `GBR:${unit}` : adm0;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(geometry);
  }

  const features = [];
  for (const [key, members] of groups) {
    const geometry = members.length === 1
      ? { type: members[0].type, arcs: members[0].arcs }
      : mergeArcs(topo, members);
    if (key.startsWith('GBR:')) {
      const unit = UK_UNITS[key.slice(4)];
      if (!unit) throw new Error(`Unexpected UK map unit ${key}`);
      features.push({ ...geometry, properties: { name: unit.name } });
      continue;
    }
    const props = countryByAdm0.get(key);
    if (!props) throw new Error(`No admin-0 country for ${key}`);
    const id = numericId(props);
    features.push({ ...geometry, ...(id ? { id } : {}), properties: { name: props.NAME } });
  }
  // Deterministic order: the same input always yields the same file.
  features.sort((a, b) => (a.id ?? '').localeCompare(b.id ?? '') || a.properties.name.localeCompare(b.properties.name));

  topo.objects.countries = { type: 'GeometryCollection', geometries: features };
  delete topo.objects.units;

  // world-atlas: toposimplify -f -s 1e-7 (spherical), then land = merge.
  let simplified = presimplify(topo, sphericalTriangleArea);
  simplified = simplify(simplified, MIN_WEIGHT);
  simplified = filter(simplified, filterAttachedWeight(simplified, MIN_WEIGHT, sphericalRingArea));
  simplified.objects.land = {
    type: 'GeometryCollection',
    geometries: [mergeArcs(simplified, simplified.objects.countries.geometries)],
  };
  // Simplifying de-quantizes the arcs; the CLI re-quantizes on the way out
  // and so do we - delta-encoded integers are what keeps the file small.
  simplified = quantize(simplified, topo.transform);

  // Validate before writing: the whole point is the four UK countries.
  const names = new Set(simplified.objects.countries.geometries.map((g) => g.properties.name));
  for (const unit of Object.values(UK_UNITS)) {
    if (!names.has(unit.name)) throw new Error(`${resolution}: missing ${unit.name}`);
  }
  if (names.has('United Kingdom')) throw new Error(`${resolution}: United Kingdom still present`);
  if (simplified.objects.countries.geometries.some((g) => g.id === '826')) {
    throw new Error(`${resolution}: feature 826 still present`);
  }

  const out = join(geoDir, `countries-${resolution}.json`);
  const json = JSON.stringify(simplified);
  writeFileSync(out, json);
  console.log(`  ${simplified.objects.countries.geometries.length} countries, ${simplified.arcs.length} arcs, ${(json.length / 1024).toFixed(0)} KB -> ${out}`);
  return units;
}

/** The raw 50m UK unit polygons for the backend's point-in-polygon. */
function writeBackendData(units50m) {
  const round = (n) => Math.round(n * 1e4) / 1e4;
  const entries = [];
  for (const f of units50m.features) {
    if (f.properties.ADM0_A3 !== 'GBR') continue;
    const unit = UK_UNITS[f.properties.GU_A3];
    if (!unit) continue;
    const polygons = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    const rounded = polygons.map((poly) => poly.map((ring) => ring.map(([lon, lat]) => [round(lon), round(lat)])));
    entries.push(`  '${unit.iso2}': ${JSON.stringify(rounded)},`);
  }
  if (entries.length !== 4) throw new Error(`Expected 4 UK units, got ${entries.length}`);
  mkdirSync(dirname(backendDataFile), { recursive: true });
  writeFileSync(
    backendDataFile,
    `/* eslint-disable */
// GENERATED by frontend/scripts/build-world-atlas.mjs - do not edit.
// Natural Earth 50m admin-0 map units, commit ${NE_COMMIT.slice(0, 8)}.
// MultiPolygon coordinates ([lon, lat] rings) per UK country.
export const UK_MAP_UNITS: Record<string, number[][][][]> = {
${entries.join('\n')}
};
`,
  );
  console.log(`  UK polygons -> ${backendDataFile}`);
}

const units50m = await buildTier('50m');
await buildTier('110m');
writeBackendData(units50m);
