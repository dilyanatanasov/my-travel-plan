import { describe, expect, it } from 'vitest';
import type { FlightJourney } from '../../types';
import { joinList, tripStory, type StoryContext } from './tripStory';
import type { BookStop } from './types';

const SOFIA: BookStop = { name: 'Sofia', iso2: null, latitude: 42.69, longitude: 23.41 };
const ISTANBUL: BookStop = { name: 'Istanbul', iso2: null, latitude: 41.26, longitude: 28.74 };
const TOKYO: BookStop = { name: 'Tokyo', iso2: null, latitude: 35.77, longitude: 140.39 };

function journey(extra: Partial<FlightJourney> = {}): FlightJourney {
  return {
    id: 2,
    journeyDate: '2023-05-10',
    datePrecision: 'day',
    isRoundTrip: false,
    notes: null,
    legs: [],
    sortIndex: 0,
    createdAt: '',
    updatedAt: '',
    ...extra,
  };
}

function context(extra: Partial<StoryContext> = {}): StoryContext {
  return {
    journey: journey(),
    stops: [SOFIA, TOKYO],
    distanceKm: 9000,
    modes: ['flight'],
    year: 2023,
    indexInBook: 3,
    indexInChapter: 1,
    chapterTrips: 3,
    newCountries: [],
    returns: [],
    firstModes: [],
    longestYet: false,
    homeName: 'Bulgaria',
    domestic: false,
    ...extra,
  };
}

describe('tripStory', () => {
  it('opens with the trip place in its year and month', () => {
    expect(tripStory(context())).toMatch(/^(The second journey of 2023 in May\.|May 2023, journey number 2 of the year\.)/);
  });

  it('marks the first page of the book and single-trip years', () => {
    expect(tripStory(context({ indexInBook: 0 }))).toMatch(/^(This is where the book begins|The first page of the story)/);
    expect(tripStory(context({ chapterTrips: 1, indexInChapter: 0 }))).toMatch(/^2023 had one journey in May, and this was it\./);
  });

  it('describes the route with km, modes, stops and the way home', () => {
    const story = tripStory(
      context({
        journey: journey({ isRoundTrip: true }),
        stops: [SOFIA, ISTANBUL, TOKYO, ISTANBUL, SOFIA],
        modes: ['flight', 'train'],
      }),
    );
    expect(story).toContain('9,000 km by plane and train');
    expect(story).toContain('Tokyo, via Istanbul');
    expect(story).toContain('and home again');
  });

  it('picks one highlight, new countries first', () => {
    const story = tripStory(
      context({ newCountries: ['Japan'], longestYet: true, returns: [{ name: 'Turkey', firstYear: 2019 }] }),
    );
    expect(story).toMatch(/Japan/);
    expect(story).not.toMatch(/longest|farthest|Turkey/);
    expect(tripStory(context({ newCountries: ['Turkey', 'Japan', 'Korea', 'China'] }))).toContain(
      'Four new stamps in one go: Turkey, Japan, Korea and 1 more.',
    );
  });

  it('falls back to records, first modes, returns and home', () => {
    expect(tripStory(context({ longestYet: true }))).toMatch(/longest journey yet|farthest the book had gone/);
    expect(tripStory(context({ firstModes: ['ferry'] }))).toContain('The first time the book travels by ferry.');
    expect(tripStory(context({ returns: [{ name: 'Japan', firstYear: 2019 }] }))).toContain(
      'Back in Japan, first visited in 2019.',
    );
    expect(tripStory(context({ domestic: true, stops: [SOFIA, ISTANBUL] }))).toContain('A journey at home, in Bulgaria.');
  });

  it('never uses em dashes', () => {
    expect(tripStory(context({ newCountries: ['Japan', 'Korea'] }))).not.toMatch(/—/);
  });

  it('handles undated trips and trips with no stops', () => {
    const story = tripStory(context({ year: null, journey: journey({ journeyDate: null }), stops: [] }));
    expect(story).toMatch(/^(A journey without a date|The date is lost)/);
  });
});

describe('joinList', () => {
  it('joins with commas and a final and', () => {
    expect(joinList(['a'])).toBe('a');
    expect(joinList(['a', 'b'])).toBe('a and b');
    expect(joinList(['a', 'b', 'c'])).toBe('a, b and c');
  });
});
