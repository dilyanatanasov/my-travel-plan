import { useState, useEffect, useRef } from 'react';
import { useLazySearchCitiesQuery } from '../../features/cities/citiesApi';
import type { CityRef } from '../../types';

interface CitySearchProps {
  value: CityRef | null;
  onChange: (city: CityRef | null) => void;
  placeholder?: string;
  disabled?: boolean;
  excludeIds?: number[];
}

/**
 * The city twin of AirportSearch, for land-travel endpoints: same
 * debounce, same open/clear behaviour, so a mixed-mode chain feels like
 * one form rather than two grafted ones.
 */
function CitySearch({
  value,
  onChange,
  placeholder = 'Search city...',
  disabled = false,
  excludeIds = [],
}: CitySearchProps) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const [triggerSearch, { data: cities = [], isFetching }] =
    useLazySearchCitiesQuery();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (debouncedSearch.length >= 2) {
      triggerSearch(debouncedSearch);
    }
  }, [debouncedSearch, triggerSearch]);

  const filteredCities = cities.filter(
    (city) => !excludeIds.includes(city.id),
  );

  const handleSelect = (city: CityRef) => {
    onChange(city);
    setSearch('');
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setSearch('');
    inputRef.current?.focus();
  };

  const displayValue = value ? `${value.name} (${value.countryIso})` : search;

  return (
    <div className="relative">
      <div className="flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={(e) => {
            if (value) {
              onChange(null);
            }
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (!value) setIsOpen(true);
          }}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full min-h-11 px-3 border border-line rounded-lg bg-surface text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent ${
            disabled ? 'bg-surface-sunken cursor-not-allowed' : ''
          } ${value ? 'pr-8' : ''}`}
        />
        {value && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 text-ink-subtle hover:text-ink-muted"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {isOpen && !value && search.length >= 2 && (
        <div className="absolute z-20 w-full mt-1 bg-surface border border-line rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {isFetching ? (
            <div className="px-4 py-3 text-ink-muted text-sm">Searching...</div>
          ) : filteredCities.length === 0 ? (
            <div className="px-4 py-3 text-ink-muted text-sm">
              No cities found
            </div>
          ) : (
            filteredCities.slice(0, 10).map((city) => (
              <button
                key={city.id}
                type="button"
                onClick={() => handleSelect(city)}
                className="w-full px-4 py-2 text-left hover:bg-surface-sunken border-b border-line last:border-0"
              >
                <span className="font-medium text-ink">{city.name}</span>
                <span className="ml-2 text-sm text-ink-muted">
                  {city.countryIso}
                </span>
                {/* Greece really does have three towns called Stavrós, and
                    without a size they render as three identical rows that
                    read like duplicates (owner report, 2026-08-21). Size is
                    the only field the dataset gives us to tell them apart,
                    and the list is already ranked by it. */}
                {(city.population ?? 0) > 0 && (
                  <span className="ml-2 text-xs text-ink-subtle tabular-nums">
                    {(city.population ?? 0).toLocaleString()} people
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}

      {isOpen && !value && (
        <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
      )}
    </div>
  );
}

export default CitySearch;
