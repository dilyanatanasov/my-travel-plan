import type { Alpha2, FlightJourney, TravelMode } from '../../types';

/** One stop on a trip, already resolved from airport or city. */
export interface BookStop {
  name: string;
  iso2: Alpha2 | null;
  latitude: number;
  longitude: number;
}

export interface BookTrip {
  journey: FlightJourney;
  /** "Sofia to Lisbon" or "Sofia to Tokyo and back". */
  title: string;
  dateLabel: string | null;
  stops: BookStop[];
  /** Every country the trip touched, in route order, home excluded. */
  countries: Alpha2[];
  /** Countries this trip reached for the first time in the whole book. */
  newCountries: Alpha2[];
  distanceKm: number;
  modes: TravelMode[];
  /** Legs that carry a photo, in leg order. */
  photoLegIds: number[];
  notes: string | null;
}

export interface BookChapter {
  key: string;
  /** Null for the "Somewhere in time" chapter. */
  year: number | null;
  title: string;
  trips: BookTrip[];
  countries: Alpha2[];
  newCountries: Alpha2[];
  distanceKm: number;
}

export interface BookData {
  ownerName: string | null;
  chapters: BookChapter[];
  totals: {
    trips: number;
    distanceKm: number;
    countries: number;
    firstYear: number | null;
    lastYear: number | null;
  };
  /** Alpha-2 -> display name, for stamps and captions. */
  countryNames: Record<string, string>;
}

/**
 * Every page in the book, in reading order. Page components take these as
 * plain props (no owner-only hooks), so a future shared book can render the
 * same pages from a public payload.
 */
export type BookPage =
  | { kind: 'cover' }
  | { kind: 'intro' }
  | { kind: 'contents'; entries: { chapter: BookChapter; page: number }[] }
  | { kind: 'chapter-title'; chapter: BookChapter }
  | { kind: 'chapter-stamps'; chapter: BookChapter }
  | { kind: 'trip-route'; trip: BookTrip; chapter: BookChapter }
  | { kind: 'trip-story'; trip: BookTrip; chapter: BookChapter }
  | { kind: 'the-end' }
  | { kind: 'next-chapter' }
  | { kind: 'back-cover' };
