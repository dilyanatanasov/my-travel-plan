import { useEffect, useState } from 'react';

interface MapViewport {
  /** Projection scale — a phone needs a smaller globe to fit a portrait box. */
  scale: number;
  /**
   * ComposableMap viewBox dimensions. These must match the container's CSS
   * aspect ratio, otherwise `preserveAspectRatio` letterboxes the map and it
   * floats in a sea of white space — which is what it used to do.
   */
  width: number;
  height: number;
  /** True for touch-primary devices, where the map would otherwise trap scrolling. */
  isCoarsePointer: boolean;
}

const MOBILE_BREAKPOINT = 768;

// 4:3 on phones, 2:1 on desktop. Kept in lockstep with the `aspect-[4/3]
// md:aspect-[2/1]` classes on the map container in TravelMap.tsx.
const MOBILE: Omit<MapViewport, 'isCoarsePointer'> = {
  scale: 118,
  width: 800,
  height: 600,
};
const DESKTOP: Omit<MapViewport, 'isCoarsePointer'> = {
  scale: 150,
  width: 1000,
  height: 500,
};

function read(): MapViewport {
  if (typeof window === 'undefined') {
    return { ...DESKTOP, isCoarsePointer: false };
  }
  const base = window.innerWidth < MOBILE_BREAKPOINT ? MOBILE : DESKTOP;
  return {
    ...base,
    isCoarsePointer: window.matchMedia('(pointer: coarse)').matches,
  };
}

/** Viewport facts the map needs, recomputed on resize and orientation change. */
export function useMapViewport(): MapViewport {
  const [viewport, setViewport] = useState<MapViewport>(read);

  useEffect(() => {
    let frame = 0;
    const onResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setViewport(read()));
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  return viewport;
}
