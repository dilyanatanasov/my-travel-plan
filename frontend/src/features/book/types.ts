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
  /** A few sentences written from the trip's own data (see tripStory). */
  story: string;
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
  /** Every stamp ever collected, in first-visit order. */
  passport: PassportEntry[];
  /** Alpha-2 -> display name, for stamps and captions. */
  countryNames: Record<string, string>;
}

/** One stamp in the passport: a country and the trip that first reached it. */
export interface PassportEntry {
  iso2: Alpha2;
  /** Short stamp date, e.g. "MAY 2023"; null for undated trips. */
  date: string | null;
}

/** A line in the table of contents. */
export interface ContentsEntry {
  key: string;
  title: string;
  page: number;
}

/**
 * Every page in the book, in reading order. Page components take these as
 * plain props (no owner-only hooks), so a future shared book can render the
 * same pages from a public payload.
 */
export type BookPage =
  | { kind: 'cover' }
  | { kind: 'intro' }
  | { kind: 'contents'; entries: ContentsEntry[] }
  | { kind: 'chapter-title'; chapter: BookChapter }
  | { kind: 'chapter-stamps'; chapter: BookChapter }
  | { kind: 'trip-route'; trip: BookTrip; chapter: BookChapter }
  | { kind: 'trip-story'; trip: BookTrip; chapter: BookChapter }
  | { kind: 'passport-title' }
  | {
      kind: 'passport';
      /** The stamps on this page, then `emptySlots` dotted rings. */
      stamps: PassportEntry[];
      emptySlots: number;
      /** 1-based page of the passport and how many there are. */
      sheet: number;
      sheets: number;
    }
  | { kind: 'the-end' }
  | { kind: 'next-chapter' }
  | { kind: 'back-cover' };
