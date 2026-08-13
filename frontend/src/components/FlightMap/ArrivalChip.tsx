import { useMapContext, useZoomPanContext } from 'react-simple-maps';
import { getZoomAdjustedSize } from './routeUtils';
import { useMapColors } from '../../theme/mapColors';

interface ArrivalChipProps {
  label: string;
  lon: number;
  lat: number;
  /** Draw a dot at the exact spot — for pinging a place with no marker. */
  showDot?: boolean;
}

/**
 * A name bubble pinned to map coordinates — used as the search ping for
 * airports (searched airports may have no marker: markers exist only for
 * airports actually flown).
 *
 * Positioning and animation are split across two groups on purpose: a CSS
 * transform on an element *replaces* its attribute transform, so the outer
 * group carries the map position and the inner one carries the pop.
 */
function ArrivalChip({ label, lon, lat, showDot = false }: ArrivalChipProps) {
  const { map: colors } = useMapColors();
  const { projection } = useMapContext();
  const { k: zoom } = useZoomPanContext();

  const pos = projection([lon, lat]);
  if (!pos) return null;

  const fontSize = getZoomAdjustedSize(11, zoom);
  const height = getZoomAdjustedSize(22, zoom);
  const padX = getZoomAdjustedSize(9, zoom);
  // Monospace-ish estimate; a hair generous so descenders never clip.
  const width = label.length * fontSize * 0.62 + padX * 2;
  const lift = getZoomAdjustedSize(16, zoom);

  return (
    <g
      transform={`translate(${pos[0]}, ${pos[1] - lift})`}
      pointerEvents="none"
      aria-hidden="true"
    >
      <g className="arrival-chip">
        {showDot && (
          <circle
            cx={0}
            cy={lift}
            r={getZoomAdjustedSize(4, zoom)}
            fill={colors.routeHighlight}
            stroke={colors.ocean}
            strokeWidth={getZoomAdjustedSize(1.2, zoom)}
          />
        )}
        <rect
          x={-width / 2}
          y={-height}
          width={width}
          height={height}
          rx={height / 2}
          fill={colors.ocean}
          fillOpacity={0.88}
          stroke={colors.routeHighlight}
          strokeWidth={getZoomAdjustedSize(1, zoom)}
        />
        <text
          textAnchor="middle"
          y={-height / 2}
          dominantBaseline="central"
          fontSize={fontSize}
          fontWeight={600}
          fill={colors.label}
        >
          {label}
        </text>
      </g>
    </g>
  );
}

export default ArrivalChip;
