import type { Visit, VisitType } from '../../types';

interface CountryListProps {
  visits: Visit[];
  isLoading: boolean;
  onRemove: (visitId: number) => void;
  onUpdateVisitType?: (visitId: number, visitType: VisitType) => void;
}

const VISIT_TYPE_COLORS: Record<VisitType, { bg: string; text: string }> = {
  home: { bg: 'bg-purple-100', text: 'text-purple-700' },
  trip: { bg: 'bg-green-100', text: 'text-green-700' },
  transit: { bg: 'bg-orange-100', text: 'text-orange-700' },
};

const VISIT_TYPE_LABELS: Record<VisitType, string> = {
  home: 'Home',
  trip: 'Visited',
  transit: 'Transit',
};

function CountryList({
  visits,
  isLoading,
  onRemove,
  onUpdateVisitType,
}: CountryListProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Visited Countries
        </h2>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-12 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  // Sort visits: home first, then trips, then transit
  const sortedVisits = [...visits].sort((a, b) => {
    const order: Record<VisitType, number> = { home: 0, trip: 1, transit: 2 };
    const aType = a.visitType || 'trip';
    const bType = b.visitType || 'trip';
    return order[aType] - order[bType];
  });

  return (
    <div className="bg-white rounded-lg shadow-md">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">
          Countries
          <span className="ml-2 text-sm font-normal text-gray-500">
            ({visits.length})
          </span>
        </h2>
      </div>

      {visits.length === 0 ? (
        <div className="p-6 text-center text-gray-500">
          <p>No countries visited yet.</p>
          <p className="text-sm mt-1">
            Click on a country on the map to add it!
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-200 max-h-[400px] overflow-y-auto">
          {sortedVisits.map((visit) => {
            // Default to 'trip' if visitType is undefined (for existing records)
            const visitType: VisitType = visit.visitType || 'trip';
            const colors = VISIT_TYPE_COLORS[visitType];
            const label = VISIT_TYPE_LABELS[visitType];

            return (
              <li
                key={visit.id}
                className="px-6 py-4 flex items-center justify-between hover:bg-gray-50"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {visit.country.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {/* Visit Type Badge */}
                      {onUpdateVisitType ? (
                        <select
                          value={visitType}
                          onChange={(e) =>
                            onUpdateVisitType(
                              visit.id,
                              e.target.value as VisitType
                            )
                          }
                          className={`text-xs px-2 py-0.5 rounded font-medium ${colors.bg} ${colors.text} border-0 cursor-pointer`}
                        >
                          <option value="trip">Visited</option>
                          <option value="transit">Transit</option>
                          <option value="home">Home</option>
                        </select>
                      ) : (
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-medium ${colors.bg} ${colors.text}`}
                        >
                          {label}
                        </span>
                      )}

                      {/* Source Badge */}
                      {visit.source === 'flight' && (
                        <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                          Flight
                        </span>
                      )}

                      {/* Date */}
                      {visit.visitedAt && (
                        <span className="text-xs text-gray-500">
                          {new Date(visit.visitedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => onRemove(visit.id)}
                  className="text-red-600 hover:text-red-800 text-sm font-medium transition-colors flex-shrink-0 ml-4"
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default CountryList;
