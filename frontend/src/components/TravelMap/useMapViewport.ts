import { useCallback, useEffect, useState, type RefCallback } from 'react';

interface MapViewport {
  /** viewBox dimensions, matched to the measured container so nothing letterboxes. */
  width: number;
  height: number;
  /** Projection scale, derived from the space actually available. */
  scale: number;
  /**
   * Multiplier for route thickness and airport dots. A 1px line and a 3px dot
   * cover far more of a 390px map than of a 1400px one, so they are trimmed
   * on small screens.
   */
  markerScale: number;
  /** True when the container is portrait-ish, i.e. a phone. */
  isNarrow: boolean;
}

// Fallback until the first measurement lands.
const INITIAL: MapViewport = {
  width: 1000,
  height: 500,
  scale: 150,
  markerScale: 1,
  isNarrow: false,
};

/**
 * How much of the container width the world should occupy. The equirectangular
 * world is 2π·scale wide, so scale = (width · fill) / 2π.
 */
const WIDTH_FILL = 0.98;
const HEIGHT_FILL = 0.98;

/**
 * How much wider than the container the world may run. Cropping longitude
 * loses real places, so this stays modest — it only exists because a 2:1 world
 * in a portrait phone box would otherwise be a postage stamp adrift in ocean.
 */
const MAX_HORIZONTAL_OVERFLOW = 1.35;

/**
 * Scale the map to *cover* its container rather than fit inside it.
 *
 * Fitting (taking the smaller of the two candidate scales) meant that on a
 * short, wide window the height decided the scale and left hundreds of pixels
 * of empty ocean down each side. Covering fills the width and crops the top
 * and bottom instead — and what gets cropped first is the Arctic and
 * Antarctica, which contain nothing anyone is tracking.
 *
 * The overflow cap keeps the same formula usable in portrait, where covering
 * outright would throw away a third of the world's longitudes.
 */
function computeScale(width: number, height: number): number {
  const fitWidth = (width * WIDTH_FILL) / (2 * Math.PI);
  const fitHeight = (height * HEIGHT_FILL) / Math.PI;

  const cover = Math.max(fitWidth, fitHeight);
  const capped = Math.min(cover, fitWidth * MAX_HORIZONTAL_OVERFLOW);

  return Math.max(capped, 40);
}

/**
 * Size the map from the box it is actually given.
 *
 * The previous version pinned the viewBox to two breakpoint presets, which only
 * worked because the map sat in a fixed-aspect card. In the shell the canvas is
 * whatever space is left after the rail, panel and header, so it has to be
 * measured. viewBox === container size also means preserveAspectRatio has
 * nothing to letterbox.
 *
 * The ref is a callback, not a RefObject: globe mode swaps the container
 * element in and out, and an effect that captured `ref.current` once at mount
 * kept observing the detached div — after a mode switch, resizes silently
 * stopped landing (and with globe persisted on, the flat map was never
 * measured at all). Tracking the element in state re-arms the observer on
 * every element change; for a container that never changes, the behaviour is
 * identical to before.
 */
export function useMapViewport<T extends HTMLElement>(): {
  ref: RefCallback<T>;
  viewport: MapViewport;
} {
  const [element, setElement] = useState<T | null>(null);
  const ref = useCallback<RefCallback<T>>((node) => setElement(node), []);
  const [viewport, setViewport] = useState<MapViewport>(INITIAL);

  useEffect(() => {
    if (!element) return;

    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const { width, height } = element.getBoundingClientRect();
        if (width < 1 || height < 1) return;
        const w = Math.round(width);
        const h = Math.round(height);
        setViewport((current) =>
          current.width === w && current.height === h
            ? current
            : {
                width: w,
                height: h,
                scale: computeScale(w, h),
                markerScale: w < 768 ? 0.7 : 1,
                isNarrow: w < 768,
              }
        );
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [element]);

  return { ref, viewport };
}
