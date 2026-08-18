import { memo, useEffect, useRef } from 'react';
import type { AggregatedRoute } from '../FlightMap/routeUtils';
import ModeIcon from '../ui/ModeIcon';

interface RouteChooserProps {
  candidates: AggregatedRoute[];
  /** Viewport coordinates of the ambiguous tap. */
  point: { x: number; y: number };
  /** The country under the tap; null hides the country row. */
  countryName: string | null;
  onPickRoute: (route: AggregatedRoute) => void;
  onPickCountry: () => void;
  onClose: () => void;
}

/**
 * The tap chooser (owner pick, 2026-08-18): where several routes'
 * hit strokes stack - a busy corridor, a small country under a bundle -
 * a tap used to select whichever path happened to paint last. This
 * popover lists everything that was under the finger and lets the user
 * say which one they meant. It only ever appears at ambiguous spots;
 * a clean tap still selects instantly.
 */
function RouteChooser({
  candidates,
  point,
  countryName,
  onPickRoute,
  onPickCountry,
  onClose,
}: RouteChooserProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    // Deferred a tick: the opening tap itself must not immediately close it.
    const arm = window.setTimeout(() => {
      document.addEventListener('pointerdown', onPointerDown);
      document.addEventListener('keydown', onKeyDown);
    }, 0);
    return () => {
      window.clearTimeout(arm);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  /* Clamped so the panel never leaves the viewport: rows are ~40px, the
     panel ~220px wide; measured clamping is not worth a layout pass. */
  const estimatedHeight = (candidates.length + (countryName ? 1 : 0)) * 40 + 44;
  const left = Math.max(8, Math.min(point.x, window.innerWidth - 236));
  const top = Math.max(8, Math.min(point.y, window.innerHeight - estimatedHeight - 8));

  return (
    <div
      ref={panelRef}
      className="map-glass fixed z-40 rounded-xl border shadow-lg py-1.5 w-56"
      style={{ left, top }}
      role="menu"
      aria-label="What did you mean to tap?"
    >
      <p className="px-3 py-1 text-[11px] uppercase tracking-wide map-glass-muted">
        Several things here
      </p>
      {candidates.map((route) => (
        <button
          key={route.key}
          type="button"
          role="menuitem"
          onClick={() => onPickRoute(route)}
          className="w-full flex items-center gap-2 px-3 min-h-10 text-left text-sm hover:bg-surface-sunken"
        >
          <ModeIcon
            mode={route.mode ?? 'flight'}
            className="w-4 h-4 flex-shrink-0 text-ink-muted"
          />
          <span className="truncate font-medium">
            {route.departure.iataCode} → {route.arrival.iataCode}
          </span>
          {route.count > 1 && (
            <span className="ml-auto text-xs map-glass-muted">
              ×{route.count}
            </span>
          )}
        </button>
      ))}
      {countryName && (
        <button
          type="button"
          role="menuitem"
          onClick={onPickCountry}
          className="w-full flex items-center gap-2 px-3 min-h-10 text-left text-sm hover:bg-surface-sunken border-t border-current/10"
        >
          <span className="truncate">
            {countryName} <span className="map-glass-muted">(the country)</span>
          </span>
        </button>
      )}
    </div>
  );
}

export default memo(RouteChooser);
