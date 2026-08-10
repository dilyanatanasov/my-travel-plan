import { memo, useState, type ReactNode } from 'react';
import type { Country, Airport } from '../../types';
import type { FlightFilters } from '../FlightMap/filterTypes';
import { DEFAULT_FILTERS, DISTANCE_RANGES, ROUTE_TYPES } from '../FlightMap/filterTypes';
import { ALL_CONTINENTS, type Continent } from '../FlightMap/continentUtils';
import { countActiveFilters } from '../FlightMap/filterUtils';
import { COUNTRY_COLORS } from './countryColors';

export interface TravelMapSettings {
  showCountries: boolean;
  showFlights: boolean;
  showAirports: boolean;
}

interface MapControlPanelProps {
  settings: TravelMapSettings;
  onSettingsChange: (settings: TravelMapSettings) => void;
  countries: Country[];
  homeCountryId: number | null;
  onSetHomeCountry: (countryId: number) => void;
  filters: FlightFilters;
  onFiltersChange: (filters: FlightFilters) => void;
  airports: Airport[];
  years: number[];
  stats: {
    visitedCount: number;
    transitCount: number;
    totalCountries: number;
    flightRoutes: number;
    airports: number;
  };
}

// 44px minimum touch target; text-base stops iOS zooming the page on focus.
const selectClass =
  'min-h-11 w-full text-base sm:text-sm border border-gray-300 rounded-lg px-3 ' +
  'bg-white focus:outline-none focus:ring-2 focus:ring-brand-500';

const fieldLabelClass = 'block text-xs font-medium text-gray-500 mb-1';

/** Checkbox stays 16px visually, but the whole 44px-tall label is the hit area. */
function ToggleRow({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: () => void;
  children: ReactNode;
}) {
  return (
    <label className="flex items-center gap-2 min-h-11 px-2 -mx-2 rounded-lg cursor-pointer hover:bg-gray-50">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="w-4 h-4 flex-shrink-0 text-brand-600 rounded focus:ring-brand-500"
      />
      <span className="text-sm text-gray-700 select-none">{children}</span>
    </label>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="w-3 h-3 rounded flex-shrink-0"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <span className="text-gray-600">{label}</span>
    </div>
  );
}

/**
 * Layer toggles, home country and flight filters behind a single disclosure.
 *
 * Previously these were two always-open bars totalling roughly 570px on a
 * phone, pushing the map itself below the fold. The legend stays outside the
 * disclosure because it explains the map rather than controlling it.
 */
function MapControlPanel({
  settings,
  onSettingsChange,
  countries,
  homeCountryId,
  onSetHomeCountry,
  filters,
  onFiltersChange,
  airports,
  years,
  stats,
}: MapControlPanelProps) {
  // Open by default on desktop, collapsed on phones. Evaluated once: flipping
  // this on every resize would fight the user's own toggling.
  const [isOpen, setIsOpen] = useState(() =>
    typeof window === 'undefined' ? true : window.innerWidth >= 768
  );

  const activeCount = countActiveFilters(filters);

  const handleToggle = (key: keyof TravelMapSettings) => {
    onSettingsChange({ ...settings, [key]: !settings[key] });
  };

  const handleContinentToggle = (continent: Continent) => {
    onFiltersChange({
      ...filters,
      continents: filters.continents.includes(continent)
        ? filters.continents.filter((c) => c !== continent)
        : [...filters.continents, continent],
    });
  };

  return (
    <div className="border-b border-gray-200">
      {/* Disclosure header */}
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls="map-control-panel"
        className="w-full flex items-center justify-between gap-2 min-h-12 px-4 py-2 text-left hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-500"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <svg
            className="w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
          Map layers &amp; filters
          {activeCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-brand-600 text-white text-xs font-semibold">
              {activeCount}
            </span>
          )}
        </span>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div
          id="map-control-panel"
          className="px-4 pb-3 space-y-3 border-t border-gray-100"
        >
          {/* Layers + home country */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-2 pt-2">
            <div>
              <span className={fieldLabelClass}>Show on map</span>
              {/* Stacked on phones where width is scarce, inline everywhere
                  else so the open panel stays short on desktop. */}
              <div className="grid grid-cols-1 sm:grid-cols-3 sm:gap-2">
                <ToggleRow
                  checked={settings.showCountries}
                  onChange={() => handleToggle('showCountries')}
                >
                  Countries
                </ToggleRow>
                <ToggleRow
                  checked={settings.showFlights}
                  onChange={() => handleToggle('showFlights')}
                >
                  Flight routes
                </ToggleRow>
                <ToggleRow
                  checked={settings.showAirports}
                  onChange={() => handleToggle('showAirports')}
                >
                  Airports
                </ToggleRow>
              </div>
            </div>

            <div>
              <label htmlFor="home-country" className={fieldLabelClass}>
                Home country
              </label>
              <select
                id="home-country"
                value={homeCountryId || ''}
                onChange={(e) => {
                  const id = parseInt(e.target.value, 10);
                  if (id) onSetHomeCountry(id);
                }}
                className={selectClass}
              >
                <option value="">Select home country</option>
                {countries.map((country) => (
                  <option key={country.id} value={country.id}>
                    {country.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Flight filters, only meaningful when routes are shown */}
          {settings.showFlights && (
            <div className="space-y-2 pt-2 border-t border-gray-100">
              {/* Five columns at lg so every filter fits on one row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div>
                  <label htmlFor="filter-origin" className={fieldLabelClass}>
                    Origin
                  </label>
                  <select
                    id="filter-origin"
                    value={filters.originAirport || ''}
                    onChange={(e) =>
                      onFiltersChange({
                        ...filters,
                        originAirport: e.target.value || null,
                      })
                    }
                    className={selectClass}
                  >
                    <option value="">All origins</option>
                    {airports.map((airport) => (
                      <option key={`o-${airport.iataCode}`} value={airport.iataCode}>
                        {airport.iataCode} – {airport.city}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="filter-destination" className={fieldLabelClass}>
                    Destination
                  </label>
                  <select
                    id="filter-destination"
                    value={filters.destinationAirport || ''}
                    onChange={(e) =>
                      onFiltersChange({
                        ...filters,
                        destinationAirport: e.target.value || null,
                      })
                    }
                    className={selectClass}
                  >
                    <option value="">All destinations</option>
                    {airports.map((airport) => (
                      <option key={`d-${airport.iataCode}`} value={airport.iataCode}>
                        {airport.iataCode} – {airport.city}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="filter-year" className={fieldLabelClass}>
                    Year
                  </label>
                  <select
                    id="filter-year"
                    value={filters.year || ''}
                    onChange={(e) =>
                      onFiltersChange({
                        ...filters,
                        year: e.target.value ? parseInt(e.target.value, 10) : null,
                      })
                    }
                    className={selectClass}
                  >
                    <option value="">All years</option>
                    {years.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="filter-distance" className={fieldLabelClass}>
                    Distance
                  </label>
                  <select
                    id="filter-distance"
                    value={filters.distanceRange}
                    onChange={(e) =>
                      onFiltersChange({
                        ...filters,
                        distanceRange: e.target
                          .value as FlightFilters['distanceRange'],
                      })
                    }
                    className={selectClass}
                  >
                    {DISTANCE_RANGES.map((range) => (
                      <option key={range.value} value={range.value}>
                        {range.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="filter-route-type" className={fieldLabelClass}>
                    Route type
                  </label>
                  <select
                    id="filter-route-type"
                    value={filters.routeType}
                    onChange={(e) =>
                      onFiltersChange({
                        ...filters,
                        routeType: e.target.value as FlightFilters['routeType'],
                      })
                    }
                    className={selectClass}
                  >
                    {ROUTE_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <span className={fieldLabelClass}>Continents</span>
                <div className="flex flex-wrap gap-2">
                  {ALL_CONTINENTS.map((continent) => {
                    const isActive = filters.continents.includes(continent);
                    return (
                      <button
                        key={continent}
                        type="button"
                        onClick={() => handleContinentToggle(continent)}
                        aria-pressed={isActive}
                        className={`min-h-11 px-3 text-sm rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                          isActive
                            ? 'bg-brand-600 text-white border-brand-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:border-brand-400'
                        }`}
                      >
                        {continent}
                      </button>
                    );
                  })}
                </div>
              </div>

              {activeCount > 0 && (
                <button
                  type="button"
                  onClick={() => onFiltersChange(DEFAULT_FILTERS)}
                  className="min-h-11 text-sm text-brand-600 hover:text-brand-800 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 rounded-lg px-2 -mx-2"
                >
                  Clear all filters ({activeCount})
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Legend stays visible: it explains the map, it is not a control */}
      <div className="px-4 py-2.5 border-t border-gray-100 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
        <LegendSwatch color={COUNTRY_COLORS.home} label="Home" />
        <LegendSwatch color={COUNTRY_COLORS.trip} label="Visited" />
        <LegendSwatch color={COUNTRY_COLORS.transit} label="Transit" />
        {/* These two must mirror what the map actually draws, so they use the
            map tokens rather than the app accent. */}
        <div className="flex items-center gap-1.5">
          <span className="w-6 h-0.5 bg-map-route rounded" aria-hidden="true" />
          <span className="text-gray-600">Route</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="w-2.5 h-2.5 rounded-full bg-white border-2 border-slate-900"
            aria-hidden="true"
          />
          <span className="text-gray-600">Airport</span>
        </div>
        <span className="text-gray-400 w-full sm:w-auto sm:ml-auto">
          {stats.visitedCount} visited · {stats.transitCount} transit ·{' '}
          {stats.flightRoutes} routes · {stats.airports} airports
        </span>
      </div>
    </div>
  );
}

export default memo(MapControlPanel);
