import { useEffect, useMemo, useRef, useState } from 'react';
import type { Alpha3, Country, LonLatTuple } from '../../types';
import { useSearchAirportsQuery } from '../../features/flights/flightsApi';

export interface SearchTarget {
  center: [number, number];
  zoom: number;
  /** Set when the hit was a country, so the map can open its card. */
  isoCode?: Alpha3;
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
  target: SearchTarget;
}

const MAX_HITS = 6;

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

  const hits = useMemo<Hit[]>(() => {
    const term = query.trim().toLowerCase();
    if (term.length < 2) return [];

    const results: Hit[] = [];

    for (const country of countries) {
      if (results.length >= MAX_HITS) break;
      if (!country.name.toLowerCase().includes(term)) continue;
      const centroid = countryCentroids.get(country.isoCode);
      if (!centroid) continue;
      results.push({
        key: `c-${country.id}`,
        label: country.name,
        detail: 'Country',
        // Countries vary hugely in size; 2.5 frames a mid-sized one without
        // burying a small one in ocean.
        target: { center: centroid, zoom: 2.5, isoCode: country.isoCode },
      });
    }

    for (const airport of airports) {
      if (results.length >= MAX_HITS) break;
      const haystack = `${airport.iataCode} ${airport.city ?? ''} ${airport.name}`.toLowerCase();
      if (!haystack.includes(term)) continue;
      results.push({
        key: `a-${airport.id}`,
        label: airport.iataCode,
        detail: [airport.city, airport.country].filter(Boolean).join(', ') || airport.name,
        // Same string-from-Postgres problem as fitBounds; see the note there.
        target: {
          center: [Number(airport.longitude), Number(airport.latitude)],
          zoom: 4.5,
        },
      });
    }

    return results;
  }, [query, countries, airports, countryCentroids]);



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
          placeholder="Find a country or airport"
          aria-label="Find a country or airport"
          role="combobox"
          aria-expanded={isOpen && hits.length > 0}
          aria-controls="map-search-results"
          /* text-base stops iOS zooming the page when the field takes focus. */
          className="flex-1 min-w-0 min-h-11 bg-transparent text-base sm:text-sm focus:outline-none"
        />
      </div>

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
