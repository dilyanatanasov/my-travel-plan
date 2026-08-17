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
import { drawPlaneSprite } from '../lib/planeSprite';
import {
  renderTripCardTemplate,
  CARD_WIDTH,
  CARD_HEIGHT,
  type TripContent,
} from './shareCard';

const FPS = 30;
const DURATION_MS = 9000;
/** Routes take off staggered across this fraction of the run. */
const STAGGER = 0.55;
/** Held at the end so the finished map is the last thing on screen. */
const HOLD_MS = 1200;

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
  height: number,
  keepAirports = false
): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  // The backdrop is the map without its routes; the animation draws those.
  // The trip video keeps its airports - the dots and city names are where
  // the plane is going, and stripping them left an anonymous map.
  clone
    .querySelectorAll(
      keepAirports ? '.flight-routes' : '.flight-routes, .airport-markers'
    )
    .forEach((n) => n.remove());
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
        const points = route.points;
        const n = points.length;

        /*
          Fractional head, exactly like the trip video: snapping to sampled
          points made the plane hop, and this renderer kept hopping after
          the trip one was smoothed (owner report, 2026-08-17). One motion
          model for every film now.
        */
        const exact = progress * (n - 1);
        const i0 = Math.min(Math.floor(exact), n - 2);
        const frac = exact - i0;
        const head = {
          x: points[i0].x + (points[i0 + 1].x - points[i0].x) * frac,
          y: points[i0].y + (points[i0 + 1].y - points[i0].y) * frac,
        };

        // Trail up to the head, following it exactly.
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i <= i0; i++) {
          ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.lineTo(head.x, head.y);
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.globalAlpha = 0.85;
        ctx.stroke();
        ctx.globalAlpha = 1;

        if (progress < 1) {
          // Heading over a small window, not one sample pair - single-pair
          // angles twitched on dense arcs.
          const ahead = points[Math.min(i0 + 2, n - 1)];
          const behind = points[Math.max(i0 - 1, 0)];
          drawPlaneSprite(ctx, {
            x: head.x,
            y: head.y,
            angle: Math.atan2(ahead.y - behind.y, ahead.x - behind.x),
            // The glyph is a 24-unit box on a 1600px canvas. Smaller read
            // as a speck rather than a plane.
            scale: 1.6,
            fill: '#fb7185',
            outline: '#ffffff',
            timeMs: elapsed,
          });
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

/*
  The trip video wears the boarding pass (owner, 2026-08-17: the plain
  flythrough "lost my passport design"). The whole ticket - route, date,
  stub, perforations - is drawn once as a template; every frame repaints
  it and animates the plane inside the map strip alone, clipped to the
  same rounded rect the still card uses. Ticket ink for trail and plane,
  so the film and the still are one artifact.
*/
const TICKET_TRAIL = '#8c491a';
const TICKET_PLANE = '#a82d26';

export async function renderTripVideo(
  svg: SVGSVGElement,
  trip: TripContent,
  onProgress?: (fraction: number) => void,
  durationMs = 6000,
  /** Per-leg stop photos, aligned to leg order; null = no photo there. */
  photos: (HTMLImageElement | null)[] = []
): Promise<Blob> {
  const mimeType = pickMimeType();
  if (!mimeType) {
    throw new MapExportError('Your browser cannot record video');
  }
  const width = Number(svg.getAttribute('width')) || svg.getBoundingClientRect().width;
  const height = Number(svg.getAttribute('height')) || svg.getBoundingClientRect().height;
  if (!width || !height || !svg.querySelector('path')) {
    throw new MapExportError('The map is not ready yet - try again in a moment');
  }

  const routes = sampleRoutes(svg);
  const backdrop = await loadImage(
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
      serializeWithoutRoutes(svg, width, height, true)
    )}`
  );
  const { canvas: template, placement } = await renderTripCardTemplate(
    trip,
    backdrop
  );

  // Source-space route points, pre-mapped into the strip once.
  const cardRoutes = routes.map((route) => ({
    points: route.points.map((p) => ({
      x: placement.dx + p.x * placement.scale,
      y: placement.dy + p.y * placement.scale,
    })),
  }));

  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
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

  const start = performance.now();
  recorder.start();

  await new Promise<void>((resolve) => {
    const frame = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / durationMs, 1);
      onProgress?.(t);

      ctx.drawImage(template, 0, 0);

      ctx.save();
      // Clip to the strip so nothing ever paints over the ticket chrome.
      // (Manual arcs, not ctx.roundRect - same compat stance as shareCard.)
      const { x, y, w, h, r } = placement;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
      ctx.clip();

      cardRoutes.forEach((route, index) => {
        // Replay-style: leg i owns its slice, the next waits for touchdown.
        const local = t * cardRoutes.length - index;
        if (local <= 0) return;
        const progress = easeInOut(Math.min(local, 1));
        const points = route.points;
        const n = points.length;

        /*
          Fractional position, not Math.floor: snapping the head to sampled
          points made the plane hop point-to-point ("not so smooth"). The
          head lerps between samples; the trail follows it exactly.
        */
        const exact = progress * (n - 1);
        const i0 = Math.min(Math.floor(exact), n - 2);
        const frac = exact - i0;
        const head = {
          x: points[i0].x + (points[i0 + 1].x - points[i0].x) * frac,
          y: points[i0].y + (points[i0 + 1].y - points[i0].y) * frac,
        };

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i <= i0; i++) {
          ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.lineTo(head.x, head.y);
        ctx.strokeStyle = TICKET_TRAIL;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.globalAlpha = 0.9;
        ctx.stroke();
        ctx.globalAlpha = 1;

        if (progress < 1) {
          // Heading over a small window, not one sample pair - single-pair
          // angles twitched on dense arcs. The beacon answers "a bit hard
          // to track"; the sprite brings the nav lights with it.
          const ahead = points[Math.min(i0 + 2, n - 1)];
          const behind = points[Math.max(i0 - 1, 0)];
          drawPlaneSprite(ctx, {
            x: head.x,
            y: head.y,
            angle: Math.atan2(ahead.y - behind.y, ahead.x - behind.x),
            scale: 1.8,
            fill: TICKET_PLANE,
            outline: '#f8f0e1',
            timeMs: elapsed,
            beacon: { color: TICKET_PLANE },
          });
        }
      });

      /*
        Stop postcards (owner ask, 2026-08-17): a polaroid pops at each
        arrival as the plane lands - the replay's touchdown memory, on
        film. Visible ~2.4s with a soft fade both ways, clipped to the
        strip like everything else.
      */
      const legDuration = durationMs / Math.max(cardRoutes.length, 1);
      photos.forEach((photo, index) => {
        if (!photo || index >= cardRoutes.length) return;
        const sinceTouchdown = elapsed - (index + 1) * legDuration;
        if (sinceTouchdown < 0 || sinceTouchdown > 2400) return;
        const fade = Math.min(
          1,
          sinceTouchdown / 250,
          (2400 - sinceTouchdown) / 250
        );
        const at = cardRoutes[index].points[cardRoutes[index].points.length - 1];

        const frameW = 170;
        const frameH = 200;
        const photoSize = 150;
        // Above the landing point, nudged to stay inside the strip.
        const px = Math.min(
          Math.max(at.x - frameW / 2, placement.x + 8),
          placement.x + placement.w - frameW - 8
        );
        const py = Math.min(
          Math.max(at.y - frameH - 16, placement.y + 8),
          placement.y + placement.h - frameH - 8
        );

        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(px + frameW / 2, py + frameH / 2);
        ctx.rotate(((index % 2 ? 4 : -4) * Math.PI) / 180);
        ctx.translate(-frameW / 2, -frameH / 2);
        ctx.shadowColor = 'rgba(32, 30, 29, 0.35)';
        ctx.shadowBlur = 14;
        ctx.fillStyle = '#fffdf9';
        ctx.fillRect(0, 0, frameW, frameH);
        ctx.shadowBlur = 0;
        // Cover-crop the photo into the square window.
        const scale = Math.max(
          photoSize / photo.width,
          photoSize / photo.height
        );
        const sw = photoSize / scale;
        const sh = photoSize / scale;
        ctx.drawImage(
          photo,
          (photo.width - sw) / 2,
          (photo.height - sh) / 2,
          sw,
          sh,
          10,
          10,
          photoSize,
          photoSize
        );
        ctx.restore();
      });
      ctx.restore();

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
