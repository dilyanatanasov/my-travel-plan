import { describe, expect, it } from 'vitest';
import type { FlightJourney } from '../../types';
import { computeTravelRecords } from './records';

/**
 * The two personal records: consecutive years that each added a first-ever
 * country, and the year that touched the most continents.
 */

function journey(date: string | null, ...arrivalIsos: (string | null)[]) {
  return {
    journeyDate: date,
    legs: arrivalIsos.map((iso, index) => ({
      legOrder: index + 1,
      arrivalAirport: iso ? { countryIso: iso } : null,
    })),
  } as unknown as FlightJourney;
}

describe('computeTravelRecords', () => {
  it('is empty-safe', () => {
    expect(computeTravelRecords([])).toEqual({
      newCountryStreak: null,
      maxContinentsInYear: null,
    });
  });

  it('counts consecutive first-country years and where the run sat', () => {
    const records = computeTravelRecords([
      journey('2019-05-01', 'IT'),
      journey('2020-06-01', 'FR'),
      journey('2021-07-01', 'ES'),
      // 2022: only a repeat — Italy again adds nothing, the run ends.
      journey('2022-03-01', 'IT'),
      journey('2024-08-01', 'JP'),
    ]);
    expect(records.newCountryStreak).toEqual({
      years: 3,
      start: 2019,
      end: 2021,
    });
  });

  it('a repeat country counts only for its first year', () => {
    const records = computeTravelRecords([
      journey('2021-01-01', 'IT'),
      journey('2020-01-01', 'IT'),
    ]);
    // Italy's first year is 2020 after both rows are seen, whatever order
    // the journeys arrive in.
    expect(records.newCountryStreak).toEqual({
      years: 1,
      start: 2020,
      end: 2020,
    });
  });

  it('finds the year that touched the most continents', () => {
    const records = computeTravelRecords([
      journey('2023-02-01', 'JP', 'US'),
      journey('2023-09-01', 'IT'),
      journey('2024-05-01', 'FR', 'DE'),
    ]);
    expect(records.maxContinentsInYear).toEqual({
      year: 2023,
      continents: 3,
    });
  });

  it('undated journeys and missing airports are skipped, not crashed on', () => {
    const records = computeTravelRecords([
      journey(null, 'IT'),
      journey('2023-01-01', null),
    ]);
    expect(records.newCountryStreak).toBeNull();
    expect(records.maxContinentsInYear).toBeNull();
  });

  it('year-precision dates still carry their year', () => {
    const records = computeTravelRecords([journey('2019-01-01', 'AU')]);
    expect(records.maxContinentsInYear).toEqual({
      year: 2019,
      continents: 1,
    });
  });
});
