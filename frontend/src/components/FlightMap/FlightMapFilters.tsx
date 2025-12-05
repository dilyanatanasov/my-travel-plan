import { memo } from 'react';
import type { Airport } from '../../types';
import type { FlightFilters } from './filterTypes';
import { DEFAULT_FILTERS, DISTANCE_RANGES, ROUTE_TYPES } from './filterTypes';
import { ALL_CONTINENTS, type Continent } from './continentUtils';
import { countActiveFilters } from './filterUtils';

interface FlightMapFiltersProps {
  filters: FlightFilters;
  onFiltersChange: (filters: FlightFilters) => void;
  airports: Airport[];
  years: number[];
}

function FlightMapFilters({
  filters,
  onFiltersChange,
  airports,
  years,
}: FlightMapFiltersProps) {
  const activeCount = countActiveFilters(filters);

  const handleOriginChange = (value: string) => {
    onFiltersChange({
      ...filters,
      originAirport: value || null,
    });
  };

  const handleDestinationChange = (value: string) => {
    onFiltersChange({
      ...filters,
      destinationAirport: value || null,
    });
  };

  const handleContinentToggle = (continent: Continent) => {
    const newContinents = filters.continents.includes(continent)
      ? filters.continents.filter((c) => c !== continent)
      : [...filters.continents, continent];
    onFiltersChange({
      ...filters,
      continents: newContinents,
    });
  };

  const handleYearChange = (value: string) => {
    onFiltersChange({
      ...filters,
      year: value ? parseInt(value, 10) : null,
    });
  };

  const handleDistanceChange = (value: string) => {
    onFiltersChange({
      ...filters,
      distanceRange: value as FlightFilters['distanceRange'],
    });
  };

  const handleRouteTypeChange = (value: string) => {
    onFiltersChange({
      ...filters,
      routeType: value as FlightFilters['routeType'],
    });
  };

  const clearFilters = () => {
    onFiltersChange(DEFAULT_FILTERS);
  };

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="flex items-center gap-4 flex-wrap">
        {/* Origin Airport */}
        <div className="flex flex-col">
          <label className="text-xs text-gray-500 mb-1">Origin</label>
          <select
            value={filters.originAirport || ''}
            onChange={(e) => handleOriginChange(e.target.value)}
            className="text-sm border border-gray-300 rounded px-2 py-1.5 bg-white min-w-[140px]"
          >
            <option value="">All origins</option>
            {airports.map((airport) => (
              <option key={`origin-${airport.iataCode}`} value={airport.iataCode}>
                {airport.iataCode} - {airport.city}
              </option>
            ))}
          </select>
        </div>

        {/* Destination Airport */}
        <div className="flex flex-col">
          <label className="text-xs text-gray-500 mb-1">Destination</label>
          <select
            value={filters.destinationAirport || ''}
            onChange={(e) => handleDestinationChange(e.target.value)}
            className="text-sm border border-gray-300 rounded px-2 py-1.5 bg-white min-w-[140px]"
          >
            <option value="">All destinations</option>
            {airports.map((airport) => (
              <option key={`dest-${airport.iataCode}`} value={airport.iataCode}>
                {airport.iataCode} - {airport.city}
              </option>
            ))}
          </select>
        </div>

        {/* Continent Multi-select */}
        <div className="flex flex-col">
          <label className="text-xs text-gray-500 mb-1">Continents</label>
          <div className="flex gap-1 flex-wrap">
            {ALL_CONTINENTS.map((continent) => (
              <button
                key={continent}
                onClick={() => handleContinentToggle(continent)}
                className={`text-xs px-2 py-1 rounded border transition-colors ${
                  filters.continents.includes(continent)
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-blue-300'
                }`}
              >
                {continent.replace(' America', '')}
              </button>
            ))}
          </div>
        </div>

        {/* Year */}
        <div className="flex flex-col">
          <label className="text-xs text-gray-500 mb-1">Year</label>
          <select
            value={filters.year || ''}
            onChange={(e) => handleYearChange(e.target.value)}
            className="text-sm border border-gray-300 rounded px-2 py-1.5 bg-white min-w-[90px]"
          >
            <option value="">All years</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        {/* Distance Range */}
        <div className="flex flex-col">
          <label className="text-xs text-gray-500 mb-1">Distance</label>
          <select
            value={filters.distanceRange}
            onChange={(e) => handleDistanceChange(e.target.value)}
            className="text-sm border border-gray-300 rounded px-2 py-1.5 bg-white min-w-[120px]"
          >
            {DISTANCE_RANGES.map((range) => (
              <option key={range.value} value={range.value}>
                {range.label}
              </option>
            ))}
          </select>
        </div>

        {/* Route Type */}
        <div className="flex flex-col">
          <label className="text-xs text-gray-500 mb-1">Route Type</label>
          <select
            value={filters.routeType}
            onChange={(e) => handleRouteTypeChange(e.target.value)}
            className="text-sm border border-gray-300 rounded px-2 py-1.5 bg-white min-w-[120px]"
          >
            {ROUTE_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {/* Clear Filters */}
        {activeCount > 0 && (
          <div className="flex flex-col justify-end">
            <button
              onClick={clearFilters}
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 mt-4"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
              Clear ({activeCount})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(FlightMapFilters);
