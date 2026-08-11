import { memo } from 'react';
import { COUNTRY_LEGEND, MAP } from '../../theme/mapColors';

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
  return (
    <div className="map-glass absolute bottom-20 lg:bottom-4 left-3 z-20 max-w-[55%] lg:max-w-none rounded-lg border shadow-lg px-3 py-2">
      <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {COUNTRY_LEGEND.map((entry) => (
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
            <li className="flex items-center gap-1.5">
              <span
                className="w-5 h-0.5 rounded flex-shrink-0"
                style={{ backgroundColor: MAP.route }}
                aria-hidden="true"
              />
              <span className="map-glass-muted">Route</span>
            </li>
            <li className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0 border-2"
                style={{
                  backgroundColor: MAP.airportFill,
                  borderColor: MAP.airportRing,
                }}
                aria-hidden="true"
              />
              <span className="map-glass-muted">Airport</span>
            </li>
          </>
        )}
      </ul>

      {/* Counts on desktop only — the mobile peek bar already carries them. */}
      <p className="hidden lg:block mt-1.5 pt-1.5 border-t border-white/10 text-[11px] text-slate-400">
        {stats.visitedCount} visited · {stats.transitCount} transit
        {showFlights &&
          ` · ${stats.flightRoutes} routes · ${stats.airports} airports`}
      </p>
    </div>
  );
}

export default memo(MapLegend);
