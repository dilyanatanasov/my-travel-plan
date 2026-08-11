import { memo } from 'react';

interface CountryTooltipProps {
  name: string | null;
  position: { x: number; y: number };
}

/**
 * The country under the cursor.
 *
 * Until now the map showed nothing on hover, so a small or unfamiliar country
 * was unidentifiable without clicking it — and clicking it changes your data.
 *
 * Rendered only where a pointer can hover; the caller gates this on
 * `(pointer: fine)`.
 */
function CountryTooltip({ name, position }: CountryTooltipProps) {
  if (!name) return null;

  return (
    <div
      className="fixed z-50 pointer-events-none"
      style={{ left: position.x + 14, top: position.y + 14 }}
    >
      <span className="map-glass block rounded-lg border px-2.5 py-1 text-xs font-medium shadow-lg whitespace-nowrap">
        {name}
      </span>
    </div>
  );
}

export default memo(CountryTooltip);
