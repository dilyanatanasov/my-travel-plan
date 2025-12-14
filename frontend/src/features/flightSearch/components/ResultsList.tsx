import { FlightResultDto } from '../../../types';
import FlightCard from './FlightCard';

interface ResultsListProps {
  results: FlightResultDto[];
  isLoading: boolean;
  totalResults: number;
}

export const ResultsList: React.FC<ResultsListProps> = ({
  results,
  isLoading,
  totalResults,
}) => {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white rounded-lg shadow-md p-4 animate-pulse"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="space-y-2">
                <div className="h-6 bg-gray-200 rounded w-24"></div>
                <div className="h-4 bg-gray-200 rounded w-32"></div>
              </div>
              <div className="space-y-2 text-right">
                <div className="h-6 bg-gray-200 rounded w-24"></div>
                <div className="h-4 bg-gray-200 rounded w-32"></div>
              </div>
            </div>
            <div className="flex justify-between items-center pt-4 border-t border-gray-200">
              <div className="h-8 bg-gray-200 rounded w-20"></div>
              <div className="h-10 bg-gray-200 rounded w-24"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8 text-center">
        <svg
          className="w-16 h-16 mx-auto text-gray-400 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No flights found
        </h3>
        <p className="text-gray-600">
          Try adjusting your search criteria or filters to find available flights.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600 mb-2">
        Showing {results.length} of {totalResults} results
      </div>
      {results.map((flight) => (
        <FlightCard key={flight.itineraryId} flight={flight} />
      ))}
    </div>
  );
};

export default ResultsList;
