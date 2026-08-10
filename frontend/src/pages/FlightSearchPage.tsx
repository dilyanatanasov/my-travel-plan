import { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { SearchForm, FilterPanel, ResultsList } from '../features/flightSearch/components';
import { FlexibleSearchForm, ExplorationResults } from '../features/flightSearch/components/exploration';
import { useSearchFlightsMutation, useExploreFlightsMutation } from '../features/flightSearch/flightSearchApi';
import type {
  SearchFlightsDto,
  FlexibleSearchDto,
  FilterOptionsDto,
  FlightSearchResultDto,
  FlightExplorationResultDto,
  SortOption,
} from '../types';

type SearchMode = 'specific' | 'explore';

function FlightSearchPage() {
  // Mode state
  const [searchMode, setSearchMode] = useState<SearchMode>('explore');

  // Specific search state
  const [searchFlights, { isLoading: isSearchLoading }] = useSearchFlightsMutation();
  const [searchResult, setSearchResult] = useState<FlightSearchResultDto | null>(null);
  const [currentSearchParams, setCurrentSearchParams] = useState<SearchFlightsDto | null>(null);
  const [filters, setFilters] = useState<FilterOptionsDto>({});
  const [sortBy, setSortBy] = useState<SortOption>('price_asc');

  // Exploration state
  const [exploreFlights, { isLoading: isExploreLoading }] = useExploreFlightsMutation();
  const [explorationResult, setExplorationResult] = useState<FlightExplorationResultDto | null>(null);

  // Common state
  const [error, setError] = useState<string | null>(null);

  // Specific search handler
  const handleSearch = useCallback(
    async (params: SearchFlightsDto) => {
      setError(null);
      setCurrentSearchParams(params);
      setFilters({});

      try {
        const result = await searchFlights({
          searchParams: params,
          sortBy,
        }).unwrap();
        setSearchResult(result);
      } catch (err) {
        console.error('Search failed:', err);
        setError('Failed to search for flights. Please try again.');
        setSearchResult(null);
      }
    },
    [searchFlights, sortBy]
  );

  // Exploration search handler
  const handleExplore = useCallback(
    async (params: FlexibleSearchDto) => {
      setError(null);
      setExplorationResult(null);

      try {
        const result = await exploreFlights(params).unwrap();
        setExplorationResult(result);
      } catch (err) {
        console.error('Exploration failed:', err);
        setError('Failed to explore flights. Please try again.');
      }
    },
    [exploreFlights]
  );

  // Re-search when filters or sort changes (for specific search)
  useEffect(() => {
    if (!currentSearchParams || searchMode !== 'specific') return;

    const performFilteredSearch = async () => {
      try {
        const result = await searchFlights({
          searchParams: {
            ...currentSearchParams,
            filters: Object.keys(filters).length > 0 ? filters : undefined,
          },
          sortBy,
        }).unwrap();
        setSearchResult(result);
      } catch (err) {
        console.error('Filter search failed:', err);
      }
    };

    performFilteredSearch();
  }, [filters, sortBy, currentSearchParams, searchFlights, searchMode]);

  const handleFiltersChange = useCallback((newFilters: FilterOptionsDto) => {
    setFilters(newFilters);
  }, []);

  const handleSortChange = useCallback((newSort: SortOption) => {
    setSortBy(newSort);
  }, []);

  const handleModeChange = (mode: SearchMode) => {
    setSearchMode(mode);
    setError(null);
  };

  const isLoading = searchMode === 'specific' ? isSearchLoading : isExploreLoading;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-blue-600 text-white py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-4">
            <Link
              to="/"
              className="text-blue-100 hover:text-white flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Travel Map
            </Link>
          </div>
          <h1 className="text-3xl font-bold">Flight Search</h1>
          <p className="text-blue-100 mt-2">
            Find and compare flights from multiple providers
          </p>
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="max-w-7xl mx-auto px-4 -mt-6">
        <div className="bg-white rounded-t-lg shadow-md">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => handleModeChange('explore')}
              className={`flex-1 py-4 px-6 text-center font-medium transition-colors relative ${
                searchMode === 'explore'
                  ? 'text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {/* Full label would wrap to three lines at 390px */}
                Explore
                <span className="hidden sm:inline">&nbsp;(Flexible Dates)</span>
              </div>
              {searchMode === 'explore' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
              )}
            </button>
            <button
              onClick={() => handleModeChange('specific')}
              className={`flex-1 py-4 px-6 text-center font-medium transition-colors relative ${
                searchMode === 'specific'
                  ? 'text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Specific Dates
              </div>
              {searchMode === 'specific' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Search Form */}
      <div className="max-w-7xl mx-auto px-4">
        <div className="bg-white rounded-b-lg shadow-md p-6 mb-6">
          {searchMode === 'explore' ? (
            <FlexibleSearchForm onSearch={handleExplore} isLoading={isExploreLoading} />
          ) : (
            <SearchForm onSearch={handleSearch} isLoading={isSearchLoading} />
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="max-w-7xl mx-auto px-4">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        </div>
      )}

      {/* Exploration Results */}
      {searchMode === 'explore' && explorationResult && (
        <div className="max-w-7xl mx-auto px-4 pb-8">
          <ExplorationResults results={explorationResult} />
        </div>
      )}

      {/* Specific Search Results */}
      {searchMode === 'specific' && searchResult && (
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Search Summary */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              {searchResult.origin} → {searchResult.destination}
            </h2>
            <p className="text-gray-600">
              {searchResult.departureDate}
              {searchResult.returnDate && ` - ${searchResult.returnDate}`}
              {' · '}
              {searchResult.passengers} passenger{searchResult.passengers !== 1 ? 's' : ''}
              {' · '}
              {searchResult.cabinClass.replace('_', ' ')}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Filter Panel */}
            <aside className="lg:col-span-1">
              <FilterPanel
                filterStats={searchResult.filterStats}
                filters={filters}
                onFiltersChange={handleFiltersChange}
                sortBy={sortBy}
                onSortChange={handleSortChange}
              />
            </aside>

            {/* Results List */}
            <main className="lg:col-span-3">
              <ResultsList
                results={searchResult.results}
                isLoading={isSearchLoading}
                totalResults={searchResult.totalResults}
              />
            </main>
          </div>
        </div>
      )}

      {/* Empty State - Before Search */}
      {!explorationResult && !searchResult && !isLoading && !error && (
        <div className="max-w-7xl mx-auto px-4 py-16 text-center">
          <svg
            className="w-24 h-24 mx-auto text-gray-300 mb-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
            />
          </svg>
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">
            {searchMode === 'explore' ? 'Explore Flight Options' : 'Search for Flights'}
          </h2>
          <p className="text-gray-500 max-w-md mx-auto">
            {searchMode === 'explore'
              ? 'Choose flexible dates or a month to discover the best flight deals. We\'ll search multiple dates and show you the best options.'
              : 'Enter your origin, destination, and travel dates above to find available flights.'}
          </p>
        </div>
      )}

      {/* Loading State for Exploration */}
      {searchMode === 'explore' && isExploreLoading && (
        <div className="max-w-7xl mx-auto px-4 py-16 text-center">
          <div className="animate-pulse">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-blue-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              Exploring flight options...
            </h2>
            <p className="text-gray-500">
              Searching multiple dates to find you the best deals. This may take a moment.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default FlightSearchPage;
