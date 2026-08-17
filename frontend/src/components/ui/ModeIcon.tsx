import { PLANE_PATH, VEHICLE_PATHS } from '../../lib/planeSprite';
import type { TravelMode } from '../../types';

/*
  Flat monochrome travel-mode icons (owner call, 2026-08-17: no emoji in
  the UI). The paths are the exact silhouettes that fly the map and the
  share videos, so a chip in the form and the vehicle on the route are
  recognisably the same shape. currentColor, so they take whatever ink
  their context uses.
*/

const MODE_PATHS: Record<TravelMode, string> = {
  flight: PLANE_PATH,
  ...VEHICLE_PATHS,
};

interface ModeIconProps {
  mode: TravelMode;
  className?: string;
}

export function ModeIcon({ mode, className = 'w-4 h-4' }: ModeIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d={MODE_PATHS[mode]} />
    </svg>
  );
}

/** A simple skyline, for the airport/city stop toggle. */
export function CityIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M4 20 L4 10 Q4 9.2 4.8 9.2 L8.4 9.2 L8.4 5.6 Q8.4 4.8 9.2 4.8 L12.8 4.8 Q13.6 4.8 13.6 5.6 L13.6 12 L18.4 12 Q19.2 12 19.2 12.8 L19.2 20 Q19.2 20.8 18.4 20.8 L4.8 20.8 Q4 20.8 4 20 Z" />
    </svg>
  );
}

export default ModeIcon;
