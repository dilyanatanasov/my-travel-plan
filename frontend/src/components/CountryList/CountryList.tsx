import type { Visit, VisitType } from '../../types';

interface CountryListProps {
  visits: Visit[];
  isLoading: boolean;
  /** Takes the whole visit so the caller can offer undo with its full record. */
  onRemove: (visit: Visit) => void;
  onUpdateVisitType?: (visitId: number, visitType: VisitType) => void;
}

// Mirrors the map's visit-type colours so a "Transit" badge here is the same
// colour as that country on the map.
const VISIT_TYPE_COLORS: Record<VisitType, { bg: string; text: string }> = {
  home: { bg: 'bg-map-home/10', text: 'text-map-home' },
  trip: { bg: 'bg-map-visited/10', text: 'text-map-visited' },
  transit: { bg: 'bg-map-transit/20', text: 'text-amber-700' },
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
      <div>
        <h2 className="text-lg font-semibold text-ink mb-4">
          Visited Countries
        </h2>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-12 bg-surface-sunken rounded"></div>
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
    // No card chrome and no inner scroller: this renders inside the section
    // panel, which supplies both. Nesting them produced a card in a card and
    // a scrollbar inside a scrollbar.
    <div>
      <h3 className="text-sm font-medium text-ink mb-2">
        Your countries
        <span className="ml-2 font-normal text-ink-subtle">
          ({visits.length})
        </span>
      </h3>

      {visits.length === 0 ? (
        <div className="p-6 text-center text-ink-muted">
          <p>No countries visited yet.</p>
          <p className="text-sm mt-1">
            Click on a country on the map to add it!
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {sortedVisits.map((visit) => {
            // Default to 'trip' if visitType is undefined (for existing records)
            const visitType: VisitType = visit.visitType || 'trip';
            const colors = VISIT_TYPE_COLORS[visitType];
            const label = VISIT_TYPE_LABELS[visitType];

            return (
              <li
                key={visit.id}
                className="py-3 flex items-center justify-between gap-3 hover:bg-surface-sunken"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <p className="font-medium text-ink truncate">
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
                          aria-label={`Visit type for ${visit.country.name}`}
                          className={`select-field min-h-11 text-xs pl-2 rounded-lg font-medium ${colors.bg} ${colors.text} border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500`}
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

                      {/* Source badge. Blue, matching flight routes on the map:
                          it means "we learned this from a flight". */}
                      {visit.source === 'flight' && (
                        <span className="text-xs px-2 py-0.5 rounded bg-map-route/10 text-map-route">
                          Flight
                        </span>
                      )}

                      {/* Date */}
                      {visit.visitedAt && (
                        <span className="text-xs text-ink-muted">
                          {new Date(visit.visitedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {/* 44px icon button rather than 20px of text — this is the
                    destructive control and it sits in a dense list. */}
                <button
                  onClick={() => onRemove(visit)}
                  aria-label={`Remove ${visit.country.name}`}
                  title={`Remove ${visit.country.name}`}
                  className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-lg text-ink-subtle hover:text-danger hover:bg-danger-soft transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
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
