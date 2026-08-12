import type { Alpha3, Country, Visit } from '../../types';
import type { DestinationPrices, DiscoveryRow, DiscoverySort } from './types';

/*
  Pure derivation over the price matrix. Nothing here knows whether the data
  came from fixtures or a provider, which is the seam v2 swaps at.
*/

/**
 * Countries that count as "been there" for discovery purposes.
 *
 * Transit deliberately does not count, matching RegionProgress: changing
 * planes in a country is not visiting it, so it stays on the suggestion list.
 * Home is a visit type, so it is excluded with the rest.
 */
export function visitedIsoSet(visits: Visit[]): Set<string> {
  const set = new Set<string>();
  for (const visit of visits) {
    if ((visit.visitType || 'trip') === 'transit') continue;
    const iso2 = visit.country?.isoCode2;
    if (iso2) set.add(iso2);
  }
  return set;
}

/**
 * Turn the raw matrix into card-ready rows: unvisited countries only, one
 * row per destination, cheapest fare attached. Destinations the cache knows
 * nothing about this month come back separately — they are an honest state
 * to show, not rows to fake.
 */
export function deriveRows(
  matrix: DestinationPrices[],
  visited: Set<string>,
): { rows: DiscoveryRow[]; noData: DestinationPrices[] } {
  const rows: DiscoveryRow[] = [];
  const noData: DestinationPrices[] = [];

  for (const dest of matrix) {
    if (visited.has(dest.countryIso2)) continue;

    if (dest.days.length === 0) {
      noData.push(dest);
      continue;
    }

    const cheapest = dest.days.reduce((min, day) => (day.value < min.value ? day : min));
    const [year, month] = dest.month.split('-').map(Number);

    rows.push({
      iata: dest.iata,
      city: dest.city,
      countryName: dest.countryName,
      countryIso2: dest.countryIso2,
      continent: dest.continent,
      cheapest,
      pricedDayCount: dest.days.length,
      daysInMonth: new Date(year, month, 0).getDate(),
      days: dest.days,
    });
  }

  return { rows, noData };
}

export function sortRows(rows: DiscoveryRow[], sort: DiscoverySort): DiscoveryRow[] {
  const sorted = [...rows];
  switch (sort) {
    case 'price':
      sorted.sort((a, b) => a.cheapest.value - b.cheapest.value);
      break;
    case 'region':
      // Regions ordered by their own cheapest fare, cheapest region first,
      // so the grouping still answers "where is cheap".
      sorted.sort(
        (a, b) =>
          a.continent.localeCompare(b.continent) || a.cheapest.value - b.cheapest.value,
      );
      break;
    case 'name':
      sorted.sort((a, b) => a.countryName.localeCompare(b.countryName));
      break;
  }
  return sorted;
}

/** "Seen today", "seen 3 days ago" — the freshness label D1 requires. */
export function freshnessLabel(foundAt: string): string {
  const ageMs = Date.now() - new Date(foundAt).getTime();
  const days = Math.floor(ageMs / 86_400_000);
  if (days <= 0) return 'seen today';
  if (days === 1) return 'seen yesterday';
  return `seen ${days} days ago`;
}

export interface PriceFill {
  price: number;
  /** Terciles of this month's cheapest fares, so the ramp adapts per month. */
  bucket: 'low' | 'mid' | 'high';
}

/**
 * The shape A wires into the map layer: alpha-3 (the map's key convention,
 * per countryColors.ts) → cheapest price + bucket. Rows carry alpha-2, which
 * is why the countries list rides along for the conversion.
 */
export function buildPriceFillMap(
  rows: DiscoveryRow[],
  countries: Country[],
): Map<Alpha3, PriceFill> {
  const iso2to3 = new Map<string, Alpha3>();
  for (const country of countries) iso2to3.set(country.isoCode2, country.isoCode);

  const prices = rows.map((row) => row.cheapest.value).sort((a, b) => a - b);
  const lowCut = prices[Math.floor(prices.length / 3)] ?? Infinity;
  const midCut = prices[Math.floor((prices.length * 2) / 3)] ?? Infinity;

  const fill = new Map<Alpha3, PriceFill>();
  for (const row of rows) {
    const iso3 = iso2to3.get(row.countryIso2);
    if (!iso3) continue;
    const price = row.cheapest.value;
    fill.set(iso3, {
      price,
      bucket: price <= lowCut ? 'low' : price <= midCut ? 'mid' : 'high',
    });
  }
  return fill;
}
