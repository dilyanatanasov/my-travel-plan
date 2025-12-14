import { FilterOptionsDto, FilterStatsDto, SortOption } from '../../../types';

interface FilterPanelProps {
  filterStats: FilterStatsDto | null;
  filters: FilterOptionsDto;
  onFiltersChange: (filters: FilterOptionsDto) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
}

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'price_asc', label: 'Price (Low-High)' },
  { value: 'price_desc', label: 'Price (High-Low)' },
  { value: 'duration_asc', label: 'Duration (Short-Long)' },
  { value: 'duration_desc', label: 'Duration (Long-Short)' },
  { value: 'departure_asc', label: 'Departure (Early-Late)' },
  { value: 'departure_desc', label: 'Departure (Late-Early)' },
  { value: 'stops_asc', label: 'Stops (Fewest)' },
];

export const FilterPanel: React.FC<FilterPanelProps> = ({
  filterStats,
  filters,
  onFiltersChange,
  sortBy,
  onSortChange,
}) => {
  const handleStopsChange = (maxStops: number | undefined) => {
    const newFilters = { ...filters };
    if (maxStops === undefined) {
      delete newFilters.maxStops;
    } else {
      newFilters.maxStops = maxStops;
    }
    onFiltersChange(newFilters);
  };

  const handlePriceChange = (field: 'minPrice' | 'maxPrice', value: string) => {
    const numValue = value === '' ? undefined : Number(value);
    const newFilters = { ...filters };
    if (numValue === undefined) {
      delete newFilters[field];
    } else {
      newFilters[field] = numValue;
    }
    onFiltersChange(newFilters);
  };

  const handleAirlineToggle = (airlineCode: string, checked: boolean) => {
    const currentAirlines = filters.airlines || [];
    let newAirlines: string[];

    if (checked) {
      newAirlines = [...currentAirlines, airlineCode];
    } else {
      newAirlines = currentAirlines.filter((code) => code !== airlineCode);
    }

    const newFilters = { ...filters };
    if (newAirlines.length === 0) {
      delete newFilters.airlines;
    } else {
      newFilters.airlines = newAirlines;
    }
    onFiltersChange(newFilters);
  };

  const handleMaxDurationChange = (value: string) => {
    const numValue = value === '' ? undefined : Number(value);
    const newFilters = { ...filters };
    if (numValue === undefined) {
      delete newFilters.maxDurationMinutes;
    } else {
      newFilters.maxDurationMinutes = numValue;
    }
    onFiltersChange(newFilters);
  };

  const handleClearFilters = () => {
    onFiltersChange({});
  };

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Helper to get count for a specific stop value
  const getStopCount = (stops: number): number => {
    if (!filterStats?.stopCounts) return 0;
    const found = filterStats.stopCounts.find((sc) => sc.stops === stops);
    return found?.count || 0;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 space-y-6">
      {/* Sort Dropdown */}
      <div>
        <label className="font-medium text-gray-900 mb-2 block">Sort by</label>
        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as SortOption)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Stops Filter */}
      {filterStats && filterStats.stopCounts && filterStats.stopCounts.length > 0 && (
        <div>
          <div className="font-medium text-gray-900 mb-2">Stops</div>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="radio"
                name="stops"
                checked={filters.maxStops === undefined}
                onChange={() => handleStopsChange(undefined)}
                className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <span className="ml-2 text-gray-700">Any</span>
            </label>
            {getStopCount(0) > 0 && (
              <label className="flex items-center">
                <input
                  type="radio"
                  name="stops"
                  checked={filters.maxStops === 0}
                  onChange={() => handleStopsChange(0)}
                  className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span className="ml-2 text-gray-700">Direct only ({getStopCount(0)})</span>
              </label>
            )}
            {getStopCount(1) > 0 && (
              <label className="flex items-center">
                <input
                  type="radio"
                  name="stops"
                  checked={filters.maxStops === 1}
                  onChange={() => handleStopsChange(1)}
                  className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span className="ml-2 text-gray-700">Up to 1 stop ({getStopCount(0) + getStopCount(1)})</span>
              </label>
            )}
            {filterStats.stopCounts.some((sc) => sc.stops >= 2) && (
              <label className="flex items-center">
                <input
                  type="radio"
                  name="stops"
                  checked={filters.maxStops === 2}
                  onChange={() => handleStopsChange(2)}
                  className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span className="ml-2 text-gray-700">Up to 2 stops</span>
              </label>
            )}
          </div>
        </div>
      )}

      {/* Price Range */}
      {filterStats && (
        <div>
          <div className="font-medium text-gray-900 mb-2">
            Price Range (${filterStats.minPrice} - ${filterStats.maxPrice})
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Min</label>
              <input
                type="number"
                min={filterStats.minPrice}
                max={filterStats.maxPrice}
                value={filters.minPrice ?? ''}
                onChange={(e) => handlePriceChange('minPrice', e.target.value)}
                placeholder={`$${filterStats.minPrice}`}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Max</label>
              <input
                type="number"
                min={filterStats.minPrice}
                max={filterStats.maxPrice}
                value={filters.maxPrice ?? ''}
                onChange={(e) => handlePriceChange('maxPrice', e.target.value)}
                placeholder={`$${filterStats.maxPrice}`}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Airlines Filter */}
      {filterStats && filterStats.airlines && filterStats.airlines.length > 0 && (
        <div>
          <div className="font-medium text-gray-900 mb-2">Airlines</div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {filterStats.airlines.map((airline) => (
              <label key={airline.code} className="flex items-center">
                <input
                  type="checkbox"
                  checked={filters.airlines?.includes(airline.code) || false}
                  onChange={(e) => handleAirlineToggle(airline.code, e.target.checked)}
                  className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <span className="ml-2 text-gray-700 text-sm">
                  {airline.name} ({airline.count})
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Duration Filter */}
      {filterStats && filterStats.maxDuration > 0 && (
        <div>
          <div className="font-medium text-gray-900 mb-2">Max Duration</div>
          <input
            type="range"
            min={filterStats.minDuration}
            max={filterStats.maxDuration}
            step={30}
            value={filters.maxDurationMinutes ?? filterStats.maxDuration}
            onChange={(e) => handleMaxDurationChange(e.target.value)}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <div className="flex justify-between text-sm text-gray-600 mt-1">
            <span>{formatDuration(filterStats.minDuration)}</span>
            <span className="font-medium text-blue-600">
              {formatDuration(filters.maxDurationMinutes ?? filterStats.maxDuration)}
            </span>
            <span>{formatDuration(filterStats.maxDuration)}</span>
          </div>
        </div>
      )}

      {/* Clear Filters Button */}
      <button
        onClick={handleClearFilters}
        className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors font-medium"
      >
        Clear Filters
      </button>
    </div>
  );
};

export default FilterPanel;
