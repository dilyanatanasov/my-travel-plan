/**
 * Known connection hubs for flight routing.
 * These are major airports that serve as common connection points.
 */

export interface Hub {
  code: string;
  name: string;
  city: string;
  region: string;
  // Regions this hub connects well to
  strongForRegions: string[];
  // Approximate minimum connection time in minutes
  minConnectionMinutes: number;
  // Priority (higher = search first)
  priority: number;
}

/**
 * Major connection hubs, ordered by priority.
 * Priority is based on route coverage and typical connection quality.
 */
export const KNOWN_HUBS: Hub[] = [
  // Top-tier global hubs
  {
    code: 'IST',
    name: 'Istanbul Airport',
    city: 'Istanbul',
    region: 'Europe-East',
    strongForRegions: ['Southeast Asia', 'Middle East', 'Africa', 'South Asia', 'Europe', 'Central Asia'],
    minConnectionMinutes: 90,
    priority: 100,
  },
  {
    code: 'DXB',
    name: 'Dubai International',
    city: 'Dubai',
    region: 'Middle East',
    strongForRegions: ['Southeast Asia', 'South Asia', 'Africa', 'Australia', 'Europe'],
    minConnectionMinutes: 90,
    priority: 95,
  },
  {
    code: 'DOH',
    name: 'Hamad International',
    city: 'Doha',
    region: 'Middle East',
    strongForRegions: ['Southeast Asia', 'South Asia', 'Africa', 'Australia', 'Europe'],
    minConnectionMinutes: 60,
    priority: 90,
  },

  // European major hubs
  {
    code: 'FRA',
    name: 'Frankfurt Airport',
    city: 'Frankfurt',
    region: 'Europe-Central',
    strongForRegions: ['Worldwide', 'Americas', 'Asia', 'Africa'],
    minConnectionMinutes: 60,
    priority: 85,
  },
  {
    code: 'LHR',
    name: 'London Heathrow',
    city: 'London',
    region: 'Europe-West',
    strongForRegions: ['Worldwide', 'Americas', 'Asia', 'Africa'],
    minConnectionMinutes: 90,
    priority: 85,
  },
  {
    code: 'CDG',
    name: 'Paris Charles de Gaulle',
    city: 'Paris',
    region: 'Europe-West',
    strongForRegions: ['Worldwide', 'Africa', 'Americas', 'Asia'],
    minConnectionMinutes: 75,
    priority: 80,
  },
  {
    code: 'AMS',
    name: 'Amsterdam Schiphol',
    city: 'Amsterdam',
    region: 'Europe-West',
    strongForRegions: ['Worldwide', 'Americas', 'Asia'],
    minConnectionMinutes: 50,
    priority: 80,
  },
  {
    code: 'MUC',
    name: 'Munich Airport',
    city: 'Munich',
    region: 'Europe-Central',
    strongForRegions: ['Europe', 'Americas', 'Middle East'],
    minConnectionMinutes: 45,
    priority: 75,
  },
  {
    code: 'VIE',
    name: 'Vienna International',
    city: 'Vienna',
    region: 'Europe-Central',
    strongForRegions: ['Europe', 'Middle East', 'Eastern Europe'],
    minConnectionMinutes: 45,
    priority: 70,
  },
  {
    code: 'ZRH',
    name: 'Zurich Airport',
    city: 'Zurich',
    region: 'Europe-Central',
    strongForRegions: ['Europe', 'Americas', 'Middle East'],
    minConnectionMinutes: 45,
    priority: 70,
  },

  // Regional hubs useful for Balkans
  {
    code: 'SOF',
    name: 'Sofia Airport',
    city: 'Sofia',
    region: 'Balkans',
    strongForRegions: ['Europe', 'Middle East'],
    minConnectionMinutes: 45,
    priority: 60,
  },
  {
    code: 'OTP',
    name: 'Bucharest Henri Coanda',
    city: 'Bucharest',
    region: 'Balkans',
    strongForRegions: ['Europe', 'Middle East'],
    minConnectionMinutes: 45,
    priority: 55,
  },
  {
    code: 'ATH',
    name: 'Athens International',
    city: 'Athens',
    region: 'Europe-South',
    strongForRegions: ['Europe', 'Middle East', 'Africa'],
    minConnectionMinutes: 45,
    priority: 55,
  },

  // Asian hubs (for connections to SE Asia)
  {
    code: 'BKK',
    name: 'Suvarnabhumi Airport',
    city: 'Bangkok',
    region: 'Southeast Asia',
    strongForRegions: ['Southeast Asia', 'South Asia', 'Australia', 'East Asia'],
    minConnectionMinutes: 90,
    priority: 70,
  },
  {
    code: 'SIN',
    name: 'Singapore Changi',
    city: 'Singapore',
    region: 'Southeast Asia',
    strongForRegions: ['Southeast Asia', 'Australia', 'South Asia', 'Europe'],
    minConnectionMinutes: 60,
    priority: 75,
  },
  {
    code: 'KUL',
    name: 'Kuala Lumpur International',
    city: 'Kuala Lumpur',
    region: 'Southeast Asia',
    strongForRegions: ['Southeast Asia', 'South Asia', 'Australia', 'Middle East'],
    minConnectionMinutes: 60,
    priority: 65,
  },
];

/**
 * Destination regions for categorizing airports.
 */
export const DESTINATION_REGIONS: Record<string, string[]> = {
  'Southeast Asia': ['HKT', 'BKK', 'SIN', 'KUL', 'SGN', 'HAN', 'MNL', 'CGK', 'DPS', 'REP', 'RGN', 'VTE', 'PNH'],
  'South Asia': ['DEL', 'BOM', 'MAA', 'BLR', 'CCU', 'CMB', 'KTM', 'DAC', 'ISB', 'KHI', 'LHE'],
  'Middle East': ['DXB', 'DOH', 'AUH', 'BAH', 'KWI', 'MCT', 'AMM', 'TLV', 'CAI', 'JED', 'RUH'],
  'Africa': ['JNB', 'CPT', 'NBO', 'ADD', 'CAI', 'CMN', 'LOS', 'ACC', 'DAR', 'MRU', 'SEZ'],
  'Europe': ['LHR', 'CDG', 'FRA', 'AMS', 'MAD', 'BCN', 'FCO', 'MUC', 'VIE', 'ZRH', 'CPH', 'OSL', 'ARN', 'HEL'],
  'Americas': ['JFK', 'LAX', 'ORD', 'MIA', 'SFO', 'ATL', 'DFW', 'YYZ', 'MEX', 'GRU', 'EZE', 'SCL', 'BOG', 'LIM'],
  'Australia': ['SYD', 'MEL', 'BNE', 'PER', 'AKL', 'WLG', 'CHC'],
  'East Asia': ['HND', 'NRT', 'ICN', 'PEK', 'PVG', 'HKG', 'TPE'],
};

/**
 * Get the region for a destination airport code.
 */
export function getDestinationRegion(airportCode: string): string | null {
  for (const [region, airports] of Object.entries(DESTINATION_REGIONS)) {
    if (airports.includes(airportCode)) {
      return region;
    }
  }
  return null;
}

/**
 * Get hubs that are strong for a particular destination region.
 */
export function getHubsForDestination(destinationCode: string): Hub[] {
  const region = getDestinationRegion(destinationCode);

  if (!region) {
    // Unknown destination - return top hubs
    return KNOWN_HUBS.filter(h => h.priority >= 80);
  }

  return KNOWN_HUBS
    .filter(hub =>
      hub.strongForRegions.includes(region) ||
      hub.strongForRegions.includes('Worldwide')
    )
    .sort((a, b) => b.priority - a.priority);
}

/**
 * Get default hubs to try when destination region is unknown.
 */
export function getDefaultHubs(): Hub[] {
  return KNOWN_HUBS
    .filter(h => h.priority >= 70)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 6);
}
