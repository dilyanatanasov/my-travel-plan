import { memo } from 'react';
import { Geographies, Geography } from 'react-simple-maps';
import { numericToAlpha3 } from './isoCodes';
import {
  getCountryColor,
  getCountryHoverColor,
  getCountryPressedColor,
  type CountryDisplayInfo,
} from './countryColors';
import { MAP, MAP_HOVER, MAP_PRESSED } from '../../theme/mapColors';

export const GEO_URL =
  'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

interface CountriesLayerProps {
  countryDisplayMap: Map<string, CountryDisplayInfo>;
  /** When false, every country renders as plain land. */
  showVisitColors?: boolean;
  /** Omit to render a read-only map — used by the public shared view. */
  onCountryClick?: (isoCode: string) => void;
}

/**
 * The country geography layer, shared by the interactive map and the public
 * read-only one. Kept separate so the two cannot drift apart visually.
 */
function CountriesLayer({
  countryDisplayMap,
  showVisitColors = true,
  onCountryClick,
}: CountriesLayerProps) {
  const isInteractive = Boolean(onCountryClick);

  return (
    <Geographies geography={GEO_URL}>
      {({ geographies }: { geographies: { id: string; rsmKey: string }[] }) =>
        geographies.map((geo) => {
          const numericCode = String(parseInt(geo.id, 10));
          const isoCode = numericToAlpha3[numericCode];
          const displayInfo = isoCode
            ? countryDisplayMap.get(isoCode)
            : undefined;
          const visitType = displayInfo?.visitType || 'none';
          const isHome = displayInfo?.isHome || false;

          const fillColor = showVisitColors
            ? getCountryColor(visitType, isHome)
            : MAP.land;
          const hoverColor = showVisitColors
            ? getCountryHoverColor(visitType, isHome)
            : MAP_HOVER.land;
          const pressedColor = showVisitColors
            ? getCountryPressedColor(visitType, isHome)
            : MAP_PRESSED.land;

          const clickable = isInteractive && Boolean(isoCode) && showVisitColors;

          return (
            <Geography
              key={geo.rsmKey}
              geography={geo}
              onClick={() => {
                if (clickable && isoCode) onCountryClick?.(isoCode);
              }}
              style={{
                default: {
                  fill: fillColor,
                  stroke: MAP.countryBorder,
                  strokeWidth: 0.5,
                  outline: 'none',
                  // Countries wash in and out instead of snapping, so adding
                  // one reads as something happening rather than a repaint.
                  transition: 'fill 400ms ease-out',
                },
                hover: {
                  // A read-only map should not suggest the countries respond.
                  fill: isInteractive ? hoverColor : fillColor,
                  stroke: MAP.countryBorder,
                  strokeWidth: 0.5,
                  outline: 'none',
                  cursor: clickable ? 'pointer' : 'default',
                },
                pressed: {
                  fill: isInteractive ? pressedColor : fillColor,
                  stroke: MAP.countryBorder,
                  strokeWidth: 0.5,
                  outline: 'none',
                },
              }}
            />
          );
        })
      }
    </Geographies>
  );
}

export default memo(CountriesLayer);
