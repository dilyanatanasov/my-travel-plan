/*
  The one aircraft, everywhere it flies.

  The live replay, the globe, the whole-map share video and the trip video
  all draw "the plane" - and for a while they drew two different planes:
  the map's airliner silhouette and an older dart left behind in the video
  exporter (owner report, 2026-08-17). The glyph, its wingtip light
  positions and the canvas painter live here so no renderer can drift
  again. SVG renderers import the path and light geometry and animate via
  CSS; canvas renderers call drawPlaneSprite with a clock.
*/

/**
 * Airliner silhouette in a 24x24 box, nose pointing right (+x): tapered
 * fuselage, swept wings, tailplane and tail cone. Vector on purpose - the
 * glyph scales mid-flight and recolors with the theme, both of which a
 * raster plane cannot survive.
 *
 * The direction matters: rotation code aligns +x with the path tangent,
 * so a nose-up drawing would fly permanently sideways.
 */
export const PLANE_PATH =
  'M21.8 12 C22 11.4 21 10.9 19.5 10.9 L14.5 10.9 L9.5 5.2 L7.6 5.2 L11.4 10.9 ' +
  'L5.8 10.9 L3.4 8.6 L2.2 8.6 L3.6 11.2 L2.6 11.6 L2.6 12.4 L3.6 12.8 ' +
  'L2.2 15.4 L3.4 15.4 L5.8 13.1 L11.4 13.1 L7.6 18.8 L9.5 18.8 L14.5 13.1 ' +
  'L19.5 13.1 C21 13.1 22 12.6 21.8 12 Z';

/*
  Navigation lights, the real aviation scheme: red on the port (left)
  wingtip, green on starboard, a white strobe at the tail. With the nose
  on +x and y growing downward, port is the top wing. Coordinates are in
  the glyph's own 24-unit space, at the wingtip trailing corners.
*/
export const PLANE_LIGHTS = {
  port: { x: 8.5, y: 5.2, color: '#ff453a' },
  starboard: { x: 8.5, y: 18.8, color: '#30d158' },
  strobe: { x: 2.4, y: 12, color: '#ffffff' },
} as const;

/**
 * Light brightness at a moment, shared by every canvas renderer so the
 * videos blink in the same rhythm. Port and starboard pulse in antiphase -
 * a left-right twinkle - and the strobe double-flashes like the real
 * thing: flash, flash, dark.
 */
export function planeLightAlphas(timeMs: number): {
  port: number;
  starboard: number;
  strobe: number;
} {
  const wave = 0.5 + 0.5 * Math.sin((timeMs / 900) * Math.PI * 2);
  const phase = timeMs % 1300;
  const strobeOn = phase < 90 || (phase >= 180 && phase < 270);
  return {
    port: 0.45 + 0.55 * wave,
    starboard: 0.45 + 0.55 * (1 - wave),
    strobe: strobeOn ? 1 : 0,
  };
}

/*
  The land vehicles (2026-08-17), same 24-unit box, same nose-on-+x rule
  as the plane so one rotation model drives them all. Side-view
  silhouettes with wheels as subpaths: recognisable at 13px, honest at
  video scale.
*/
export const VEHICLE_PATHS: Record<'train' | 'car' | 'bus' | 'ferry', string> = {
  // A locomotive pulling two wagons (owner ask, 2026-08-18): the gaps
  // between the bodies are what make it read as a train and not a bus.
  train:
    'M14 8.2 Q14 7.4 14.8 7.4 L18 7.4 Q20.2 7.4 21.6 9.4 L22.3 10.6 ' +
    'Q22.7 11.3 22.7 12.1 L22.7 14.4 Q22.7 15.2 21.9 15.2 L14.8 15.2 ' +
    'Q14 15.2 14 14.4 Z ' +
    'M8 8.6 Q8 7.9 8.7 7.9 L12.5 7.9 Q13.2 7.9 13.2 8.6 L13.2 14.5 ' +
    'Q13.2 15.2 12.5 15.2 L8.7 15.2 Q8 15.2 8 14.5 Z ' +
    'M2.2 8.6 Q2.2 7.9 2.9 7.9 L6.7 7.9 Q7.4 7.9 7.4 8.6 L7.4 14.5 ' +
    'Q7.4 15.2 6.7 15.2 L2.9 15.2 Q2.2 15.2 2.2 14.5 Z ' +
    'M14.7 15.7 a1.3 1.3 0 1 0 2.6 0 a1.3 1.3 0 1 0 -2.6 0 ' +
    'M18.7 15.7 a1.3 1.3 0 1 0 2.6 0 a1.3 1.3 0 1 0 -2.6 0 ' +
    'M8.2 15.7 a1.2 1.2 0 1 0 2.4 0 a1.2 1.2 0 1 0 -2.4 0 ' +
    'M10.8 15.7 a1.2 1.2 0 1 0 2.4 0 a1.2 1.2 0 1 0 -2.4 0 ' +
    'M2.4 15.7 a1.2 1.2 0 1 0 2.4 0 a1.2 1.2 0 1 0 -2.4 0 ' +
    'M5 15.7 a1.2 1.2 0 1 0 2.4 0 a1.2 1.2 0 1 0 -2.4 0',
  car:
    'M2.6 14.6 L3.2 11.6 Q3.4 10.5 4.5 10.5 L8.4 10.5 L10.9 7.7 Q11.3 7.2 12 7.2 ' +
    'L15.8 7.2 Q16.6 7.2 17 7.9 L18.6 10.5 L20.4 11 Q21.2 11.2 21.2 12.1 ' +
    'L21.2 13.6 Q21.2 14.6 20.2 14.6 Z ' +
    'M5.2 15 a1.8 1.8 0 1 0 3.6 0 a1.8 1.8 0 1 0 -3.6 0 ' +
    'M14.8 15 a1.8 1.8 0 1 0 3.6 0 a1.8 1.8 0 1 0 -3.6 0',
  bus:
    'M2.6 8.2 Q2.6 7.2 3.6 7.2 L19.8 7.2 Q21.4 7.2 21.4 8.8 L21.4 14.2 ' +
    'Q21.4 15.2 20.4 15.2 L3.6 15.2 Q2.6 15.2 2.6 14.2 Z ' +
    'M4.9 15.6 a1.7 1.7 0 1 0 3.4 0 a1.7 1.7 0 1 0 -3.4 0 ' +
    'M15.7 15.6 a1.7 1.7 0 1 0 3.4 0 a1.7 1.7 0 1 0 -3.4 0',
  ferry:
    'M2.5 13 L21.5 13 L19 16.5 Q18.6 17 18 17 L6 17 Q5.4 17 5 16.5 Z ' +
    'M8 12 L8 9.3 Q8 8.5 8.8 8.5 L15.2 8.5 Q16 8.5 16 9.3 L16 12 Z',
};

/*
  Headlights (owner ask, 2026-08-18): the train gets one central lamp on
  the locomotive's nose with a beam cone lighting the way; the car (and
  bus) get a pair. Side-view perspective is cheated - two stacked dots
  read as "both headlights" at cartoon scale. Positions in glyph space;
  beams project toward +x, the direction of travel.
*/
export const VEHICLE_LIGHTS: Partial<
  Record<'train' | 'car' | 'bus' | 'ferry', { x: number; y: number }[]>
> = {
  train: [{ x: 22.2, y: 12 }],
  car: [
    { x: 21.1, y: 11.8 },
    { x: 21.1, y: 13.5 },
  ],
  bus: [
    { x: 21.3, y: 11.6 },
    { x: 21.3, y: 13.6 },
  ],
};

export const HEADLIGHT_COLOR = '#fff3c4';
export const HEADLIGHT_BEAM_COLOR = '#ffd875';

/** Beam length and half-spread in glyph units - shared by SVG and canvas. */
export const BEAM_LENGTH = 7;
export const BEAM_SPREAD = 2.3;

/** The lamp's living glow: a soft pulse, never fully off - headlights
    stay on; only their halo breathes. */
export function headlightAlphas(timeMs: number): { lamp: number; beam: number } {
  return {
    lamp: 0.8 + 0.2 * Math.sin(timeMs / 260),
    beam: 0.17 + 0.06 * Math.sin(timeMs / 190),
  };
}

export interface PlaneSpriteOptions {
  x: number;
  y: number;
  /** Radians; 0 flies toward +x. */
  angle: number;
  /** Multiplier on the 24-unit box. */
  scale: number;
  fill: string;
  outline: string;
  /** Frame clock for the lights; freezes them when omitted. */
  timeMs?: number;
  /** Soft pulsing disc under the plane - the "where is it" beacon. */
  beacon?: { color: string; alpha?: number };
}

const glyphCache = new Map<string, Path2D>();

function glyphFor(path: string): Path2D {
  let glyph = glyphCache.get(path);
  if (!glyph) {
    glyph = new Path2D(path);
    glyphCache.set(path, glyph);
  }
  return glyph;
}

/** Paint the aircraft - beacon, silhouette, blinking lights - on a canvas. */
export function drawPlaneSprite(
  ctx: CanvasRenderingContext2D,
  options: PlaneSpriteOptions,
): void {
  const { x, y, angle, scale, fill, outline, timeMs = 0, beacon } = options;
  const glyph = glyphFor(PLANE_PATH);

  if (beacon) {
    const pulse = (14 + 4 * Math.sin(timeMs / 140)) * (scale / 1.8);
    ctx.beginPath();
    ctx.arc(x, y, pulse, 0, Math.PI * 2);
    ctx.fillStyle = beacon.color;
    ctx.globalAlpha = beacon.alpha ?? 0.18;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  ctx.translate(-12, -12);
  ctx.fillStyle = fill;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 0.9;
  ctx.fill(glyph);
  ctx.stroke(glyph);

  const alphas = planeLightAlphas(timeMs);
  for (const [name, light] of Object.entries(PLANE_LIGHTS)) {
    const alpha = alphas[name as keyof typeof alphas];
    if (alpha <= 0.01) continue;
    // Halo first, then the point: two circles beat shadowBlur, which is
    // costly enough per frame to matter at 30fps.
    ctx.globalAlpha = alpha * 0.35;
    ctx.beginPath();
    ctx.arc(light.x, light.y, 2.6, 0, Math.PI * 2);
    ctx.fillStyle = light.color;
    ctx.fill();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(light.x, light.y, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

/**
 * Paint the leg's own vehicle: the plane (lights and all) for flights,
 * the mode's silhouette for land legs. One call site per renderer, so a
 * mixed journey swaps vehicles by just passing each leg's mode.
 */
export function drawVehicleSprite(
  ctx: CanvasRenderingContext2D,
  mode: 'flight' | 'train' | 'car' | 'bus' | 'ferry',
  options: PlaneSpriteOptions,
): void {
  if (mode === 'flight') {
    drawPlaneSprite(ctx, options);
    return;
  }
  const { x, y, angle, scale, fill, outline, timeMs = 0, beacon } = options;
  const glyph = glyphFor(VEHICLE_PATHS[mode]);

  if (beacon) {
    const pulse = (14 + 4 * Math.sin(timeMs / 140)) * (scale / 1.8);
    ctx.beginPath();
    ctx.arc(x, y, pulse, 0, Math.PI * 2);
    ctx.fillStyle = beacon.color;
    ctx.globalAlpha = beacon.alpha ?? 0.18;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  ctx.translate(-12, -12);
  ctx.fillStyle = fill;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 0.9;
  ctx.fill(glyph);
  ctx.stroke(glyph);

  // Headlights: beam cones first (under the lamps), then the lamps.
  const lights = VEHICLE_LIGHTS[mode];
  if (lights) {
    const { lamp, beam } = headlightAlphas(timeMs);
    for (const light of lights) {
      ctx.globalAlpha = beam;
      ctx.beginPath();
      ctx.moveTo(light.x + 0.2, light.y);
      ctx.lineTo(light.x + BEAM_LENGTH, light.y - BEAM_SPREAD);
      ctx.lineTo(light.x + BEAM_LENGTH, light.y + BEAM_SPREAD);
      ctx.closePath();
      ctx.fillStyle = HEADLIGHT_BEAM_COLOR;
      ctx.fill();
      ctx.globalAlpha = lamp;
      ctx.beginPath();
      ctx.arc(light.x, light.y, 1, 0, Math.PI * 2);
      ctx.fillStyle = HEADLIGHT_COLOR;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
