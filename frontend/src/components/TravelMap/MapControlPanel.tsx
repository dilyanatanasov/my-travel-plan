import { memo, type ReactNode } from 'react';
import type { Country, Airport } from '../../types';
import type { FlightFilters } from '../FlightMap/filterTypes';
import { DEFAULT_FILTERS, DISTANCE_RANGES, ROUTE_TYPES } from '../FlightMap/filterTypes';
import { ALL_CONTINENTS, type Continent } from '../FlightMap/continentUtils';
import { countActiveFilters } from '../FlightMap/filterUtils';

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
  /** Controlled: the map hides the legend and zoom buttons while this is open
   *  on small screens, where an expanded panel would otherwise cover them. */
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

// 44px minimum touch target; text-base stops iOS zooming the page on focus.
const selectClass =
  'select-field map-glass-field min-h-11 w-full text-base sm:text-sm border rounded-lg pl-3 ' +
  'focus:outline-none focus:ring-2 focus:ring-brand-400';

const fieldLabelClass = 'block text-xs font-medium map-glass-muted mb-1';

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
    // inline-flex so the labels size to their text and wrap naturally instead
    // of being squeezed into equal grid columns.
    <label className="map-glass-hover inline-flex items-center gap-2 min-h-11 px-2 rounded-lg cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="w-4 h-4 flex-shrink-0 text-brand-600 rounded focus:ring-brand-500"
      />
      <span className="text-sm text-slate-200 select-none">{children}</span>
    </label>
  );
}

/**
 * Layer toggles, home country and flight filters behind a single disclosure.
 *
 * Previously these were two always-open bars totalling roughly 570px on a
 * phone, pushing the map itself below the fold. The legend lives in the map corner instead (MapLegend) — it is reference
 * material, not a control.
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
  isOpen,
  onOpenChange,
}: MapControlPanelProps) {
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
    <div className="map-glass rounded-xl border shadow-xl overflow-hidden flex flex-col">
      {/* Header stays put; only the content below it scrolls. */}
      <button
        type="button"
        onClick={() => onOpenChange(!isOpen)}
        aria-expanded={isOpen}
        aria-controls="map-control-panel"
        className="map-glass-hover flex-shrink-0 w-full flex items-center justify-between gap-2 min-h-12 px-4 py-2 text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-400"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-slate-100">
          <svg
            className="w-4 h-4 text-slate-400"
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
          {/* Shortened below sm: the full label wrapped once the badge and
              chevron took their share of a 390px row. */}
          <span className="whitespace-nowrap">
            <span className="sm:hidden">Layers &amp; filters</span>
            <span className="hidden sm:inline">Map layers &amp; filters</span>
          </span>
          {activeCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-brand-600 text-white text-xs font-semibold">
              {activeCount}
            </span>
          )}
        </span>
        <svg
          className={`w-5 h-5 text-slate-400 transition-transform flex-shrink-0 ${
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
        // Capped and scrollable, with a visible bar. Left uncapped the open
        // panel ran most of the height of a phone and sat over the legend and
        // zoom controls.
        <div
          id="map-control-panel"
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain scrollbar-thin max-h-[38vh] sm:max-h-[42vh] lg:max-h-[55vh] px-4 pb-3 space-y-3 border-t border-white/10"
        >
          {/* Layers + home country, each on its own full-width row: sharing a
              two-column grid left the toggle labels about 76px wide. */}
          <div className="space-y-2 pt-2">
            <div>
              <span className={fieldLabelClass}>Show on map</span>
              <div className="flex flex-wrap gap-x-2 -mx-2">
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
            <div className="space-y-2 pt-2 border-t border-white/10">
              {/*
                Two grids, not one five-across row. The panel now floats over
                the map at a fixed ~30rem, so five columns left every select
                about 75px wide — unreadable. Airport names need the room;
                the three short selects are fine three-up.
              */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              </div>

              {/* The three short selects, three-up */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                            ? 'bg-brand-500 text-white border-brand-500'
                            : 'map-glass-field hover:border-brand-400'
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

    </div>
  );
}

export default memo(MapControlPanel);
