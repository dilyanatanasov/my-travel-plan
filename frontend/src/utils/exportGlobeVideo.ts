/*
  The globe film (owner ask, 2026-08-19: "the replay on globe seems a
  lot more interactive - should sharing a video use the globe?"). The
  DOM globe cannot be serialized per frame, so this is a bespoke canvas
  painter: the coarse atlas drawn with d3's orthographic projection, the
  SAME pure timeline/camera/vehicle code the live globe replay runs -
  buildJourneyTimeline, samplePlaneFrame, chaseCamera - and the same
  recording guards as the flat films. The journey's real clock is
  time-warped into the film's runtime, so the cameraman's chase feels
  identical at any compression.
*/
import { geoOrthographic, geoPath, geoGraticule10 } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { Feature, FeatureCollection } from 'geojson';
import { MapExportError } from './exportMapImage';
import {
  FPS,
  HOLD_MS,
  pickMimeType,
  armRecordingGuards,
} from './exportMapVideo';
import { CARD_WIDTH, CARD_HEIGHT } from './shareCard';
import {
  drawVehicleSprite,
  VEHICLE_INK,
  HALO_COLOR,
} from '../lib/planeSprite';
import { loadWorldAtlasCoarse } from '../lib/worldAtlas';
import {
  numericToAlpha3,
  nameToAlpha3,
} from '../components/TravelMap/isoCodes';
import {
  buildJourneyTimeline,
  samplePlaneFrame,
  chaseCamera,
  isOnVisibleSide,
  cameraCenter,
  type GlobeCamera,
} from '../components/TravelMap/globeUtils';
import type { FlightJourney } from '../types';

export interface GlobeTripContent {
  routeCodes: string[];
  dateLabel: string | null;
  /** Every stop on the trip, labelled - drawn from frame one, because
      the dots and names are where the journey is going (owner report,
      2026-08-19: "missing the cities"). */
  stops: { lon: number; lat: number; label: string }[];
}

/* The dark map's own palette, fixed: the film always ships the night
   globe whatever theme the viewer runs. */
const GLOBE_BG = '#0f0d0b';
const GLOBE_OCEAN = '#1a1817';
const GLOBE_LAND = '#3a352d';
const GLOBE_BORDER = '#6e6656';
const GLOBE_VISITED = '#b2622d';
const GLOBE_TEXT = '#f2e9dc';
const GLOBE_TEXT_MUTED = '#8d857a';
const GLOBE_TRAIL: Record<string, string> = {
  flight: '#f6a06b',
  ferry: '#7fa8d4',
};
const GLOBE_TRAIL_GROUND = '#7fb5b0';

export async function renderGlobeTripVideo(
  journey: FlightJourney,
  content: GlobeTripContent,
  /** Alpha-3 codes of the countries this trip touches - lit on the globe. */
  tripCountryIsos: Set<string>,
  onProgress?: (fraction: number) => void,
  durationMs = 9000,
): Promise<Blob> {
  const mimeType = pickMimeType();
  if (!mimeType) {
    throw new MapExportError('Your browser cannot record video');
  }
  const timeline = buildJourneyTimeline(journey);
  if (!timeline) {
    throw new MapExportError('This journey has nothing to fly yet');
  }

  const atlas = (await loadWorldAtlasCoarse()) as Topology<{
    countries: GeometryCollection;
  }>;
  const collection = feature(
    atlas,
    atlas.objects.countries,
  ) as FeatureCollection;
  // Resolved once: which features light up as visited-on-this-trip.
  const world = collection.features.map((item: Feature) => {
    const byId = numericToAlpha3[String(parseInt(String(item.id ?? ''), 10))];
    const byName =
      nameToAlpha3[(item.properties as { name?: string })?.name ?? ''];
    const alpha3 = byId ?? byName ?? null;
    return { feature: item, lit: alpha3 ? tripCountryIsos.has(alpha3) : false };
  });

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

  const centerX = CARD_WIDTH / 2;
  const centerY = CARD_HEIGHT / 2 + 40;
  const baseRadius = 420;
  const projection = geoOrthographic()
    .translate([centerX, centerY])
    .clipAngle(90);
  const spherePath = geoPath(projection, ctx);
  const graticule = geoGraticule10();
  const monoFont = (size: number, weight = '700') =>
    `${weight} ${size}px ui-monospace, SFMono-Regular, Menlo, monospace`;

  /*
    The film's zoom ceiling is far below the live globe's: past ~6 the
    disc's edge leaves the frame and the whole point of a GLOBE film -
    seeing the curvature roll by - is gone. Short hops sit closer to a
    visible horizon instead of filling the screen with one country.
  */
  const FILM_MAX_ZOOM = 6;
  const segments = timeline.segments;
  let camera: GlobeCamera = {
    rotation: [-segments[0].from[0], -segments[0].from[1]],
    zoom: Math.max(
      1.1,
      Math.min(segments[0].zoomTarget, FILM_MAX_ZOOM) * 0.8,
    ),
  };
  // The journey's real clock compressed into the film's runtime.
  const warp = timeline.totalS / (durationMs / 1000);

  const routeLine = content.routeCodes.join(' → ');

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
        let lastNow = start;
        const frame = (now: number) => {
          if (stopped) return;
          try {
            const elapsed = Math.max(0, now - start);
            const t = Math.min(elapsed / durationMs, 1);
            onProgress?.(t);
            const dtTimeline = Math.min((now - lastNow) / 1000, 0.05) * warp;
            lastNow = now;

            const timelineT = t * timeline.totalS;
            const planeFrame = samplePlaneFrame(timeline, timelineT);
            camera = chaseCamera(
              camera,
              planeFrame.position,
              Math.min(planeFrame.zoomTarget, FILM_MAX_ZOOM),
              dtTimeline,
            );
            projection
              .rotate([camera.rotation[0], camera.rotation[1]])
              .scale(baseRadius * camera.zoom);

            // The night sky, then the planet.
            ctx.fillStyle = GLOBE_BG;
            ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
            ctx.beginPath();
            spherePath({ type: 'Sphere' });
            ctx.fillStyle = GLOBE_OCEAN;
            ctx.fill();
            ctx.strokeStyle = 'rgba(110, 102, 86, 0.45)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.beginPath();
            spherePath(graticule);
            ctx.strokeStyle = 'rgba(255, 253, 246, 0.05)';
            ctx.lineWidth = 1;
            ctx.stroke();
            for (const { feature: country, lit } of world) {
              ctx.beginPath();
              spherePath(country);
              ctx.fillStyle = lit ? GLOBE_VISITED : GLOBE_LAND;
              ctx.fill();
              // A lit country wears a dark, heavier border - the muted
              // one vanished against the visited orange (owner report,
              // 2026-08-19).
              ctx.strokeStyle = lit ? '#1f1b18' : GLOBE_BORDER;
              ctx.lineWidth = lit ? 1.6 : 0.6;
              ctx.stroke();
            }

            // The trail so far, one stroke per leg in its mode's voice.
            for (const segment of segments) {
              if (timelineT <= segment.startS) break;
              const flown = Math.min(
                1,
                (timelineT - segment.startS) /
                  Math.max(segment.endS - segment.startS, 0.001),
              );
              const points: [number, number][] = [];
              const steps = 32;
              for (let k = 0; k <= steps; k++) {
                points.push(segment.interpolate((k / steps) * flown));
              }
              ctx.beginPath();
              spherePath({ type: 'LineString', coordinates: points });
              const mode = segment.mode;
              ctx.strokeStyle = GLOBE_TRAIL[mode] ?? GLOBE_TRAIL_GROUND;
              ctx.lineWidth = 3;
              ctx.lineCap = 'round';
              if (mode !== 'flight' && mode !== 'ferry') {
                ctx.setLineDash([1, 8]);
              } else if (mode === 'ferry') {
                ctx.setLineDash([8, 7]);
              }
              ctx.stroke();
              ctx.setLineDash([]);
            }

            // Every stop, pinned and NAMED from frame one - the dots
            // and city names are where the journey is going, same rule
            // the flat trip film settled on.
            const center = cameraCenter(camera.rotation);
            for (const stop of content.stops) {
              if (!isOnVisibleSide([stop.lon, stop.lat], center)) continue;
              const pinned = projection([stop.lon, stop.lat]);
              if (!pinned) continue;
              ctx.beginPath();
              ctx.arc(pinned[0], pinned[1], 6, 0, Math.PI * 2);
              ctx.fillStyle = '#f9f4ed';
              ctx.fill();
              ctx.strokeStyle = GLOBE_BG;
              ctx.lineWidth = 2;
              ctx.stroke();
              ctx.font = monoFont(24, '600');
              ctx.textAlign = 'center';
              ctx.strokeStyle = GLOBE_BG;
              ctx.lineWidth = 5;
              ctx.lineJoin = 'round';
              ctx.strokeText(stop.label, pinned[0], pinned[1] - 16);
              ctx.fillStyle = GLOBE_TEXT;
              ctx.fillText(stop.label, pinned[0], pinned[1] - 16);
              ctx.textAlign = 'left';
            }

            // The vehicle, on the visible side only.
            if (
              isOnVisibleSide(
                planeFrame.position,
                cameraCenter(camera.rotation),
              )
            ) {
              const position = projection(planeFrame.position);
              const ahead = projection(planeFrame.ahead);
              if (position && ahead) {
                drawVehicleSprite(ctx, planeFrame.mode, {
                  x: position[0],
                  y: position[1],
                  angle: Math.atan2(
                    ahead[1] - position[1],
                    ahead[0] - position[0],
                  ),
                  scale: 1.5 * planeFrame.altitude,
                  fill: VEHICLE_INK,
                  outline: HALO_COLOR,
                  timeMs: elapsed,
                });
              }
            }

            // The title block: route codes shrink-to-fit, date beneath.
            ctx.textAlign = 'center';
            let titleSize = 46;
            ctx.font = monoFont(titleSize);
            while (
              ctx.measureText(routeLine).width > CARD_WIDTH - 100 &&
              titleSize > 22
            ) {
              titleSize -= 2;
              ctx.font = monoFont(titleSize);
            }
            ctx.fillStyle = GLOBE_TEXT;
            ctx.fillText(routeLine, centerX, 96);
            if (content.dateLabel) {
              ctx.font = monoFont(26, '600');
              ctx.fillStyle = GLOBE_TEXT_MUTED;
              ctx.fillText(content.dateLabel, centerX, 140);
            }
            ctx.font = monoFont(24, '600');
            ctx.fillStyle = GLOBE_TEXT_MUTED;
            ctx.fillText('mycontrail.com', centerX, CARD_HEIGHT - 48);
            ctx.textAlign = 'left';

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
