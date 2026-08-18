import { memo } from 'react';
import { useMapColors } from '../../theme/mapColors';

interface MapLegendProps {
  showFlights: boolean;
  stats: {
    visitedCount: number;
    transitCount: number;
    flightRoutes: number;
    airports: number;
  };
}

/**
 * Map key, pinned to the bottom-left corner of the canvas.
 *
 * It used to sit in a row under the controls at the top, which pushed the map
 * down and read as part of the filter UI. A corner legend is the convention
 * for a reason: it is reference material, it belongs on the map it describes,
 * and it costs no vertical space.
 *
 * Offset above the mobile peek bar, mirroring the zoom controls on the right.
 */
function MapLegend({ showFlights, stats }: MapLegendProps) {
  const { map: colors, legend } = useMapColors();

  return (
    <div className="map-glass absolute bottom-20 lg:bottom-4 left-3 z-20 max-w-[55%] lg:max-w-none rounded-lg border shadow-lg px-3 py-2">
      <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {legend.map((entry) => (
          <li key={entry.label} className="flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded flex-shrink-0"
              style={{ backgroundColor: entry.color }}
              aria-hidden="true"
            />
            <span className="map-glass-muted">{entry.label}</span>
          </li>
        ))}

        {showFlights && (
          <>
            {/* Three trail kinds since the ferry docked (2026-08-18):
                terracotta air, gold dotted ground, blue wavy sea. */}
            <li className="flex items-center gap-1.5">
              <span
                className="w-5 h-0.5 rounded flex-shrink-0"
                style={{ backgroundColor: colors.route }}
                aria-hidden="true"
              />
              <span className="map-glass-muted">Air</span>
            </li>
            <li className="flex items-center gap-1.5">
              <span
                className="w-5 h-0.5 flex-shrink-0"
                style={{
                  backgroundImage: `radial-gradient(circle, ${colors.routeLand} 42%, transparent 46%)`,
                  backgroundSize: '5px 2px',
                }}
                aria-hidden="true"
              />
              <span className="map-glass-muted">Land</span>
            </li>
            <li className="flex items-center gap-1.5">
              <svg
                className="w-5 h-2 flex-shrink-0"
                viewBox="0 0 20 8"
                aria-hidden="true"
              >
                <path
                  d="M1 4 Q3.5 1 6 4 Q8.5 7 11 4 Q13.5 1 16 4 Q17.5 5.8 19 4"
                  fill="none"
                  stroke={colors.routeSea}
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
              <span className="map-glass-muted">Sea</span>
            </li>
            <li className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0 border-2"
                style={{
                  backgroundColor: colors.airportFill,
                  borderColor: colors.airportRing,
                }}
                aria-hidden="true"
              />
              {/* "Stop", not "Airport": since land travel a dot can be a
                  city you took a train or drive to. */}
              <span className="map-glass-muted">Stop</span>
            </li>
          </>
        )}
      </ul>

      {/* Counts on desktop only — the mobile peek bar already carries them. */}
      <p className="hidden lg:block mt-1.5 pt-1.5 border-t border-current/10 text-[11px] map-glass-muted">
        {stats.visitedCount} visited · {stats.transitCount} transit
        {showFlights &&
          ` · ${stats.flightRoutes} routes · ${stats.airports} stops`}
      </p>
    </div>
  );
}

export default memo(MapLegend);
