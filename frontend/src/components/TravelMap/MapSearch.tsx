import { useEffect, useMemo, useRef, useState } from 'react';
import type { Alpha2, Alpha3, Country, LonLatTuple } from '../../types';
import { useSearchAirportsQuery } from '../../features/flights/flightsApi';
import { useSearchCitiesQuery } from '../../features/cities/citiesApi';
import { matchesGeoName } from '../../lib/geoNames';
import { fallbackCentroids } from './isoCodes';
import CountryFlag from '../ui/CountryFlag';

export interface SearchTarget {
  center: [number, number];
  zoom: number;
  /** Set when the hit was a country, so the map can open its card. */
  isoCode?: Alpha3;
  /** Set when the hit was an airport, so the map can ping the exact spot —
      searched airports often have no marker to point at. */
  airportLabel?: string;
}

interface MapSearchProps {
  countries: Country[];
  countryCentroids: Map<string, LonLatTuple>;
  onGo: (target: SearchTarget) => void;
}

interface Hit {
  key: string;
  label: string;
  detail: string;
  /** Alpha-2 for the row's flag: the country itself, or an airport's country. */
  iso2: Alpha2 | null;
  target: SearchTarget;
}

const MAX_HITS = 6;

/**
 * Diacritic-free lowercase, so "keramoti" scores against "Keramotí" as
 * the exact match it is. The city table stores both spellings but only
 * ships the native one, and typing accents on a phone is nobody's plan.
 */
const fold = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/**
 * How well a candidate answers the query: 0 exact, 1 prefix, 2 a word
 * inside the name, 3 anywhere at all. Names are checked in order and the
 * best one wins, so an airport is judged on whichever of its code, city
 * or full name matches best.
 */
export function matchTier(
  rawTerm: string,
  ...names: (string | null | undefined)[]
): number {
  const term = fold(rawTerm);
  let best = Number.POSITIVE_INFINITY;
  for (const raw of names) {
    if (!raw) continue;
    const name = fold(raw);
    if (name === term) return 0;
    if (name.startsWith(term)) best = Math.min(best, 1);
    else if (new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(name))
      best = Math.min(best, 2);
    else if (name.includes(term)) best = Math.min(best, 3);
  }
  return best;
}

/**
 * Fly the map to a country or airport.
 *
 * Panning to a specific place by hand is the least rewarding thing you can do
 * with a world map — you drag, overshoot, and zoom in stages. Typing three
 * letters and arriving is what makes the map feel like it is answering you.
 *
 * Countries need a centroid, which only the loaded geography knows, so
 * country hits appear once the map has drawn. Airports carry their own
 * coordinates and are searchable immediately.
 */
function MapSearch({ countries, countryCentroids, onGo }: MapSearchProps) {
  const [query, setQuery] = useState('');
  /*
    Debounced separately from the input, so typing does not fire a request per
    keystroke. 250ms is below the threshold where a search feels laggy.
  */
  const [debounced, setDebounced] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  /*
    Airports come from the server, not from the user's own flights.

    The first version searched only airports appearing in logged journeys,
    so looking up somewhere you had not yet been — the main reason to search
    a map — returned nothing at all. Rio and Buenos Aires simply did not
    exist until you had flown there.
  */
  const { data: airports = [] } = useSearchAirportsQuery(debounced, {
    skip: debounced.length < 2,
  });

  // Cities too (land travel, 2026-08-17): "plovdiv" should land the map
  // on Plovdiv whether or not an airport lives there. Same server-side
  // population ranking the journey form uses.
  const { data: cities = [] } = useSearchCitiesQuery(debounced, {
    skip: debounced.length < 2,
  });

  const hits = useMemo<Hit[]>(() => {
    const term = query.trim().toLowerCase();
    if (term.length < 2) return [];

    /*
      Collect every candidate with a match tier, then sort and trim
      (friend feedback, 2026-08-21: exact matches belong on top).

      The old version filled six rows strictly by type - countries, then
      airports, then cities - and stopped. So six airports with the term
      buried somewhere in their names crowded out the city you had typed
      the exact name of, and it never even reached the list. Ranking by
      how well each row answers the query fixes both halves: the exact
      hit rises, and nothing is dropped before it has been considered.

      Array.sort is stable, so rows of equal tier keep insertion order -
      which is the type preference this list always had: a country beats
      an airport beats a city when they answer the query equally well.

      The tier only decides how the three SOURCES interleave; it must
      never reshuffle a source internally, because both servers already
      rank better than a name comparison can. Airports weigh hub status,
      and cities weigh exactness against population - which is how "var"
      keeps Varanasi above the Iranian village literally called Vār. So
      each loop clamps its tiers to be non-decreasing: a later row can
      never outrank an earlier one, and a stable sort then preserves the
      server's order exactly.
    */
    const results: (Hit & { tier: number })[] = [];

    for (const country of countries) {
      // Abbreviation-aware: "n. mariana is." (the daily puzzle's spelling)
      // and "northern mariana" both find Northern Mariana Islands.
      if (!matchesGeoName(country.name, term)) continue;
      // Tuvalu is real even though the atlas has no polygon for it: the
      // static fallback keeps a country from vanishing from search just
      // because its atolls are too small to draw.
      const centroid =
        countryCentroids.get(country.isoCode) ??
        fallbackCentroids[country.isoCode];
      if (!centroid) continue;
      results.push({
        // matchesGeoName also accepts abbreviations the plain scorer
        // cannot see ("n. mariana is."), so a country that matched only
        // that way still lands mid-table rather than at the bottom.
        tier: Math.min(matchTier(term, country.name), 2),
        // "ct-", not "c-": cities used the same prefix, so a country and
        // a city sharing an id collided as React keys (2026-08-21).
        key: `ct-${country.id}`,
        label: country.name,
        detail: 'Country',
        iso2: country.isoCode2,
        // Countries vary hugely in size; 2.5 frames a mid-sized one without
        // burying a small one in ocean.
        target: { center: centroid, zoom: 2.5, isoCode: country.isoCode },
      });
    }

    let airportFloor = 0;
    for (const airport of airports) {
      const scored = matchTier(term, airport.iataCode, airport.city, airport.name);
      // Unranked means the term appears nowhere in this airport at all.
      if (!Number.isFinite(scored)) continue;
      // Clamped upward only, so the ranking the server sent survives.
      const tier = Math.max(airportFloor, Math.min(scored, 3));
      airportFloor = tier;
      results.push({
        tier,
        key: `a-${airport.id}`,
        label: airport.iataCode,
        detail: [airport.city, airport.country].filter(Boolean).join(', ') || airport.name,
        iso2: airport.countryIso,
        // Same string-from-Postgres problem as fitBounds; see the note there.
        target: {
          center: [Number(airport.longitude), Number(airport.latitude)],
          // Closer than the old 4.5: an airport is a point, so there is
          // nothing a tighter camera can crop.
          zoom: 6,
          airportLabel: airport.city
            ? `${airport.city} · ${airport.iataCode}`
            : airport.iataCode,
        },
      });
    }

    // Cities added last: an airport hit usually IS the city people mean,
    // so at equal match quality the airport keeps the higher row. A city
    // named exactly still outranks a loosely-matched airport.
    let cityFloor = 0;
    for (const cityHit of cities) {
      /*
        Say WHICH city (owner report, 2026-08-21). Greece has three
        towns called Stavrós and Monaco is both a country and a city, so
        a bare "City" made distinct places look like repeats. The
        country and the size make every row its own answer.
      */
      const cityCountry = countries.find(
        (country) => country.isoCode2 === cityHit.countryIso,
      );
      const cityTier = Math.max(
        cityFloor,
        Math.min(matchTier(term, cityHit.name), 3),
      );
      cityFloor = cityTier;
      results.push({
        tier: cityTier,
        key: `ci-${cityHit.id}`,
        label: cityHit.name,
        detail: [
          'City',
          cityCountry?.name,
          (cityHit.population ?? 0) > 0
            ? `${(cityHit.population ?? 0).toLocaleString()} people`
            : null,
        ]
          .filter(Boolean)
          .join(' · '),
        iso2: cityHit.countryIso,
        target: {
          center: [Number(cityHit.longitude), Number(cityHit.latitude)],
          zoom: 6,
          // The same landing ping airports get - a searched city often
          // has no marker of its own to point at.
          airportLabel: cityHit.name,
        },
      });
    }

    return results
      .sort((a, b) => a.tier - b.tier)
      .slice(0, MAX_HITS);
  }, [query, countries, airports, cities, countryCentroids]);



  useEffect(() => setActiveIndex(0), [query]);

  // Close on outside click, so the list never hangs over the map unattended.
  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [isOpen]);

  const go = (hit: Hit) => {
    onGo(hit.target);
    setQuery('');
    setIsOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setIsOpen(false);
      return;
    }
    if (!hits.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % hits.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => (i - 1 + hits.length) % hits.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      go(hits[activeIndex]);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="map-glass rounded-xl border shadow-lg flex items-center gap-2 px-3">
        <svg className="w-4 h-4 flex-shrink-0 map-glass-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 110-16 8 8 0 010 16z" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Find a country, city or airport"
          aria-label="Find a country, city or airport"
          role="combobox"
          aria-expanded={isOpen && hits.length > 0}
          aria-controls="map-search-results"
          /* text-base stops iOS zooming the page when the field takes focus. */
          className="flex-1 min-w-0 min-h-11 bg-transparent text-base sm:text-sm focus:outline-none"
        />
      </div>

      {/*
        A query that matches nothing gets an answer. Without this the list
        just did not appear, which is indistinguishable from the search being
        broken.
      */}
      {isOpen && query.trim().length >= 2 && hits.length === 0 && (
        <div className="map-glass absolute z-30 left-0 right-0 mt-1 rounded-xl border shadow-xl px-3 py-3">
          <p className="text-sm">No match for &ldquo;{query.trim()}&rdquo;</p>
          <p className="text-xs map-glass-muted mt-0.5">
            Try a country, a city name, or a three-letter airport code.
          </p>
        </div>
      )}

      {isOpen && hits.length > 0 && (
        <ul
          id="map-search-results"
          role="listbox"
          className="map-glass absolute z-30 left-0 right-0 mt-1 rounded-xl border shadow-xl overflow-hidden py-1"
        >
          {hits.map((hit, index) => (
            <li key={hit.key}>
              <button
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => go(hit)}
                className={`w-full text-left px-3 py-2 flex items-baseline gap-2 ${
                  index === activeIndex ? 'bg-current/10' : ''
                }`}
              >
                <CountryFlag iso2={hit.iso2} className="self-center" />
                <span className="font-medium text-sm">{hit.label}</span>
                <span className="text-xs map-glass-muted truncate">{hit.detail}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default MapSearch;
