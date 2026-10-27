import type { Alpha2, Country, FlightJourney, TravelMode } from '../../types';
import { legEndpoints, legMode } from '../../components/FlightMap/routeUtils';
import { formatJourneyDate } from '../../utils/journeyDate';
import type { BookChapter, BookData, BookPage, BookStop, BookTrip } from './types';

export const UNDATED_CHAPTER_TITLE = 'Somewhere in time';

interface BuildBookInput {
  journeys: FlightJourney[];
  countries: Country[];
  photoLegIds: number[];
  /** Alpha-2 of the home country; never stamped, never counted. */
  homeIso2?: string | null;
  ownerName?: string | null;
}

/**
 * Year of a journey, read from the string itself. journeyDate is a plain
 * "YYYY-MM-DD"; going through Date would shift 1 Jan into the previous year
 * for anyone west of UTC.
 */
export function journeyYear(journey: FlightJourney): number | null {
  if (!journey.journeyDate) return null;
  const year = Number(journey.journeyDate.slice(0, 4));
  return Number.isFinite(year) && year > 0 ? year : null;
}

/**
 * Book order: oldest first. Inside a year, year-only trips open the
 * chapter (we only know the year), then by date, then the user's own
 * sortIndex tie-break. Undated trips go last, by sortIndex.
 */
export function compareJourneys(a: FlightJourney, b: FlightJourney): number {
  const ya = journeyYear(a);
  const yb = journeyYear(b);
  if (ya === null || yb === null) {
    if (ya !== yb) return ya === null ? 1 : -1;
    return a.sortIndex - b.sortIndex;
  }
  if (ya !== yb) return ya - yb;
  const yearOnlyA = a.datePrecision === 'year';
  const yearOnlyB = b.datePrecision === 'year';
  if (yearOnlyA !== yearOnlyB) return yearOnlyA ? -1 : 1;
  const byDate = (a.journeyDate ?? '').localeCompare(b.journeyDate ?? '');
  if (byDate !== 0) return byDate;
  return a.sortIndex - b.sortIndex;
}

function distanceBetween(a: BookStop, b: BookStop): number {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** The stops of a journey in travel order, via legEndpoints (flight and land). */
export function tripStops(journey: FlightJourney): BookStop[] {
  const legs = [...(journey.legs ?? [])].sort((a, b) => a.legOrder - b.legOrder);
  const stops: BookStop[] = [];
  for (const leg of legs) {
    const endpoints = legEndpoints(leg);
    if (!endpoints) continue;
    for (const place of [endpoints.departure, endpoints.arrival]) {
      const stop: BookStop = {
        name: place.city || place.name,
        iso2: place.countryIso ?? null,
        latitude: Number(place.latitude),
        longitude: Number(place.longitude),
      };
      const previous = stops[stops.length - 1];
      // A leg starts where the previous one ended; keep each stop once.
      if (previous && previous.name === stop.name) continue;
      stops.push(stop);
    }
  }
  return stops;
}

/** "Sofia to Lisbon", or "Sofia to Tokyo and back" when it comes home. */
export function tripTitle(stops: BookStop[], isRoundTrip: boolean): string {
  if (stops.length === 0) return 'A journey';
  const origin = stops[0];
  const last = stops[stops.length - 1];
  if (stops.length === 1) return origin.name;
  const returnsHome = isRoundTrip || last.name === origin.name;
  if (!returnsHome) return `${origin.name} to ${last.name}`;
  // The turnaround is the stop farthest from where the trip began.
  const farthest = stops.reduce((best, stop) =>
    distanceBetween(origin, stop) > distanceBetween(origin, best) ? stop : best,
  );
  return `${origin.name} to ${farthest.name} and back`;
}

export function buildBook({
  journeys,
  countries,
  photoLegIds,
  homeIso2,
  ownerName,
}: BuildBookInput): BookData {
  const photoSet = new Set(photoLegIds);
  const countryNames: Record<string, string> = {};
  for (const country of countries) countryNames[country.isoCode2] = country.name;

  const seen = new Set<string>();
  const chapters: BookChapter[] = [];
  const allCountries = new Set<string>();
  let totalKm = 0;

  for (const journey of [...journeys].sort(compareJourneys)) {
    const stops = tripStops(journey);
    const tripCountries: Alpha2[] = [];
    for (const stop of stops) {
      if (!stop.iso2 || stop.iso2 === homeIso2) continue;
      if (!tripCountries.includes(stop.iso2)) tripCountries.push(stop.iso2);
    }
    const newCountries = tripCountries.filter((iso) => !seen.has(iso));
    newCountries.forEach((iso) => seen.add(iso));
    tripCountries.forEach((iso) => allCountries.add(iso));

    const legs = [...(journey.legs ?? [])].sort((a, b) => a.legOrder - b.legOrder);
    const modes: TravelMode[] = [];
    for (const leg of legs) {
      const mode = legMode(leg);
      if (!modes.includes(mode)) modes.push(mode);
    }
    const distanceKm = legs.reduce((sum, leg) => sum + (Number(leg.distanceKm) || 0), 0);
    totalKm += distanceKm;

    const trip: BookTrip = {
      journey,
      title: tripTitle(stops, journey.isRoundTrip),
      dateLabel: formatJourneyDate(journey, 'long'),
      stops,
      countries: tripCountries,
      newCountries,
      distanceKm,
      modes,
      photoLegIds: legs.filter((leg) => photoSet.has(leg.id)).map((leg) => leg.id),
      notes: journey.notes?.trim() || null,
    };

    const year = journeyYear(journey);
    const key = year === null ? 'undated' : String(year);
    let chapter = chapters[chapters.length - 1];
    if (!chapter || chapter.key !== key) {
      chapter = {
        key,
        year,
        title: year === null ? UNDATED_CHAPTER_TITLE : String(year),
        trips: [],
        countries: [],
        newCountries: [],
        distanceKm: 0,
      };
      chapters.push(chapter);
    }
    chapter.trips.push(trip);
    chapter.distanceKm += distanceKm;
    for (const iso of tripCountries) {
      if (!chapter.countries.includes(iso)) chapter.countries.push(iso);
    }
    chapter.newCountries.push(...newCountries);
  }

  const years = chapters.map((c) => c.year).filter((y): y is number => y !== null);
  return {
    ownerName: ownerName ?? null,
    chapters,
    totals: {
      trips: journeys.length,
      distanceKm: totalKm,
      countries: allCountries.size,
      firstYear: years.length ? Math.min(...years) : null,
      lastYear: years.length ? Math.max(...years) : null,
    },
    countryNames,
  };
}

/**
 * Lay the book out as pages. The layout keeps every trip on a real spread
 * (route on the left, story on the right): the cover stands alone, then
 * everything comes in pairs, then the back cover stands alone. That makes
 * the page count always even, which the flip shell relies on (each leaf
 * has a front and a back).
 */
export function buildPages(book: BookData): BookPage[] {
  const pages: BookPage[] = [{ kind: 'cover' }, { kind: 'intro' }];
  const contents: { kind: 'contents'; entries: { chapter: BookChapter; page: number }[] } = {
    kind: 'contents',
    entries: [],
  };
  pages.push(contents);

  for (const chapter of book.chapters) {
    contents.entries.push({ chapter, page: pages.length });
    pages.push({ kind: 'chapter-title', chapter }, { kind: 'chapter-stamps', chapter });
    for (const trip of chapter.trips) {
      pages.push({ kind: 'trip-route', trip, chapter }, { kind: 'trip-story', trip, chapter });
    }
  }

  pages.push({ kind: 'the-end' }, { kind: 'next-chapter' }, { kind: 'back-cover' });
  return pages;
}
