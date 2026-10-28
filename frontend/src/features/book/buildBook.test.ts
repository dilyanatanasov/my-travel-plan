import { describe, expect, it } from 'vitest';
import type { Airport, CityRef, Country, FlightJourney, FlightLeg } from '../../types';
import { asAlpha2, asAlpha3 } from '../../types';
import { buildBook, buildPages, compareJourneys, tripTitle, tripStops } from './buildBook';

let nextId = 1;

function airport(city: string, iso2: string, lat: number, lon: number): Airport {
  return {
    id: nextId++,
    iataCode: city.slice(0, 3).toUpperCase(),
    icaoCode: null,
    name: `${city} Airport`,
    city,
    country: null,
    countryIso: asAlpha2(iso2),
    latitude: lat,
    longitude: lon,
    createdAt: '',
  };
}

function city(name: string, iso2: string, lat: number, lon: number): CityRef {
  return { id: nextId++, name, countryIso: asAlpha2(iso2), latitude: lat, longitude: lon };
}

const SOF = airport('Sofia', 'BG', 42.69, 23.41);
const LIS = airport('Lisbon', 'PT', 38.77, -9.13);
const IST = airport('Istanbul', 'TR', 41.26, 28.74);
const NRT = airport('Tokyo', 'JP', 35.77, 140.39);

function flightLeg(order: number, from: Airport, to: Airport, km = 1000): FlightLeg {
  return {
    id: nextId++,
    legOrder: order,
    travelMode: 'flight',
    departureAirport: from,
    arrivalAirport: to,
    distanceKm: km,
  };
}

function journey(
  legs: FlightLeg[],
  date: string | null,
  extra: Partial<FlightJourney> = {},
): FlightJourney {
  return {
    id: nextId++,
    journeyDate: date,
    datePrecision: 'day',
    isRoundTrip: false,
    notes: null,
    legs,
    sortIndex: 0,
    createdAt: '',
    updatedAt: '',
    ...extra,
  };
}

const countries: Country[] = [
  ['Bulgaria', 'BGR', 'BG'],
  ['Portugal', 'PRT', 'PT'],
  ['Turkey', 'TUR', 'TR'],
  ['Japan', 'JPN', 'JP'],
  ['Romania', 'ROU', 'RO'],
].map(([name, iso3, iso2], i) => ({
  id: i + 1,
  name,
  isoCode: asAlpha3(iso3),
  isoCode2: asAlpha2(iso2),
  createdAt: '',
}));

describe('ordering', () => {
  it('puts year-only trips first in their year and undated trips last', () => {
    const undated = journey([], null, { sortIndex: 1 });
    const may = journey([], '2024-05-10');
    const yearOnly = journey([], '2024-01-01', { datePrecision: 'year' });
    const jan1 = journey([], '2024-01-01');
    const older = journey([], '2019-08-01');
    const sorted = [undated, may, jan1, yearOnly, older].sort(compareJourneys);
    expect(sorted).toEqual([older, yearOnly, jan1, may, undated]);
  });

  it('breaks same-day ties with the user sortIndex', () => {
    const second = journey([], '2024-05-10', { sortIndex: 2 });
    const first = journey([], '2024-05-10', { sortIndex: 1 });
    expect([second, first].sort(compareJourneys)).toEqual([first, second]);
  });
});

describe('trip titles', () => {
  it('names a one-way trip by its ends', () => {
    const stops = tripStops(journey([flightLeg(1, SOF, IST), flightLeg(2, IST, LIS)], null));
    expect(stops.map((s) => s.name)).toEqual(['Sofia', 'Istanbul', 'Lisbon']);
    expect(tripTitle(stops, false)).toBe('Sofia to Lisbon');
  });

  it('names a round trip by its farthest stop', () => {
    const stops = tripStops(
      journey(
        [flightLeg(1, SOF, IST), flightLeg(2, IST, NRT), flightLeg(3, NRT, IST), flightLeg(4, IST, SOF)],
        null,
      ),
    );
    expect(tripTitle(stops, true)).toBe('Sofia to Tokyo and back');
  });

  it('resolves land legs through their cities', () => {
    const leg: FlightLeg = {
      id: nextId++,
      legOrder: 1,
      travelMode: 'train',
      departureAirport: null,
      arrivalAirport: null,
      departureCity: city('Sofia', 'BG', 42.69, 23.32),
      arrivalCity: city('Bucharest', 'RO', 44.43, 26.1),
      distanceKm: 300,
    };
    const book = buildBook({
      journeys: [journey([leg], '2023-03-01')],
      countries,
      photoLegIds: [],
      homeIso2: 'BG',
    });
    expect(book.chapters[0].trips[0].title).toBe('Sofia to Bucharest');
    expect(book.chapters[0].trips[0].countries).toEqual(['RO']);
    expect(book.chapters[0].trips[0].modes).toEqual(['train']);
  });
});

describe('buildBook', () => {
  const first = journey([flightLeg(1, SOF, LIS, 2700)], '2022-06-01');
  const second = journey([flightLeg(1, SOF, IST, 500), flightLeg(2, IST, LIS, 3200)], '2023-02-01');
  const third = journey([flightLeg(1, SOF, NRT, 9000)], '2023-09-01', { notes: '  ramen  ' });
  const undated = journey([flightLeg(1, SOF, IST, 500)], null);
  const book = buildBook({
    journeys: [undated, third, first, second],
    countries,
    photoLegIds: [third.legs[0].id],
    homeIso2: 'BG',
    ownerName: 'Dilyan',
  });

  it('groups trips into year chapters with the undated chapter last', () => {
    expect(book.chapters.map((c) => c.title)).toEqual(['2022', '2023', 'Somewhere in time']);
    expect(book.chapters[1].trips.map((t) => t.journey.id)).toEqual([second.id, third.id]);
  });

  it('stamps a country only on the first trip that reaches it, never home', () => {
    expect(book.chapters[0].trips[0].newCountries).toEqual(['PT']);
    expect(book.chapters[1].trips[0].newCountries).toEqual(['TR']);
    expect(book.chapters[1].trips[1].newCountries).toEqual(['JP']);
    expect(book.chapters[2].trips[0].newCountries).toEqual([]);
    expect(book.chapters[1].newCountries).toEqual(['TR', 'JP']);
  });

  it('adds up totals and carries photos and trimmed notes', () => {
    expect(book.totals).toEqual({
      trips: 4,
      distanceKm: 2700 + 3700 + 9000 + 500,
      countries: 3,
      firstYear: 2022,
      lastYear: 2023,
    });
    const tokyo = book.chapters[1].trips[1];
    expect(tokyo.photoLegIds).toEqual([third.legs[0].id]);
    expect(tokyo.notes).toBe('ramen');
    expect(book.countryNames.JP).toBe('Japan');
  });

  it('lays pages out so every trip is a spread and the count is even', () => {
    const pages = buildPages(book);
    expect(pages.length % 2).toBe(0);
    expect(pages[0].kind).toBe('cover');
    expect(pages[pages.length - 1].kind).toBe('back-cover');
    pages.forEach((page, index) => {
      // Odd pages are left-hand pages once the cover is turned.
      if (page.kind === 'trip-route' || page.kind === 'chapter-title') {
        expect(index % 2).toBe(1);
      }
    });
    const contents = pages.find((p) => p.kind === 'contents');
    expect(contents && contents.kind === 'contents' && contents.entries.map((e) => pages[e.page].kind)).toEqual([
      'chapter-title',
      'chapter-title',
      'chapter-title',
      'passport-title',
    ]);
  });

  it('collects every stamp into the passport in first-visit order', () => {
    expect(book.passport.map((e) => e.iso2)).toEqual(['PT', 'TR', 'JP']);
    expect(book.passport[0].date).toBe('JUN 1, 2022');
  });

  it('writes a story for every trip', () => {
    const [first, second] = [book.chapters[0].trips[0], book.chapters[1].trips[0]];
    expect(first.story).toContain('This is where the book begins.');
    expect(first.story).toContain('Portugal');
    expect(second.story).toContain('Turkey');
  });
});

describe('passport pages', () => {
  function bookWithStamps(count: number) {
    const codes = Array.from({ length: count }, (_, i) => `X${String.fromCharCode(65 + (i % 26))}${i}`);
    const book = buildBook({ journeys: [], countries, photoLegIds: [] });
    return { ...book, passport: codes.map((iso) => ({ iso2: asAlpha2(iso.slice(0, 2)), date: null })) };
  }

  it.each([1, 8, 9, 17, 18, 26])('keeps room to grow and the page count even with %i stamps', (count) => {
    const pages = buildPages(bookWithStamps(count));
    expect(pages.length % 2).toBe(0);
    const sheets = pages.filter((p) => p.kind === 'passport');
    const last = sheets[sheets.length - 1];
    expect(last.kind === 'passport' && last.emptySlots).toBeGreaterThan(0);
    const placed = sheets.reduce((sum, p) => sum + (p.kind === 'passport' ? p.stamps.length : 0), 0);
    expect(placed).toBe(count);
    // The passport opens on a left-hand page, like a chapter.
    expect(pages.findIndex((p) => p.kind === 'passport-title') % 2).toBe(1);
    expect(pages[pages.length - 1].kind).toBe('back-cover');
  });

  it('still makes a valid book with no trips', () => {
    const empty = buildBook({ journeys: [], countries, photoLegIds: [] });
    const pages = buildPages(empty);
    expect(pages.map((p) => p.kind)).toEqual([
      'cover',
      'intro',
      'contents',
      'the-end',
      'next-chapter',
      'back-cover',
    ]);
  });
});
