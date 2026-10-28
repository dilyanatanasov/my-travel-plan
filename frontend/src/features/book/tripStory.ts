import type { FlightJourney, TravelMode } from '../../types';
import type { BookStop } from './types';

const EARTH_KM = 40075;

/** Great-circle distance in km. */
export function distanceBetween(a: BookStop, b: BookStop): number {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** What the book knows about a trip beyond the trip itself. */
export interface StoryContext {
  journey: FlightJourney;
  stops: BookStop[];
  distanceKm: number;
  modes: TravelMode[];
  /** Year of the trip; null when undated. */
  year: number | null;
  /** 0-based position in the whole book. */
  indexInBook: number;
  /** 0-based position in its chapter, and the chapter's size. */
  indexInChapter: number;
  chapterTrips: number;
  /** Countries reached for the first time on this trip (names). */
  newCountries: string[];
  /** Countries seen before, with the year of the first visit. */
  returns: { name: string; firstYear: number | null }[];
  /** Modes this trip uses for the first time in the book. */
  firstModes: TravelMode[];
  /** Longer than every trip before it (never true for the first). */
  longestYet: boolean;
  /** Home country name, for trips that never leave it. */
  homeName: string | null;
  /** The trip touched no country outside home. */
  domestic: boolean;
}

const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];

function ordinal(index: number): string {
  if (index < ORDINALS.length) return ORDINALS[index];
  const n = index + 1;
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
  return `${n}${suffix}`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/*
  Country names that read with "the" in a sentence: "your first time in
  the United States", "back in the Netherlands". Matched on the names the
  countries table uses.
*/
const NEEDS_THE =
  /^(United |Czech Republic|Central African|Dominican Republic|Democratic Republic|British Indian|French Southern|U\.S\. |Congo$)|(Islands|Bahamas|Comoros|Gambia|Maldives|Netherlands|Philippines|Seychelles)$/;

/** "the United States", "Japan". Lower-case "the": capitalize at a sentence start. */
export function withArticle(name: string): string {
  return NEEDS_THE.test(name) ? `the ${name}` : name;
}

/** "a", "a and b", "a, b and c". */
export function joinList(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

const MODE_NOUN: Record<TravelMode, string> = {
  flight: 'plane',
  train: 'train',
  car: 'car',
  bus: 'bus',
  ferry: 'ferry',
};

const COUNT_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

function countWord(n: number): string {
  return COUNT_WORDS[n] ?? String(n);
}

/** Month name from the "YYYY-MM-DD" string, without a timezone shift. */
function monthName(journey: FlightJourney): string | null {
  if (!journey.journeyDate || journey.datePrecision === 'year') return null;
  const month = Number(journey.journeyDate.slice(5, 7));
  if (!month) return null;
  return new Date(Date.UTC(2000, month - 1, 1)).toLocaleString('en', { month: 'long', timeZone: 'UTC' });
}

/** Stable per trip, so a page reads the same every time it opens. */
function pick<T>(seed: number, options: T[]): T {
  return options[Math.abs(seed) % options.length];
}

function opening(ctx: StoryContext): string {
  const { year, indexInBook, indexInChapter, chapterTrips } = ctx;
  const seed = ctx.journey.id;
  const month = monthName(ctx.journey);
  if (indexInBook === 0) {
    return pick(seed, ['This is where the book begins.', 'The first page of the story.']);
  }
  if (year === null) {
    return pick(seed, [
      'A journey without a date, but not without a story.',
      'The date is lost somewhere, the journey is not.',
    ]);
  }
  const when = month ? ` in ${month}` : '';
  if (chapterTrips === 1) return `${year} had one journey${when}, and this was it.`;
  if (indexInChapter === chapterTrips - 1) {
    return pick(seed, [`The last journey of ${year}${when}.`, `${year} closed with this one${when}.`]);
  }
  if (!month) return `The ${ordinal(indexInChapter)} journey of ${year}.`;
  return pick(seed, [
    `The ${ordinal(indexInChapter)} journey of ${year}${when}.`,
    `${month} ${year}, journey number ${indexInChapter + 1} of the year.`,
  ]);
}

function route(ctx: StoryContext): string | null {
  const { stops, distanceKm, modes, journey } = ctx;
  if (stops.length < 2) return null;
  const origin = stops[0];
  const last = stops[stops.length - 1];
  const comesHome = journey.isRoundTrip || last.name === origin.name;
  // The turnaround of a round trip is its farthest stop; "via" only covers the way out.
  let destIndex = stops.length - 1;
  if (comesHome) {
    let best = 0;
    stops.forEach((stop, i) => {
      if (distanceBetween(origin, stop) > distanceBetween(origin, stops[best])) best = i;
    });
    destIndex = best;
  }
  const dest = stops[destIndex];
  if (dest.name === origin.name) return null;
  const via: string[] = [];
  for (const stop of stops.slice(1, destIndex)) {
    if (stop.name !== origin.name && stop.name !== dest.name && !via.includes(stop.name)) via.push(stop.name);
  }
  const viaText = via.length === 0 ? '' : via.length <= 2 ? `, via ${joinList(via)}` : `, with ${countWord(via.length)} stops on the way`;
  const by = `by ${joinList(modes.map((m) => MODE_NOUN[m]))}`;
  const km = `${Math.round(distanceKm).toLocaleString('en')} km`;
  const home = comesHome ? ', and home again' : '';
  if (distanceKm <= 0) return `From ${origin.name} to ${dest.name}${viaText} ${by}${home}.`;
  return pick(ctx.journey.id >> 1, [
    `${km} ${by} from ${origin.name} to ${dest.name}${viaText}${home}.`,
    `From ${origin.name} to ${dest.name}${viaText}: ${km} ${by}${home}.`,
  ]);
}

function highlight(ctx: StoryContext): string | null {
  const seed = ctx.journey.id;
  const fresh = ctx.newCountries.map(withArticle);
  if (fresh.length === 1) {
    return pick(seed, [`Your first time in ${fresh[0]}.`, `${capitalize(fresh[0])} went into the passport for the first time.`]);
  }
  if (fresh.length > 1) {
    const shown = fresh.slice(0, 3);
    const more = fresh.length - shown.length;
    const list = more > 0 ? `${shown.join(', ')} and ${more} more` : joinList(shown);
    return `${capitalize(countWord(fresh.length))} new stamps in one go: ${list}.`;
  }
  if (ctx.longestYet) {
    return pick(seed, ['Your longest journey yet.', 'The farthest the book had gone so far.']);
  }
  if (ctx.firstModes.length > 0 && ctx.indexInBook > 0) {
    return `The first time the book travels by ${joinList(ctx.firstModes.map((m) => MODE_NOUN[m]))}.`;
  }
  const back = ctx.returns[0] && { ...ctx.returns[0], name: withArticle(ctx.returns[0].name) };
  if (back) {
    if (back.firstYear !== null && back.firstYear === ctx.year) return `Back in ${back.name} again, the same year.`;
    if (back.firstYear !== null) return `Back in ${back.name}, first visited in ${back.firstYear}.`;
    return `Back in ${back.name} once more.`;
  }
  if (ctx.domestic) {
    return ctx.homeName ? `A journey at home, in ${withArticle(ctx.homeName)}.` : 'A journey close to home.';
  }
  const share = ctx.distanceKm / EARTH_KM;
  if (share >= 0.05) return `That is ${Math.round(share * 100)}% of the way around the Earth.`;
  return null;
}

/**
 * A short paragraph about one trip, written from its data (travel book v2,
 * 2026-10-28), so a trip without photos or notes still has something to
 * say. Two or three sentences: when it was, the route, one highlight.
 */
export function tripStory(ctx: StoryContext): string {
  return [opening(ctx), route(ctx), highlight(ctx)].filter(Boolean).join(' ');
}
