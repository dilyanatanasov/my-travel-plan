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
import { drawVehicleSprite } from '../lib/planeSprite';
import {
  renderTripCardTemplate,
  CARD_WIDTH,
  CARD_HEIGHT,
  type TripContent,
} from './shareCard';
export const FPS = 30;
const DURATION_MS = 9000;
/** Routes take off staggered across this fraction of the run. */
const STAGGER = 0.55;
/** Held at the end so the finished map is the last thing on screen. */
export const HOLD_MS = 1200;

export interface VideoCaption {
  title: string;
  stats: string[];
}

type RouteMode = 'flight' | 'train' | 'car' | 'bus' | 'ferry';

interface RouteSamples {
  points: { x: number; y: number }[];
  length: number;
  /** Read from data-travel-mode on the route path; picks the vehicle. */
  mode: RouteMode;
}

/** Whether this browser can produce a video at all. */
export function isVideoExportSupported(): boolean {
  if (typeof MediaRecorder === 'undefined') return false;
  if (typeof HTMLCanvasElement.prototype.captureStream !== 'function') return false;
  return Boolean(pickMimeType());
}

export function pickMimeType(): string | null {
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
  ].filter(
    (p) =>
      p.getAttribute('stroke') !== 'transparent' &&
      // The ferry's wavy trail is drawn geometry only - the smooth twin
      // carrying data-travel-mode is the track vehicles actually sail.
      p.getAttribute('data-decorative') !== 'true',
  );

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
      const mode = (path.getAttribute('data-travel-mode') ??
        'flight') as RouteMode;
      return { points, length, mode };
    })
    .filter((r): r is RouteSamples => r !== null);
}

/**
 * Trail signatures in canvas (owner ask, 2026-08-18): the ferry's drawn
 * trail undulates. The samples are dense (24-160 per route), so shifting
 * each point sideways by a sinusoid of the distance travelled reads as a
 * smooth wave - while the vehicle itself keeps riding the smooth samples,
 * steady on its heading.
 */
function wavyTrailPoints(
  points: { x: number; y: number }[],
  amplitude = 3,
  wavelength = 26,
): { x: number; y: number }[] {
  if (points.length < 3) return points;
  const cumulative: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    cumulative.push(
      cumulative[i - 1] +
        Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y),
    );
  }
  return points.map((point, i) => {
    if (i === 0 || i === points.length - 1) return point;
    const prev = points[i - 1];
    const next = points[i + 1];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    const swing =
      amplitude * Math.sin((cumulative[i] / wavelength) * Math.PI * 2);
    return { x: point.x + (-dy / len) * swing, y: point.y + (dx / len) * swing };
  });
}

/*
  Recording reliability (owner report, 2026-08-18: "sometimes it renders
  sometimes it doesn't"). The film is driven by requestAnimationFrame
  into a MediaRecorder, and when the tab loses visibility - a switched
  tab, a dimming phone screen - the browser throttles both and the
  render silently stalls or ships an empty file. These guards turn that
  silent failure into an honest error, and a screen wake lock keeps the
  phone awake for the render's duration in the first place.
*/
export function armRecordingGuards(onAbort: (error: MapExportError) => void): () => void {
  type WakeLockNavigator = Navigator & {
    wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
  };
  let wakeLock: { release: () => Promise<void> } | null = null;
  (navigator as WakeLockNavigator).wakeLock
    ?.request('screen')
    .then((lock) => {
      wakeLock = lock;
    })
    .catch(() => {
      /* best effort - a denied lock just means the old behaviour */
    });
  const onVisibility = () => {
    if (document.hidden) {
      onAbort(
        new MapExportError(
          'The render stopped because the page went into the background - keep this tab visible and try again',
        ),
      );
    }
  };
  document.addEventListener('visibilitychange', onVisibility);
  return () => {
    document.removeEventListener('visibilitychange', onVisibility);
    void wakeLock?.release().catch(() => {});
  };
}

/** Land trails are dotted, water waves, air stays solid - one place so
    both film renderers speak the same language as the map. */
function applyTrailDash(
  ctx: CanvasRenderingContext2D,
  mode: RouteMode,
  dotGap: number,
): void {
  if (mode !== 'flight' && mode !== 'ferry') ctx.setLineDash([0.1, dotGap]);
}

/** The film's trail hues (owner ask, 2026-08-18): flights keep their
    original light blue, ground runs teal (yellow sank into the orange
    visited fills), water a deeper blue. */
function trailColor(mode: RouteMode): string {
  if (mode === 'ferry') return '#2563eb';
  if (mode !== 'flight') return '#14b8a6';
  return '#60a5fa';
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

  let stopped = false;
  let abortRender: (error: Error) => void = () => {};
  const abortion = new Promise<never>((_, reject) => {
    abortRender = reject;
  });
  const releaseGuards = armRecordingGuards((error) => abortRender(error));

  try {
    await Promise.race([
      abortion,
      new Promise<void>((resolve) => {
        const frame = (now: number) => {
          if (stopped) return;
          // A throw inside a rAF callback kills the chain SILENTLY -
          // the render freezes at its last percent with no error. Route
          // any frame crash into the abort path instead (2026-08-18).
          try {
          // Clamped: a rAF timestamp is the frame's vsync time and can
          // PRECEDE the performance.now() that set `start` - a negative
          // first-frame elapsed indexed sceneData[-1] in the trip film
          // ("reading 'image'" crash, owner report 2026-08-18).
          const elapsed = Math.max(0, now - start);
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

        // Trail up to the head, following it exactly. Land trails are
        // dotted, the ferry's waves - the map's signatures carry into
        // the film. The head itself stays on the smooth samples.
        const trailPoints =
          route.mode === 'ferry' ? wavyTrailPoints(points) : points;
        ctx.beginPath();
        ctx.moveTo(trailPoints[0].x, trailPoints[0].y);
        for (let i = 1; i <= i0; i++) {
          ctx.lineTo(trailPoints[i].x, trailPoints[i].y);
        }
        ctx.lineTo(head.x, head.y);
        ctx.strokeStyle = trailColor(route.mode);
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.globalAlpha = 0.85;
        applyTrailDash(ctx, route.mode, 6);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;

        if (progress < 1) {
          // Heading over a small window, not one sample pair - single-pair
          // angles twitched on dense arcs.
          const ahead = points[Math.min(i0 + 2, n - 1)];
          const behind = points[Math.max(i0 - 1, 0)];
          drawVehicleSprite(ctx, route.mode, {
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
          } catch (frameError) {
            abortRender(
              frameError instanceof Error
                ? frameError
                : new MapExportError('A render frame crashed - try again'),
            );
          }
        };
        requestAnimationFrame(frame);
      }),
    ]);
  } finally {
    stopped = true;
    releaseGuards();
    recorder.stop();
    stream.getTracks().forEach((track) => track.stop());
  }

  const blob = await finished;
  if (blob.size === 0)
    throw new MapExportError(
      'The recording came out empty - keep this tab visible and try again',
    );
  return blob;
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

/**
 * One leg's scene for the animated camera (2026-08-18): a backdrop
 * framed on that leg alone plus its sampled route in the backdrop's own
 * canvas space. The film cuts between scenes - sharp per-leg close-ups
 * instead of one continental frame where a short drive is a speck.
 */
export interface TripVideoScene {
  image: HTMLImageElement;
  points: { x: number; y: number }[];
  mode: RouteMode;
}

/**
 * Capture the CURRENT framing of the trip export SVG as one scene,
 * keeping only the leg at `legIndex` (journey-mode routes render in leg
 * order). Call after re-aiming the canvas via focusLegOrder and waiting
 * for data-framed.
 */
export async function captureTripScene(
  svg: SVGSVGElement,
  legIndex: number,
): Promise<TripVideoScene> {
  const width = Number(svg.getAttribute('width')) || svg.getBoundingClientRect().width;
  const height = Number(svg.getAttribute('height')) || svg.getBoundingClientRect().height;
  const routes = sampleRoutes(svg);
  const route = routes[legIndex] ?? routes[routes.length - 1];
  if (!route) {
    throw new MapExportError('The map is not ready yet - try again in a moment');
  }
  const image = await loadImage(
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
      serializeWithoutRoutes(svg, width, height, true)
    )}`
  );
  return { image, points: route.points, mode: route.mode };
}

/**
 * Render the boarding-pass trip film with an animated camera
 * (2026-08-18): one SCENE per leg, each framed on that leg alone, cut
 * together with short crossfades. A 35 km drive finally fills the strip
 * instead of hiding as a speck on the continental frame. Within each
 * scene the vehicle travels the first ~72% of the slice and the last
 * stretch holds at the arrival - which is where that leg's postcard
 * pops, exactly like the replay's ground pause.
 */
const SCENE_FADE_MS = 300;
const SCENE_TRAVEL_FRACTION = 0.72;

export async function renderTripVideo(
  scenes: TripVideoScene[],
  trip: TripContent,
  onProgress?: (fraction: number) => void,
  durationMs = 6000,
  /** Per-leg stop photos, aligned to scene order; null = no photo there. */
  photos: (HTMLImageElement | null)[] = []
): Promise<Blob> {
  const mimeType = pickMimeType();
  if (!mimeType) {
    throw new MapExportError('Your browser cannot record video');
  }
  if (scenes.length === 0) {
    throw new MapExportError('The map is not ready yet - try again in a moment');
  }
  // A scene image can decode to 0x0 under memory pressure (long journeys
  // on phones); name the leg instead of failing later as "not ready".
  const emptyScene = scenes.findIndex(
    (scene) => !scene.image.width || !scene.image.height,
  );
  if (emptyScene !== -1) {
    throw new MapExportError(
      `Leg ${emptyScene + 1}'s scene came out empty - close other tabs and try again`,
    );
  }

  const { canvas: template, placement } = await renderTripCardTemplate(
    trip,
    scenes[0].image
  );

  // Every scene shares the export canvas dimensions, so one placement
  // maps them all: source point p -> (dx + p.x * scale, dy + p.y * scale).
  const sceneData = scenes.map((scene) => ({
    mode: scene.mode,
    image: scene.image,
    drawW: scene.image.width * placement.scale,
    drawH: scene.image.height * placement.scale,
    points: scene.points.map((p) => ({
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

  const sliceMs = durationMs / sceneData.length;
  const start = performance.now();
  recorder.start();

  let stopped = false;
  let abortRender: (error: Error) => void = () => {};
  const abortion = new Promise<never>((_, reject) => {
    abortRender = reject;
  });
  const releaseGuards = armRecordingGuards((error) => abortRender(error));

  try {
    await Promise.race([
      abortion,
      new Promise<void>((resolve) => {
        const frame = (now: number) => {
          if (stopped) return;
          // Same silent-crash trap as the whole-map film (2026-08-18).
          try {
          // Clamped - see renderMapVideo: the first rAF timestamp can
          // precede `start`, and a negative elapsed made this index -1.
          const elapsed = Math.max(0, now - start);
      const t = Math.min(elapsed / durationMs, 1);
      onProgress?.(t);

      const index = Math.min(
        Math.max(0, Math.floor((elapsed / durationMs) * sceneData.length)),
        sceneData.length - 1
      );
      const scene = sceneData[index];
      const timeInScene = elapsed - index * sliceMs;

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

      // The active scene's backdrop replaces the template's baked one.
      ctx.drawImage(scene.image, placement.dx, placement.dy, scene.drawW, scene.drawH);

      // The vehicle travels early, then the arrival holds for the
      // postcard beat - the film's version of the replay ground pause.
      const travelMs = sliceMs * SCENE_TRAVEL_FRACTION;
      const progress = easeInOut(Math.min(timeInScene / travelMs, 1));
      const points = scene.points;
      const n = points.length;
      const exact = progress * (n - 1);
      const i0 = Math.min(Math.floor(exact), n - 2);
      const frac = exact - i0;
      const head = {
        x: points[i0].x + (points[i0 + 1].x - points[i0].x) * frac,
        y: points[i0].y + (points[i0 + 1].y - points[i0].y) * frac,
      };

      const trailPoints =
        scene.mode === 'ferry' ? wavyTrailPoints(points, 4, 34) : points;
      ctx.beginPath();
      ctx.moveTo(trailPoints[0].x, trailPoints[0].y);
      for (let i = 1; i <= i0; i++) {
        ctx.lineTo(trailPoints[i].x, trailPoints[i].y);
      }
      ctx.lineTo(head.x, head.y);
      ctx.strokeStyle = TICKET_TRAIL;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.globalAlpha = 0.9;
      applyTrailDash(ctx, scene.mode, 7);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      if (progress < 1) {
        const ahead = points[Math.min(i0 + 2, n - 1)];
        const behind = points[Math.max(i0 - 1, 0)];
        drawVehicleSprite(ctx, scene.mode, {
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

      // This scene's postcard, during the arrival hold.
      const photo = photos[index];
      const holdMs = sliceMs - travelMs;
      const sinceTouchdown = timeInScene - travelMs;
      if (photo && sinceTouchdown > 0) {
        const window = Math.min(2400, holdMs + (index === sceneData.length - 1 ? HOLD_MS : 0));
        if (sinceTouchdown <= window) {
          const fade = Math.min(1, sinceTouchdown / 250, (window - sinceTouchdown) / 250);
          const at = points[n - 1];
          const frameW = 170;
          const frameH = 200;
          const photoSize = 150;
          const px = Math.min(
            Math.max(at.x - frameW / 2, placement.x + 8),
            placement.x + placement.w - frameW - 8
          );
          const py = Math.min(
            Math.max(at.y - frameH - 16, placement.y + 8),
            placement.y + placement.h - frameH - 8
          );
          ctx.save();
          ctx.globalAlpha = Math.max(fade, 0);
          ctx.translate(px + frameW / 2, py + frameH / 2);
          ctx.rotate(((index % 2 ? 4 : -4) * Math.PI) / 180);
          ctx.translate(-frameW / 2, -frameH / 2);
          ctx.shadowColor = 'rgba(32, 30, 29, 0.35)';
          ctx.shadowBlur = 14;
          ctx.fillStyle = '#fffdf9';
          ctx.fillRect(0, 0, frameW, frameH);
          ctx.shadowBlur = 0;
          const scale = Math.max(photoSize / photo.width, photoSize / photo.height);
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
        }
      }

      // Crossfade into the next scene's backdrop at the boundary.
      const untilCut = sliceMs - timeInScene;
      if (index < sceneData.length - 1 && untilCut < SCENE_FADE_MS) {
        const next = sceneData[index + 1];
        ctx.globalAlpha = 1 - untilCut / SCENE_FADE_MS;
        ctx.drawImage(next.image, placement.dx, placement.dy, next.drawW, next.drawH);
        ctx.globalAlpha = 1;
      }
      ctx.restore();

          if (elapsed < durationMs + HOLD_MS) {
            requestAnimationFrame(frame);
          } else {
            resolve();
          }
          } catch (frameError) {
            abortRender(
              frameError instanceof Error
                ? frameError
                : new MapExportError('A render frame crashed - try again'),
            );
          }
        };
        requestAnimationFrame(frame);
      }),
    ]);
  } finally {
    stopped = true;
    releaseGuards();
    recorder.stop();
    stream.getTracks().forEach((track) => track.stop());
  }

  const blob = await finished;
  if (blob.size === 0)
    throw new MapExportError(
      'The recording came out empty - keep this tab visible and try again',
    );
  return blob;
}
