import { useState, useEffect, useRef } from 'react';
import { useLazySearchAirportsQuery } from '../../features/flights/flightsApi';
import type { Airport } from '../../types';

interface AirportSearchProps {
  value: Airport | null;
  onChange: (airport: Airport | null) => void;
  placeholder?: string;
  disabled?: boolean;
  excludeIds?: number[];
}

function AirportSearch({
  value,
  onChange,
  placeholder = 'Search airport...',
  disabled = false,
  excludeIds = [],
}: AirportSearchProps) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const [triggerSearch, { data: airports = [], isFetching }] =
    useLazySearchAirportsQuery();

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Trigger search when debounced value changes
  useEffect(() => {
    if (debouncedSearch.length >= 2) {
      triggerSearch(debouncedSearch);
    }
  }, [debouncedSearch, triggerSearch]);

  const filteredAirports = airports.filter(
    (airport) => !excludeIds.includes(airport.id)
  );

  const handleSelect = (airport: Airport) => {
    onChange(airport);
    setSearch('');
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setSearch('');
    inputRef.current?.focus();
  };

  const displayValue = value
    ? `${value.iataCode} - ${value.city || value.name}`
    : search;

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
          className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
            disabled ? 'bg-gray-100 cursor-not-allowed' : ''
          } ${value ? 'pr-8' : ''}`}
        />
        {value && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 text-gray-400 hover:text-gray-600"
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
        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {isFetching ? (
            <div className="px-4 py-3 text-gray-500 text-sm">Searching...</div>
          ) : filteredAirports.length === 0 ? (
            <div className="px-4 py-3 text-gray-500 text-sm">
              No airports found
            </div>
          ) : (
            filteredAirports.slice(0, 15).map((airport) => (
              <button
                key={airport.id}
                type="button"
                onClick={() => handleSelect(airport)}
                className="w-full px-4 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-0"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-mono font-semibold text-blue-600">
                      {airport.iataCode}
                    </span>
                    <span className="ml-2 text-gray-900">{airport.name}</span>
                  </div>
                </div>
                <div className="text-sm text-gray-500">
                  {airport.city}, {airport.country}
                </div>
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

export default AirportSearch;
