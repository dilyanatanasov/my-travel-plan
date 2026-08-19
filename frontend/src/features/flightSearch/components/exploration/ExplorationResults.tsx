import { useState } from 'react';
import type { FlightExplorationResultDto } from '../../../../types';
import ModeIcon from '../../../../components/ui/ModeIcon';
import HighlightCards from './HighlightCards';
import InsightsPanel from './InsightsPanel';
import FlightOptionCard from './FlightOptionCard';

interface ExplorationResultsProps {
  results: FlightExplorationResultDto;
}

type ViewMode = 'highlights' | 'byDate' | 'byRoute' | 'all';

function ExplorationResults({ results }: ExplorationResultsProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('highlights');
  const [expandedDateGroup, setExpandedDateGroup] = useState<string | null>(null);
  const [expandedRouteGroup, setExpandedRouteGroup] = useState<string | null>(null);

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="space-y-6">
      {/* Search Summary */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">
              {results.origin} → {results.destination}
            </h2>
            <p className="text-sm text-gray-600">
              {results.dateRange.from} to {results.dateRange.to}
              {results.duration.minNights > 0 && (
                <> • {results.duration.minNights}-{results.duration.maxNights} nights</>
              )}
              {' '}• {results.passengers} traveler{results.passengers > 1 ? 's' : ''}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">
              {results.meta.totalOptionsFound} options found
            </p>
            <p className="text-xs text-gray-500">
              {results.meta.searchesPerformed} dates searched in {(results.meta.searchDurationMs / 1000).toFixed(1)}s
            </p>
          </div>
        </div>
      </div>

      {/* Insights */}
      {results.insights.length > 0 && (
        <InsightsPanel insights={results.insights} />
      )}

      {/* View Mode Tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { value: 'highlights', label: 'Highlights' },
          { value: 'byDate', label: 'By Date' },
          { value: 'byRoute', label: 'By Route' },
          { value: 'all', label: `All Results (${results.allOptions.length})` },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setViewMode(tab.value as ViewMode)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === tab.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content based on view mode */}
      {viewMode === 'highlights' && (
        <HighlightCards highlights={results.highlights} />
      )}

      {viewMode === 'byDate' && (
        <div className="space-y-4">
          {results.byDate.map((group) => (
            <div key={group.startDate} className="bg-white rounded-lg shadow-md overflow-hidden">
              <button
                onClick={() => setExpandedDateGroup(
                  expandedDateGroup === group.startDate ? null : group.startDate
                )}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <svg
                    className="w-5 h-5 text-gray-500 flex-shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    aria-hidden="true"
                  >
                    <rect x="3" y="5" width="18" height="16" rx="2" />
                    <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
                  </svg>
                  <div className="text-left">
                    <p className="font-medium text-gray-800">{group.dateRange}</p>
                    <p className="text-sm text-gray-600">
                      {group.optionCount} options • Best: {formatDuration(group.bestDurationMinutes)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-semibold text-green-600">from ${group.lowestPrice.toFixed(0)}</p>
                    <p className="text-xs text-gray-500">avg ${group.averagePrice.toFixed(0)}</p>
                  </div>
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${
                      expandedDateGroup === group.startDate ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {expandedDateGroup === group.startDate && (
                <div className="border-t border-gray-100 p-4 space-y-3">
                  {group.options.slice(0, 5).map((option) => (
                    <FlightOptionCard key={option.id} option={option} compact />
                  ))}
                  {group.options.length > 5 && (
                    <p className="text-sm text-gray-500 text-center">
                      +{group.options.length - 5} more options
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {viewMode === 'byRoute' && (
        <div className="space-y-4">
          {results.byRoute.map((group) => (
            <div key={group.routeDescription} className="bg-white rounded-lg shadow-md overflow-hidden">
              <button
                onClick={() => setExpandedRouteGroup(
                  expandedRouteGroup === group.routeDescription ? null : group.routeDescription
                )}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  {group.connectionAirports.length === 0 ? (
                    <ModeIcon
                      mode="flight"
                      className="w-5 h-5 text-gray-500 flex-shrink-0"
                    />
                  ) : (
                    <svg
                      className="w-5 h-5 text-gray-500 flex-shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      aria-hidden="true"
                    >
                      <path
                        d="M4 9a8 8 0 0 1 14-3.5M20 15a8 8 0 0 1-14 3.5M18 2v4h-4M6 22v-4h4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                  <div className="text-left">
                    <p className="font-medium text-gray-800">{group.routeDescription}</p>
                    <p className="text-sm text-gray-600">
                      {group.optionCount} options • Avg: {formatDuration(Math.round(group.averageDurationMinutes))}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <p className="font-semibold text-green-600">from ${group.lowestPrice.toFixed(0)}</p>
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${
                      expandedRouteGroup === group.routeDescription ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {expandedRouteGroup === group.routeDescription && (
                <div className="border-t border-gray-100 p-4 space-y-3">
                  {group.options.slice(0, 5).map((option) => (
                    <FlightOptionCard key={option.id} option={option} compact />
                  ))}
                  {group.options.length > 5 && (
                    <p className="text-sm text-gray-500 text-center">
                      +{group.options.length - 5} more options
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {viewMode === 'all' && (
        <div className="space-y-4">
          {results.allOptions.map((option) => (
            <FlightOptionCard key={option.id} option={option} />
          ))}
        </div>
      )}
    </div>
  );
}

export default ExplorationResults;
