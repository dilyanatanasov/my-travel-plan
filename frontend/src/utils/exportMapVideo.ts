/**
 * Record the map as a short video: planes flying each route, drawing their
 * trails as they go.
 *
 * Uses MediaRecorder over a canvas stream, so no encoder dependency. The
 * output is WebM, which Chrome and Firefox produce and play but Safari and
 * iOS largely do not - hence `isVideoExportSupported`, and the PNG export
 * staying in place as the fallback rather than being replaced.
 */
import { MapExportError } from './exportMapImage';

const FPS = 30;
const DURATION_MS = 9000;
/** Routes take off staggered across this fraction of the run. */
const STAGGER = 0.55;
/** Held at the end so the finished map is the last thing on screen. */
const HOLD_MS = 1200;

const PLANE_PATH_2D =
  'M2.5 12 L9 9.5 L9 4.2 A1.5 1.5 0 0 1 12 4.2 L12 8.4 L21.5 12 L12 15.6 L12 19.8 A1.5 1.5 0 0 1 9 19.8 L9 14.5 Z';

export interface VideoCaption {
  title: string;
  stats: string[];
}

interface RouteSamples {
  points: { x: number; y: number }[];
  length: number;
}

/** Whether this browser can produce a video at all. */
export function isVideoExportSupported(): boolean {
  if (typeof MediaRecorder === 'undefined') return false;
  if (typeof HTMLCanvasElement.prototype.captureStream !== 'function') return false;
  return Boolean(pickMimeType());
}

function pickMimeType(): string | null {
  const candidates = [
    /*
      MP4 first (2026-08-17): Instagram, iMessage and most story targets
      accept H.264 MP4 and often reject WebM - and Safari, which cannot
      record WebM at all, records MP4 natively, so preferring it turns
      video export ON for iPhones instead of hiding the button there.
    */
    'video/mp4;codecs=avc1',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? null;
}

/** The honest filename suffix for whatever the recorder produced. */
export function videoFileExtension(mimeType: string): 'mp4' | 'webm' {
  return mimeType.includes('mp4') ? 'mp4' : 'webm';
}

/**
 * Sample each route arc into canvas-space points.
 *
 * getPointAtLength works in the path's own user space, so each point is put
 * through the path's CTM to land in the SVG viewport - which, because the
 * export SVG's viewBox matches its pixel size, is also canvas space. Reading
 * the live SVG avoids reimplementing the projection.
 */
function sampleRoutes(svg: SVGSVGElement): RouteSamples[] {
  const paths = [
    ...svg.querySelectorAll<SVGPathElement>('.flight-routes path'),
  ].filter((p) => p.getAttribute('stroke') !== 'transparent');

  return paths
    .map((path) => {
      const length = path.getTotalLength();
      if (!length) return null;
      const matrix = path.getCTM();
      if (!matrix) return null;

      const steps = Math.max(24, Math.min(160, Math.round(length / 4)));
      const points = Array.from({ length: steps + 1 }, (_, i) => {
        const p = path.getPointAtLength((length * i) / steps);
        return {
          x: matrix.a * p.x + matrix.c * p.y + matrix.e,
          y: matrix.b * p.x + matrix.d * p.y + matrix.f,
        };
      });
      return { points, length };
    })
    .filter((r): r is RouteSamples => r !== null);
}

function serializeWithoutRoutes(
  svg: SVGSVGElement,
  width: number,
  height: number
): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  // The backdrop is the map without its routes; the animation draws those.
  clone.querySelectorAll('.flight-routes, .airport-markers').forEach((n) => n.remove());
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.removeAttribute('class');
  clone.removeAttribute('style');
  return new XMLSerializer().serializeToString(clone);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new MapExportError('Could not render the map'));
    img.src = src;
  });
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function drawCaption(
  ctx: CanvasRenderingContext2D,
  caption: VideoCaption,
  width: number,
  top: number,
  height: number
) {
  ctx.fillStyle = '#060b16';
  ctx.fillRect(0, top, width, height);
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#f1f5f9';
  ctx.font = '600 38px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(caption.title, 32, top + 30);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '24px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(caption.stats.join('   ·   '), 32, top + 84);
}

export interface VideoOptions {
  /**
   * 'wave' staggers every route's take-off (the whole-map flythrough);
   * 'sequential' flies them strictly one after another in DOM order -
   * which for a single journey's export SVG is leg order, i.e. the
   * replay: out, connection, home.
   */
  mode?: 'wave' | 'sequential';
  /** Overrides the 9s default; a one-leg hop doesn't need nine seconds. */
  durationMs?: number;
}

/**
 * Render and record the flythrough.
 *
 * @param svg      the off-screen export map (MapExportCanvas)
 * @param caption  title and stat line burned into the footer
 */
export async function renderMapVideo(
  svg: SVGSVGElement,
  caption: VideoCaption,
  onProgress?: (fraction: number) => void,
  options: VideoOptions = {}
): Promise<Blob> {
  const mimeType = pickMimeType();
  if (!mimeType) {
    throw new MapExportError('Your browser cannot record video');
  }

  const width = Number(svg.getAttribute('width')) || svg.getBoundingClientRect().width;
  const height = Number(svg.getAttribute('height')) || svg.getBoundingClientRect().height;
  if (!width || !height) {
    throw new MapExportError('The map is not ready yet - try again in a moment');
  }
  if (!svg.querySelector('path')) {
    throw new MapExportError('The map is still loading - try again in a moment');
  }

  const routes = sampleRoutes(svg);
  const backdrop = await loadImage(
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
      serializeWithoutRoutes(svg, width, height)
    )}`
  );

  const captionHeight = 150;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height + captionHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new MapExportError('Your browser could not create the video');

  const stream = canvas.captureStream(FPS);
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 6_000_000,
  });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const finished = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    recorder.onerror = () => reject(new MapExportError('Recording failed'));
  });

  const plane = new Path2D(PLANE_PATH_2D);
  const mode = options.mode ?? 'wave';
  const durationMs = options.durationMs ?? DURATION_MS;
  const start = performance.now();
  recorder.start();

  await new Promise<void>((resolve) => {
    const frame = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / durationMs, 1);
      onProgress?.(t);

      ctx.drawImage(backdrop, 0, 0, width, height);

      routes.forEach((route, index) => {
        let local: number;
        if (mode === 'sequential') {
          // One leg at a time, replay-style: leg i owns its slice of the
          // timeline and the next waits for touchdown.
          local = t * routes.length - index;
        } else {
          // Spread take-offs over the run so routes arrive in a wave rather
          // than all at once.
          const offset =
            routes.length > 1 ? (index / (routes.length - 1)) * STAGGER : 0;
          local = (t - offset) / (1 - STAGGER);
        }
        if (local <= 0) return;
        const progress = easeInOut(Math.min(local, 1));

        const lastIndex = Math.floor(progress * (route.points.length - 1));
        if (lastIndex < 1) return;

        // Trail
        ctx.beginPath();
        ctx.moveTo(route.points[0].x, route.points[0].y);
        for (let i = 1; i <= lastIndex; i++) {
          ctx.lineTo(route.points[i].x, route.points[i].y);
        }
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.globalAlpha = 0.85;
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Plane at the head, angled along the last segment, until it lands.
        if (progress < 1) {
          const head = route.points[lastIndex];
          const prev = route.points[Math.max(lastIndex - 1, 0)];
          const angle = Math.atan2(head.y - prev.y, head.x - prev.x);
          ctx.save();
          ctx.translate(head.x, head.y);
          ctx.rotate(angle);
          // The glyph is a 24-unit box on a 1600px canvas. At 0.7 it was ~17px
          // and read as a speck rather than a plane.
          ctx.scale(1.6, 1.6);
          ctx.translate(-12, -12);
          ctx.fillStyle = '#fb7185';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 0.9;
          ctx.fill(plane);
          ctx.stroke(plane);
          ctx.restore();
        }
      });

      drawCaption(ctx, caption, width, height, captionHeight);

      if (elapsed < durationMs + HOLD_MS) {
        requestAnimationFrame(frame);
      } else {
        resolve();
      }
    };
    requestAnimationFrame(frame);
  });

  recorder.stop();
  stream.getTracks().forEach((track) => track.stop());
  return finished;
}
