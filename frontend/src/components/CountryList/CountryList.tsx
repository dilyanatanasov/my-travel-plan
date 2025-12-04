import type { Visit } from '../../types';

interface CountryListProps {
  visits: Visit[];
  isLoading: boolean;
  onRemove: (visitId: number) => void;
}

function CountryList({ visits, isLoading, onRemove }: CountryListProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Visited Countries</h2>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-12 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">
          Visited Countries
          <span className="ml-2 text-sm font-normal text-gray-500">
            ({visits.length})
          </span>
        </h2>
      </div>

      {visits.length === 0 ? (
        <div className="p-6 text-center text-gray-500">
          <p>No countries visited yet.</p>
          <p className="text-sm mt-1">Click on a country on the map to add it!</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-200 max-h-[400px] overflow-y-auto">
          {visits.map((visit) => (
            <li
              key={visit.id}
              className="px-6 py-4 flex items-center justify-between hover:bg-gray-50"
            >
              <div>
                <p className="font-medium text-gray-900">{visit.country.name}</p>
                {visit.visitedAt && (
                  <p className="text-sm text-gray-500">
                    Visited: {new Date(visit.visitedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
              <button
                onClick={() => onRemove(visit.id)}
                className="text-red-600 hover:text-red-800 text-sm font-medium transition-colors"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default CountryList;
