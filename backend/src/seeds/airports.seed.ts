import { DataSource } from 'typeorm';
import { Airport } from '../modules/airports/entities/airport.entity';

const AIRPORTS_CSV_URL =
  'https://raw.githubusercontent.com/datasets/airport-codes/master/data/airport-codes.csv';

interface RawAirport {
  ident: string;
  type: string;
  name: string;
  elevation_ft: string;
  continent: string;
  iso_country: string;
  iso_region: string;
  municipality: string;
  icao_code: string;
  iata_code: string;
  gps_code: string;
  local_code: string;
  coordinates: string;
}

function parseCSV(csvText: string): RawAirport[] {
  const lines = csvText.split('\n');
  const headers = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''));

  return lines.slice(1).map((line) => {
    // Handle quoted fields with commas inside
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const obj: Record<string, string> = {};
    headers.forEach((header, index) => {
      obj[header] = values[index] || '';
    });

    return obj as unknown as RawAirport;
  });
}

function parseCoordinates(coordString: string): { lat: number; lon: number } | null {
  if (!coordString) return null;

  // Format: "latitude, longitude"
  const parts = coordString.split(',').map((p) => parseFloat(p.trim()));
  if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) {
    return null;
  }

  return { lat: parts[0], lon: parts[1] };
}

// Map of ISO country codes to full names
const countryNames: Record<string, string> = {
  AF: 'Afghanistan', AL: 'Albania', DZ: 'Algeria', AD: 'Andorra', AO: 'Angola',
  AG: 'Antigua and Barbuda', AR: 'Argentina', AM: 'Armenia', AU: 'Australia',
  AT: 'Austria', AZ: 'Azerbaijan', BS: 'Bahamas', BH: 'Bahrain', BD: 'Bangladesh',
  BB: 'Barbados', BY: 'Belarus', BE: 'Belgium', BZ: 'Belize', BJ: 'Benin',
  BT: 'Bhutan', BO: 'Bolivia', BA: 'Bosnia and Herzegovina', BW: 'Botswana',
  BR: 'Brazil', BN: 'Brunei', BG: 'Bulgaria', BF: 'Burkina Faso', BI: 'Burundi',
  CV: 'Cabo Verde', KH: 'Cambodia', CM: 'Cameroon', CA: 'Canada',
  CF: 'Central African Republic', TD: 'Chad', CL: 'Chile', CN: 'China',
  CO: 'Colombia', KM: 'Comoros', CG: 'Congo', CD: 'DR Congo', CR: 'Costa Rica',
  HR: 'Croatia', CU: 'Cuba', CY: 'Cyprus', CZ: 'Czech Republic', DK: 'Denmark',
  DJ: 'Djibouti', DM: 'Dominica', DO: 'Dominican Republic', EC: 'Ecuador',
  EG: 'Egypt', SV: 'El Salvador', GQ: 'Equatorial Guinea', ER: 'Eritrea',
  EE: 'Estonia', SZ: 'Eswatini', ET: 'Ethiopia', FJ: 'Fiji', FI: 'Finland',
  FR: 'France', GA: 'Gabon', GM: 'Gambia', GE: 'Georgia', DE: 'Germany',
  GH: 'Ghana', GR: 'Greece', GD: 'Grenada', GT: 'Guatemala', GN: 'Guinea',
  GW: 'Guinea-Bissau', GY: 'Guyana', HT: 'Haiti', HN: 'Honduras', HU: 'Hungary',
  IS: 'Iceland', IN: 'India', ID: 'Indonesia', IR: 'Iran', IQ: 'Iraq',
  IE: 'Ireland', IL: 'Israel', IT: 'Italy', CI: 'Ivory Coast', JM: 'Jamaica',
  JP: 'Japan', JO: 'Jordan', KZ: 'Kazakhstan', KE: 'Kenya', KI: 'Kiribati',
  XK: 'Kosovo', KW: 'Kuwait', KG: 'Kyrgyzstan', LA: 'Laos', LV: 'Latvia',
  LB: 'Lebanon', LS: 'Lesotho', LR: 'Liberia', LY: 'Libya', LI: 'Liechtenstein',
  LT: 'Lithuania', LU: 'Luxembourg', MG: 'Madagascar', MW: 'Malawi',
  MY: 'Malaysia', MV: 'Maldives', ML: 'Mali', MT: 'Malta', MH: 'Marshall Islands',
  MR: 'Mauritania', MU: 'Mauritius', MX: 'Mexico', FM: 'Micronesia',
  MD: 'Moldova', MC: 'Monaco', MN: 'Mongolia', ME: 'Montenegro', MA: 'Morocco',
  MZ: 'Mozambique', MM: 'Myanmar', NA: 'Namibia', NR: 'Nauru', NP: 'Nepal',
  NL: 'Netherlands', NZ: 'New Zealand', NI: 'Nicaragua', NE: 'Niger',
  NG: 'Nigeria', KP: 'North Korea', MK: 'North Macedonia', NO: 'Norway',
  OM: 'Oman', PK: 'Pakistan', PW: 'Palau', PS: 'Palestine', PA: 'Panama',
  PG: 'Papua New Guinea', PY: 'Paraguay', PE: 'Peru', PH: 'Philippines',
  PL: 'Poland', PT: 'Portugal', QA: 'Qatar', RO: 'Romania', RU: 'Russia',
  RW: 'Rwanda', KN: 'Saint Kitts and Nevis', LC: 'Saint Lucia',
  VC: 'Saint Vincent and the Grenadines', WS: 'Samoa', SM: 'San Marino',
  ST: 'Sao Tome and Principe', SA: 'Saudi Arabia', SN: 'Senegal', RS: 'Serbia',
  SC: 'Seychelles', SL: 'Sierra Leone', SG: 'Singapore', SK: 'Slovakia',
  SI: 'Slovenia', SB: 'Solomon Islands', SO: 'Somalia', ZA: 'South Africa',
  KR: 'South Korea', SS: 'South Sudan', ES: 'Spain', LK: 'Sri Lanka',
  SD: 'Sudan', SR: 'Suriname', SE: 'Sweden', CH: 'Switzerland', SY: 'Syria',
  TW: 'Taiwan', TJ: 'Tajikistan', TZ: 'Tanzania', TH: 'Thailand',
  TL: 'Timor-Leste', TG: 'Togo', TO: 'Tonga', TT: 'Trinidad and Tobago',
  TN: 'Tunisia', TR: 'Turkey', TM: 'Turkmenistan', TV: 'Tuvalu', UG: 'Uganda',
  UA: 'Ukraine', AE: 'United Arab Emirates', GB: 'United Kingdom',
  US: 'United States', UY: 'Uruguay', UZ: 'Uzbekistan', VU: 'Vanuatu',
  VA: 'Vatican City', VE: 'Venezuela', VN: 'Vietnam', YE: 'Yemen',
  ZM: 'Zambia', ZW: 'Zimbabwe',
  // Territories and special regions
  PR: 'Puerto Rico', VI: 'US Virgin Islands', GU: 'Guam', AS: 'American Samoa',
  HK: 'Hong Kong', MO: 'Macau', GP: 'Guadeloupe', MQ: 'Martinique',
  RE: 'Réunion', GF: 'French Guiana', NC: 'New Caledonia', PF: 'French Polynesia',
  AW: 'Aruba', CW: 'Curaçao', SX: 'Sint Maarten', BM: 'Bermuda',
  KY: 'Cayman Islands', TC: 'Turks and Caicos', VG: 'British Virgin Islands',
  AI: 'Anguilla', MS: 'Montserrat', GI: 'Gibraltar', FK: 'Falkland Islands',
  FO: 'Faroe Islands', GL: 'Greenland', IM: 'Isle of Man', JE: 'Jersey',
  GG: 'Guernsey',
};

export async function seedAirports(dataSource: DataSource): Promise<void> {
  const airportRepository = dataSource.getRepository(Airport);

  const existingCount = await airportRepository.count();
  if (existingCount > 0) {
    console.log(`Airports already seeded (${existingCount} airports). Skipping...`);
    return;
  }

  console.log('Fetching airport data from GitHub...');

  try {
    const response = await fetch(AIRPORTS_CSV_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch airport data: ${response.status}`);
    }

    const csvText = await response.text();
    console.log('Parsing CSV data...');

    const rawAirports = parseCSV(csvText);
    console.log(`Parsed ${rawAirports.length} total airports from CSV`);

    // Filter to airports with valid IATA codes and coordinates
    const validAirports = rawAirports
      .filter((airport) => {
        // Must have IATA code (3 letters)
        if (!airport.iata_code || airport.iata_code.length !== 3) {
          return false;
        }
        // Must have valid coordinates
        const coords = parseCoordinates(airport.coordinates);
        if (!coords) {
          return false;
        }
        // Filter out closed airports
        if (airport.type === 'closed') {
          return false;
        }
        return true;
      })
      .map((airport) => {
        const coords = parseCoordinates(airport.coordinates)!;
        return {
          iataCode: airport.iata_code.toUpperCase(),
          icaoCode: airport.icao_code || null,
          name: airport.name.replace(/"/g, ''),
          city: airport.municipality || null,
          country: countryNames[airport.iso_country] || airport.iso_country,
          countryIso: airport.iso_country,
          latitude: coords.lat,
          longitude: coords.lon,
        };
      });

    // Remove duplicates (keep first occurrence)
    const uniqueAirports = validAirports.filter(
      (airport, index, self) =>
        index === self.findIndex((a) => a.iataCode === airport.iataCode),
    );

    console.log(`Found ${uniqueAirports.length} airports with IATA codes`);
    console.log('Seeding airports to database...');

    // Insert in batches to avoid memory issues
    const batchSize = 500;
    for (let i = 0; i < uniqueAirports.length; i += batchSize) {
      const batch = uniqueAirports.slice(i, i + batchSize);
      await airportRepository.save(batch);
      console.log(`  Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(uniqueAirports.length / batchSize)}`);
    }

    console.log(`Successfully seeded ${uniqueAirports.length} airports.`);
  } catch (error) {
    console.error('Error seeding airports:', error);
    throw error;
  }
}
