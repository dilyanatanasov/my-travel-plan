import { Link } from 'react-router-dom';
import BrandMark from '../../../components/BrandMark';
import CountryFlag from '../../../components/ui/CountryFlag';
import { ModeIcon } from '../../../components/ui/ModeIcon';
import MapExportCanvas from '../../../components/TravelMap/MapExportCanvas';
import { legPhotoUrl } from '../../flights/legPhoto';
import { formatJourneyDate } from '../../../utils/journeyDate';
import type { BookChapter, BookData, BookPage, BookTrip } from '../types';
import type { FlipBookApi } from './FlipBook';
import BookPageFrame from './BookPageFrame';
import FlagBackdrop from './FlagBackdrop';
import PassportStamp from './PassportStamp';

const EARTH_KM = 40075;

function km(value: number): string {
  return `${Math.round(value).toLocaleString()} km`;
}

function plural(count: number, one: string, many = `${one}s`): string {
  return `${count.toLocaleString()} ${count === 1 ? one : many}`;
}

/** Small caps eyebrow used across the book. */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-ink-subtle">{children}</p>
  );
}

function Rule() {
  return <div className="h-px w-16 bg-ink/20 my-4" />;
}

function BigStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="font-display text-[34px] leading-none text-brand-text">{value}</p>
      <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-ink-muted">{label}</p>
    </div>
  );
}

// --- Covers -------------------------------------------------------------------

function CoverPage({ book, side }: { book: BookData; side: PageSide }) {
  const { totals, ownerName } = book;
  const years =
    totals.firstYear === null
      ? null
      : totals.firstYear === totals.lastYear
        ? String(totals.firstYear)
        : `${totals.firstYear} - ${totals.lastYear}`;
  return (
    <BookPageFrame side={side} variant="cover">
      <div className="h-full flex flex-col items-center justify-center text-center px-14">
        <BrandMark className="w-12 h-12 opacity-90" />
        <p className="mt-8 text-[11px] uppercase tracking-[0.4em] opacity-80">Travel book</p>
        <h2 className="mt-4 font-display text-[40px] leading-[1.1]">
          {ownerName ? `${ownerName}'s travels` : 'My travels'}
        </h2>
        {years && <p className="mt-4 font-serif text-lg tracking-widest opacity-90">{years}</p>}
        <div className="mt-10 h-px w-24 bg-binding-foil/50" />
        <p className="mt-6 text-[12px] uppercase tracking-[0.25em] opacity-80">
          {plural(totals.countries, 'country', 'countries')} &middot; {plural(totals.trips, 'journey')}
        </p>
      </div>
    </BookPageFrame>
  );
}

function BackCoverPage({ side }: { side: PageSide }) {
  return (
    <BookPageFrame side={side} variant="cover">
      <div className="h-full flex flex-col items-center justify-end pb-20 text-center">
        <BrandMark className="w-8 h-8 opacity-70" />
        <p className="mt-3 font-display text-lg opacity-80">myContrail</p>
        <p className="mt-1 text-[11px] tracking-[0.2em] uppercase opacity-60">You leave a trail. See it.</p>
      </div>
    </BookPageFrame>
  );
}

// --- Front matter -------------------------------------------------------------

function IntroPage({ book, side, number }: PageProps) {
  const allFlags = Object.keys(
    Object.fromEntries(book.chapters.flatMap((c) => c.countries).map((iso) => [iso, true])),
  );
  const laps = book.totals.distanceKm / EARTH_KM;
  return (
    <BookPageFrame side={side} pageNumber={number} backdrop={<FlagBackdrop flags={allFlags} variant="collage" area="bottom" />}>
      <div className="h-full flex flex-col px-14 pt-16">
        <Eyebrow>This book belongs to</Eyebrow>
        <p className="mt-3 font-display text-[30px] leading-tight">{book.ownerName ?? 'a traveller'}</p>
        <Rule />
        <div className="grid grid-cols-2 gap-x-6 gap-y-7 mt-2">
          <BigStat value={book.totals.trips.toLocaleString()} label="Journeys" />
          <BigStat value={book.totals.countries.toLocaleString()} label="Countries" />
          <BigStat value={Math.round(book.totals.distanceKm).toLocaleString()} label="Kilometres" />
          <BigStat value={laps >= 0.1 ? `${laps.toFixed(1)}x` : '-'} label="Around the Earth" />
        </div>
      </div>
    </BookPageFrame>
  );
}

function ContentsPage({
  side,
  number,
  entries,
  api,
}: PageProps & { entries: { chapter: BookChapter; page: number }[] }) {
  const dense = entries.length > 12;
  return (
    <BookPageFrame side={side} pageNumber={number}>
      <div className="h-full flex flex-col px-14 pt-16 pb-14">
        <Eyebrow>Contents</Eyebrow>
        <Rule />
        {entries.length === 0 ? (
          <p className="font-serif italic text-ink-muted text-[15px] leading-relaxed">
            The pages are still blank. Add your first journey and the first chapter writes itself.
          </p>
        ) : (
          <ol className={dense ? 'grid grid-cols-2 gap-x-6' : ''}>
            {entries.map(({ chapter, page }, i) => (
              <li key={chapter.key}>
                <button
                  type="button"
                  onClick={() => api.goTo(page)}
                  className={[
                    'w-full flex items-baseline gap-2 text-left rounded hover:text-brand-text focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                    dense ? 'py-1 text-[13px]' : 'py-2 text-[16px]',
                  ].join(' ')}
                >
                  {!dense && <span className="text-[11px] text-ink-subtle tabular-nums w-5">{i + 1}</span>}
                  <span className="font-serif">{chapter.title}</span>
                  <span className="flex-1 border-b border-dotted border-ink/30 translate-y-[-4px]" />
                  <span className="text-[12px] text-ink-muted tabular-nums">{page}</span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>
    </BookPageFrame>
  );
}

// --- Chapters -----------------------------------------------------------------

function ChapterTitlePage({ book, chapter, side, number }: PageProps & { chapter: BookChapter }) {
  const index = book.chapters.indexOf(chapter) + 1;
  return (
    <BookPageFrame side={side} pageNumber={number} backdrop={<FlagBackdrop flags={chapter.countries} variant="corner" corner="top-right" />}>
      <div className="h-full flex flex-col justify-center items-center text-center px-12">
        <Eyebrow>Chapter {index}</Eyebrow>
        <h2
          className={[
            'font-display leading-none mt-5 text-brand-text',
            chapter.year === null ? 'text-[42px] leading-tight' : 'text-[96px]',
          ].join(' ')}
        >
          {chapter.title}
        </h2>
        <div className="h-px w-16 bg-ink/20 my-6" />
        <p className="font-serif text-[15px] text-ink-muted leading-relaxed">
          {plural(chapter.trips.length, 'journey')}
          {chapter.newCountries.length > 0 && <> &middot; {plural(chapter.newCountries.length, 'new country', 'new countries')}</>}
          <br />
          {km(chapter.distanceKm)}
        </p>
      </div>
    </BookPageFrame>
  );
}

function ChapterStampsPage({ book, chapter, side, number }: PageProps & { chapter: BookChapter }) {
  const firstTrip = new Map<string, BookTrip>();
  for (const trip of chapter.trips) for (const iso of trip.newCountries) firstTrip.set(iso, trip);
  const stamps = chapter.newCountries.slice(0, 9);
  const more = chapter.newCountries.length - stamps.length;
  return (
    <BookPageFrame side={side} pageNumber={number}>
      <div className="h-full flex flex-col px-12 pt-16 pb-14">
        <Eyebrow>{stamps.length > 0 ? 'New stamps' : 'Familiar places'}</Eyebrow>
        <Rule />
        {stamps.length > 0 ? (
          <>
            <div className="grid grid-cols-3 gap-x-3 gap-y-5 justify-items-center mt-2">
              {stamps.map((iso) => {
                const trip = firstTrip.get(iso);
                const date = trip ? formatJourneyDate(trip.journey, 'short')?.toUpperCase() ?? null : null;
                return <PassportStamp key={iso} iso2={iso} name={book.countryNames[iso] ?? iso} date={date} size={104} />;
              })}
            </div>
            {more > 0 && <p className="mt-auto font-serif italic text-ink-muted text-[14px]">and {more} more inside</p>}
          </>
        ) : (
          <>
            <p className="font-serif italic text-ink-muted text-[15px] leading-relaxed">
              No new countries this time. Some places are worth going back to.
            </p>
            <ul className="mt-6 space-y-2">
              {chapter.countries.slice(0, 10).map((iso) => (
                <li key={iso} className="flex items-center gap-3 text-[14px]">
                  <CountryFlag iso2={iso} />
                  {book.countryNames[iso] ?? iso}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </BookPageFrame>
  );
}

// --- Trips --------------------------------------------------------------------

function TripRoutePage({ trip, side, number }: PageProps & { trip: BookTrip }) {
  /*
    Each stop once, in the order first reached, and the way home as one
    final step: a round trip with layovers otherwise lists every airport
    twice and the line runs off the page.
  */
  const route: string[] = [];
  for (const stop of trip.stops) if (!route.includes(stop.name)) route.push(stop.name);
  const origin = trip.stops[0]?.name;
  const last = trip.stops[trip.stops.length - 1]?.name;
  if (route.length > 1 && origin && last === origin) route.push(origin);
  return (
    <BookPageFrame side={side} pageNumber={number} backdrop={<FlagBackdrop flags={trip.countries} variant="corner" corner="bottom-right" />}>
      <div className="h-full flex flex-col px-11 pt-14 pb-14">
        <Eyebrow>{trip.dateLabel ?? 'Undated'}</Eyebrow>
        <h3 className="mt-3 font-display text-[28px] leading-[1.15]">{trip.title}</h3>
        {/* The same trip map the boarding-pass share uses, drawn in place. */}
        <div className="mt-5 h-[220px] -mx-2 rounded-md overflow-hidden border border-ink/10 bg-surface-sunken">
          <MapExportCanvas inline journey={trip.journey} height={930} svgId={`book-trip-${trip.journey.id}`} />
        </div>
        <p className="mt-5 font-serif text-[14px] leading-relaxed text-ink-muted">
          {route.join(' - ')}
        </p>
        <div className="mt-auto flex items-end justify-between">
          <div className="flex gap-6">
            <div>
              <p className="font-display text-[22px] leading-none text-brand-text">{Math.round(trip.distanceKm).toLocaleString()}</p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-ink-muted">km</p>
            </div>
            <div>
              <p className="font-display text-[22px] leading-none text-brand-text">{trip.journey.legs.length}</p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-ink-muted">
                {trip.journey.legs.length === 1 ? 'leg' : 'legs'}
              </p>
            </div>
          </div>
          <div className="flex gap-2 text-ink-muted" aria-label={`Travelled by ${trip.modes.join(', ')}`}>
            {trip.modes.map((mode) => (
              <ModeIcon key={mode} mode={mode} className="w-5 h-5" />
            ))}
          </div>
        </div>
      </div>
    </BookPageFrame>
  );
}

/** Postcard positions for one, two or three photos. */
const POSTCARD_LAYOUTS: { top: number; left: number; width: number; rotate: number }[][] = [
  [{ top: 0, left: 24, width: 300, rotate: -2 }],
  [
    { top: 0, left: 8, width: 230, rotate: -4 },
    { top: 70, left: 140, width: 220, rotate: 3 },
  ],
  [
    { top: 0, left: 4, width: 190, rotate: -5 },
    { top: 18, left: 168, width: 180, rotate: 4 },
    { top: 120, left: 70, width: 200, rotate: -1 },
  ],
];

function TripStoryPage({ book, trip, side, number }: PageProps & { trip: BookTrip }) {
  const photos = trip.photoLegIds.slice(0, 3);
  const layout = POSTCARD_LAYOUTS[photos.length - 1];
  const empty = photos.length === 0 && !trip.notes;
  return (
    <BookPageFrame
      side={side}
      pageNumber={number}
      backdrop={<FlagBackdrop flags={trip.countries} variant="corner" corner="bottom-left" />}
    >
      <div className="h-full flex flex-col px-11 pt-14 pb-14">
        {photos.length > 0 && (
          <div className="relative h-[290px]">
            {photos.map((legId, i) => (
              <figure
                key={legId}
                className="absolute bg-white p-2 pb-6 shadow-md"
                style={{
                  top: layout[i].top,
                  left: layout[i].left,
                  width: layout[i].width,
                  transform: `rotate(${layout[i].rotate}deg)`,
                }}
              >
                {/* Tape */}
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 w-14 h-4 bg-brand-200/70 rotate-[-3deg]" />
                <img
                  src={legPhotoUrl(legId)}
                  alt=""
                  loading="lazy"
                  draggable={false}
                  className="w-full aspect-[4/3] object-cover bg-surface-sunken"
                />
              </figure>
            ))}
          </div>
        )}

        {trip.notes && (
          <p
            className={[
              'font-serif italic text-[15px] leading-[1.7] text-ink whitespace-pre-line',
              photos.length > 0 ? 'mt-6 line-clamp-5' : 'mt-2 line-clamp-[14]',
            ].join(' ')}
          >
            {trip.notes}
          </p>
        )}

        {empty && (
          <div className="mt-2">
            <Eyebrow>Countries on this journey</Eyebrow>
            <Rule />
            <ul className="space-y-2.5">
              {trip.countries.slice(0, 8).map((iso) => (
                <li key={iso} className="flex items-center gap-3 text-[15px] font-serif">
                  <CountryFlag iso2={iso} className="!w-6" />
                  {book.countryNames[iso] ?? iso}
                </li>
              ))}
              {trip.countries.length === 0 && (
                <li className="font-serif italic text-ink-muted text-[15px]">Close to home this time.</li>
              )}
            </ul>
            <p className="mt-8 font-serif italic text-ink-subtle text-[13px] leading-relaxed">
              Photos and notes you add to this journey will appear on this page.
            </p>
          </div>
        )}

        {trip.newCountries.length > 0 && (
          <div className="mt-auto flex justify-end gap-1 -mr-2">
            {trip.newCountries.slice(0, 3).map((iso) => (
              <PassportStamp
                key={iso}
                iso2={iso}
                name={book.countryNames[iso] ?? iso}
                date={formatJourneyDate(trip.journey, 'short')?.toUpperCase() ?? null}
                size={92}
              />
            ))}
          </div>
        )}
      </div>
    </BookPageFrame>
  );
}

// --- Back matter --------------------------------------------------------------

function TheEndPage({ book, side, number }: PageProps) {
  const laps = book.totals.distanceKm / EARTH_KM;
  return (
    <BookPageFrame side={side} pageNumber={number}>
      <div className="h-full flex flex-col justify-center px-14">
        <Eyebrow>The story so far</Eyebrow>
        <Rule />
        <p className="font-serif text-[17px] leading-[1.8] text-ink">
          {book.totals.trips === 0 ? (
            <>Every travel book starts with an empty page. This one is waiting for its first journey.</>
          ) : (
            <>
              {plural(book.totals.trips, 'journey')}, {plural(book.totals.countries, 'country', 'countries')} and{' '}
              {km(book.totals.distanceKm)}
              {laps >= 0.1 && <>, which is {laps.toFixed(1)} times around the Earth</>}.
            </>
          )}
        </p>
      </div>
    </BookPageFrame>
  );
}

function NextChapterPage({ side, number }: PageProps) {
  return (
    <BookPageFrame side={side} pageNumber={number}>
      <div className="h-full flex flex-col px-14 pt-16 pb-14">
        <Eyebrow>Next chapter</Eyebrow>
        <Rule />
        {/* Blank ruled lines: the page is literally waiting. */}
        <div className="space-y-7 mt-4" aria-hidden="true">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="h-px bg-ink/10" />
          ))}
        </div>
        <Link
          to="/search"
          className="mt-auto self-start inline-flex items-center gap-2 min-h-11 px-4 rounded-lg bg-secondary-600 text-white text-[14px] font-medium hover:bg-secondary-700"
        >
          Where to next?
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </Link>
      </div>
    </BookPageFrame>
  );
}

// --- Dispatcher ---------------------------------------------------------------

type PageSide = 'left' | 'right' | 'single';

interface PageProps {
  book: BookData;
  side: PageSide;
  number: number;
  api: FlipBookApi;
}

/** Render one page of the book. Pure: everything comes in through props. */
export function BookPageView({ page, ...props }: PageProps & { page: BookPage }) {
  switch (page.kind) {
    case 'cover':
      return <CoverPage book={props.book} side={props.side} />;
    case 'intro':
      return <IntroPage {...props} />;
    case 'contents':
      return <ContentsPage {...props} entries={page.entries} />;
    case 'chapter-title':
      return <ChapterTitlePage {...props} chapter={page.chapter} />;
    case 'chapter-stamps':
      return <ChapterStampsPage {...props} chapter={page.chapter} />;
    case 'trip-route':
      return <TripRoutePage {...props} trip={page.trip} />;
    case 'trip-story':
      return <TripStoryPage {...props} trip={page.trip} />;
    case 'the-end':
      return <TheEndPage {...props} />;
    case 'next-chapter':
      return <NextChapterPage {...props} />;
    case 'back-cover':
      return <BackCoverPage side={props.side} />;
  }
}
