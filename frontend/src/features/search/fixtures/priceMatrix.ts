import { asAlpha2 } from '../../../types';
import type { DestinationPrices, PriceDay } from '../types';

/*
  Fixture stand-in for Travelpayouts /v2/prices/month-matrix, per D2: the
  experience ships and gets reviewed on this; the real provider replaces this
  module after deployment (D3). Everything here is deterministic — the same
  month always renders the same prices — because a design review needs the
  screen to hold still between reloads.

  Deliberately modelled properties of the real endpoint, so the UI cannot
  dodge them:
  - prices are a 48 h–7 d cache of other users' searches (foundAt varies);
  - coverage is patchy: most days of a month have no observation at all;
  - thin routes can have no data whatsoever for a month;
  - months further out are sparser, because fewer people have searched them.
*/

/**
 * Where prices are "from" until v2. The real version derives this from the
 * user's home country and preferred airports (the old flightSearch's actual
 * differentiator), which is why the panel shows it as a fact rather than an
 * editable field.
 */
export const HOME_ORIGIN = { iata: 'SOF', city: 'Sofia' } as const;

interface FixtureDestination {
  iata: string;
  city: string;
  countryName: string;
  iso2: string;
  continent: string;
  /** Typical one-way fare from SOF, EUR — anchors the generated spread. */
  basePrice: number;
  /**
   * How well the cache knows this route, 0..1. Drives how many days of a
   * month carry a price. Below ~0.15 a month can come back entirely empty,
   * which is exactly the honest no-data state the UI must design for.
   */
  richness: number;
}

// One airport per country: discovery is country-grained, like the map.
const DESTINATIONS: FixtureDestination[] = [
  { iata: 'BUD', city: 'Budapest', countryName: 'Hungary', iso2: 'HU', continent: 'Europe', basePrice: 28, richness: 0.9 },
  { iata: 'VIE', city: 'Vienna', countryName: 'Austria', iso2: 'AT', continent: 'Europe', basePrice: 35, richness: 0.9 },
  { iata: 'PRG', city: 'Prague', countryName: 'Czechia', iso2: 'CZ', continent: 'Europe', basePrice: 42, richness: 0.85 },
  { iata: 'WAW', city: 'Warsaw', countryName: 'Poland', iso2: 'PL', continent: 'Europe', basePrice: 45, richness: 0.8 },
  { iata: 'BCN', city: 'Barcelona', countryName: 'Spain', iso2: 'ES', continent: 'Europe', basePrice: 55, richness: 0.95 },
  { iata: 'MXP', city: 'Milan', countryName: 'Italy', iso2: 'IT', continent: 'Europe', basePrice: 38, richness: 0.95 },
  { iata: 'CDG', city: 'Paris', countryName: 'France', iso2: 'FR', continent: 'Europe', basePrice: 62, richness: 0.95 },
  { iata: 'AMS', city: 'Amsterdam', countryName: 'Netherlands', iso2: 'NL', continent: 'Europe', basePrice: 68, richness: 0.9 },
  { iata: 'BER', city: 'Berlin', countryName: 'Germany', iso2: 'DE', continent: 'Europe', basePrice: 48, richness: 0.9 },
  { iata: 'LTN', city: 'London', countryName: 'United Kingdom', iso2: 'GB', continent: 'Europe', basePrice: 58, richness: 0.95 },
  { iata: 'DUB', city: 'Dublin', countryName: 'Ireland', iso2: 'IE', continent: 'Europe', basePrice: 85, richness: 0.7 },
  { iata: 'LIS', city: 'Lisbon', countryName: 'Portugal', iso2: 'PT', continent: 'Europe', basePrice: 95, richness: 0.75 },
  { iata: 'ATH', city: 'Athens', countryName: 'Greece', iso2: 'GR', continent: 'Europe', basePrice: 65, richness: 0.85 },
  { iata: 'ZAG', city: 'Zagreb', countryName: 'Croatia', iso2: 'HR', continent: 'Europe', basePrice: 75, richness: 0.5 },
  { iata: 'OSL', city: 'Oslo', countryName: 'Norway', iso2: 'NO', continent: 'Europe', basePrice: 98, richness: 0.6 },
  { iata: 'ARN', city: 'Stockholm', countryName: 'Sweden', iso2: 'SE', continent: 'Europe', basePrice: 88, richness: 0.65 },
  { iata: 'HEL', city: 'Helsinki', countryName: 'Finland', iso2: 'FI', continent: 'Europe', basePrice: 92, richness: 0.55 },
  { iata: 'KEF', city: 'Reykjavík', countryName: 'Iceland', iso2: 'IS', continent: 'Europe', basePrice: 160, richness: 0.4 },
  { iata: 'IST', city: 'Istanbul', countryName: 'Türkiye', iso2: 'TR', continent: 'Europe', basePrice: 70, richness: 0.9 },
  { iata: 'RAK', city: 'Marrakesh', countryName: 'Morocco', iso2: 'MA', continent: 'Africa', basePrice: 130, richness: 0.45 },
  { iata: 'CAI', city: 'Cairo', countryName: 'Egypt', iso2: 'EG', continent: 'Africa', basePrice: 110, richness: 0.6 },
  { iata: 'NBO', city: 'Nairobi', countryName: 'Kenya', iso2: 'KE', continent: 'Africa', basePrice: 380, richness: 0.12 },
  { iata: 'CPT', city: 'Cape Town', countryName: 'South Africa', iso2: 'ZA', continent: 'Africa', basePrice: 450, richness: 0.25 },
  { iata: 'ZNZ', city: 'Zanzibar', countryName: 'Tanzania', iso2: 'TZ', continent: 'Africa', basePrice: 420, richness: 0.1 },
  { iata: 'DXB', city: 'Dubai', countryName: 'United Arab Emirates', iso2: 'AE', continent: 'Asia', basePrice: 150, richness: 0.8 },
  { iata: 'AMM', city: 'Amman', countryName: 'Jordan', iso2: 'JO', continent: 'Asia', basePrice: 140, richness: 0.35 },
  { iata: 'TLV', city: 'Tel Aviv', countryName: 'Israel', iso2: 'IL', continent: 'Asia', basePrice: 120, richness: 0.6 },
  { iata: 'DEL', city: 'Delhi', countryName: 'India', iso2: 'IN', continent: 'Asia', basePrice: 320, richness: 0.5 },
  { iata: 'CMB', city: 'Colombo', countryName: 'Sri Lanka', iso2: 'LK', continent: 'Asia', basePrice: 410, richness: 0.3 },
  { iata: 'BKK', city: 'Bangkok', countryName: 'Thailand', iso2: 'TH', continent: 'Asia', basePrice: 430, richness: 0.7 },
  { iata: 'SGN', city: 'Ho Chi Minh City', countryName: 'Vietnam', iso2: 'VN', continent: 'Asia', basePrice: 480, richness: 0.4 },
  { iata: 'KUL', city: 'Kuala Lumpur', countryName: 'Malaysia', iso2: 'MY', continent: 'Asia', basePrice: 460, richness: 0.35 },
  { iata: 'SIN', city: 'Singapore', countryName: 'Singapore', iso2: 'SG', continent: 'Asia', basePrice: 490, richness: 0.55 },
  { iata: 'DPS', city: 'Denpasar', countryName: 'Indonesia', iso2: 'ID', continent: 'Asia', basePrice: 540, richness: 0.3 },
  { iata: 'NRT', city: 'Tokyo', countryName: 'Japan', iso2: 'JP', continent: 'Asia', basePrice: 560, richness: 0.6 },
  { iata: 'ICN', city: 'Seoul', countryName: 'South Korea', iso2: 'KR', continent: 'Asia', basePrice: 540, richness: 0.45 },
  { iata: 'JFK', city: 'New York', countryName: 'United States', iso2: 'US', continent: 'North America', basePrice: 420, richness: 0.75 },
  { iata: 'YYZ', city: 'Toronto', countryName: 'Canada', iso2: 'CA', continent: 'North America', basePrice: 460, richness: 0.5 },
  { iata: 'MEX', city: 'Mexico City', countryName: 'Mexico', iso2: 'MX', continent: 'North America', basePrice: 620, richness: 0.3 },
  { iata: 'CUN', city: 'Cancún', countryName: 'Mexico', iso2: 'MX', continent: 'North America', basePrice: 580, richness: 0.35 },
  { iata: 'GRU', city: 'São Paulo', countryName: 'Brazil', iso2: 'BR', continent: 'South America', basePrice: 640, richness: 0.4 },
  { iata: 'EZE', city: 'Buenos Aires', countryName: 'Argentina', iso2: 'AR', continent: 'South America', basePrice: 720, richness: 0.3 },
  { iata: 'BOG', city: 'Bogotá', countryName: 'Colombia', iso2: 'CO', continent: 'South America', basePrice: 680, richness: 0.15 },
  { iata: 'LIM', city: 'Lima', countryName: 'Peru', iso2: 'PE', continent: 'South America', basePrice: 750, richness: 0.12 },
  { iata: 'SYD', city: 'Sydney', countryName: 'Australia', iso2: 'AU', continent: 'Oceania', basePrice: 890, richness: 0.35 },
  { iata: 'AKL', city: 'Auckland', countryName: 'New Zealand', iso2: 'NZ', continent: 'Oceania', basePrice: 1050, richness: 0.08 },
];

/** mulberry32 over a string hash: cheap, stable, good enough for fixtures. */
function seededRandom(seed: string): () => number {
  let h = 1779033703;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** School-holiday months cost more; the dead season costs less. */
function seasonalFactor(monthIndex: number): number {
  if (monthIndex === 6 || monthIndex === 7 || monthIndex === 11) return 1.25;
  if (monthIndex === 1 || monthIndex === 10) return 0.9;
  return 1;
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/**
 * All known prices from `origin` for a "YYYY-MM" month. Sparse by design;
 * a destination can legitimately return zero days.
 */
export function getMonthMatrix(origin: string, month: string): DestinationPrices[] {
  const [yearStr, monthStr] = month.split('-');
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const dayCount = daysInMonth(year, monthIndex);
  const now = Date.now();

  const monthsAhead = Math.max(
    0,
    (year - new Date().getFullYear()) * 12 + (monthIndex - new Date().getMonth()),
  );
  // The cache thins out the further ahead you look: fewer people have
  // searched July next year than next week.
  const horizonFactor = Math.max(0.3, 1 - monthsAhead * 0.07);

  return DESTINATIONS.map((dest) => {
    const rand = seededRandom(`${origin}-${dest.iata}-${month}`);
    const coverage = dest.richness * horizonFactor;
    const days: PriceDay[] = [];

    for (let day = 1; day <= dayCount; day++) {
      if (rand() > coverage) continue;
      const weekday = new Date(year, monthIndex, day).getDay();
      const weekendBump = weekday === 5 || weekday === 6 ? 1.08 : 1;
      const value = Math.round(
        dest.basePrice * seasonalFactor(monthIndex) * weekendBump * (0.75 + rand() * 0.6),
      );
      // Observed sometime in the endpoint's real 48h–7d cache window.
      const ageHours = 6 + rand() * 160;
      days.push({
        departDate: `${month}-${String(day).padStart(2, '0')}`,
        value,
        foundAt: new Date(now - ageHours * 3_600_000).toISOString(),
      });
    }

    return {
      iata: dest.iata,
      city: dest.city,
      countryName: dest.countryName,
      countryIso2: asAlpha2(dest.iso2),
      continent: dest.continent,
      month,
      days,
    };
  });
}
