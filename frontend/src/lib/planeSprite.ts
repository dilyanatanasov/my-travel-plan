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
/*
  Top view, like the plane (owner decision, 2026-08-18, picked from the
  design sheet): one perspective for the whole fleet. Windshield bands
  are CUTOUTS - render these with fill-rule evenodd or the glass
  disappears. The train's couplings are wider than the halo ring so its
  three cars never fuse into one pill.
*/
export const VEHICLE_PATHS: Record<'train' | 'car' | 'bus' | 'ferry', string> = {
  train:
    'M16.4 9.2 L20 9.2 Q22.8 9.2 22.8 12 Q22.8 14.8 20 14.8 L16.4 14.8 Z ' +
    'M19.4 9.9 L20.2 10.5 L20.2 13.5 L19.4 14.1 Z ' +
    'M9.4 9.2 L13.8 9.2 Q14.2 9.2 14.2 9.6 L14.2 14.4 Q14.2 14.8 13.8 14.8 ' +
    'L9.4 14.8 Q9 14.8 9 14.4 L9 9.6 Q9 9.2 9.4 9.2 Z ' +
    'M1.6 9.2 L6.2 9.2 Q6.6 9.2 6.6 9.6 L6.6 14.4 Q6.6 14.8 6.2 14.8 ' +
    'L1.6 14.8 Q1.2 14.8 1.2 14.4 L1.2 9.6 Q1.2 9.2 1.6 9.2 Z',
  car:
    'M5 8.2 L18.2 8.2 Q21.4 8.2 21.4 12 Q21.4 15.8 18.2 15.8 L5 15.8 ' +
    'Q3.4 15.8 3.4 12 Q3.4 8.2 5 8.2 Z ' +
    'M14.4 9 L16.2 9.8 L16.2 14.2 L14.4 15 Z ' +
    'M9.4 9 L7.8 9.8 L7.8 14.2 L9.4 15 Z ' +
    'M13.7 8.3 L14.9 7 L15.6 7.6 L14.5 8.5 Z ' +
    'M13.7 15.7 L14.9 17 L15.6 16.4 L14.5 15.5 Z',
  bus:
    'M3.2 9.2 L20 9.2 Q22.4 9.2 22.4 12 Q22.4 14.8 20 14.8 L3.2 14.8 ' +
    'Q1.8 14.8 1.8 12 Q1.8 9.2 3.2 9.2 Z ' +
    'M19 9.9 L19.8 10.5 L19.8 13.5 L19 14.1 Z',
  // Top view like the rest of the fleet (ferry UI, 2026-08-18): pointed
  // bow on +x, rounded stern, the superstructure as an evenodd cutout.
  ferry:
    'M4.4 9 L14.6 8.6 Q18.6 8.8 22.6 12 Q18.6 15.2 14.6 15.4 L4.4 15 ' +
    'Q2.2 14.6 2.2 12 Q2.2 9.4 4.4 9 Z ' +
    'M7.2 10.6 L13.4 10.4 Q14.4 10.4 14.4 11.2 L14.4 12.8 Q14.4 13.6 13.4 13.6 ' +
    'L7.2 13.4 Q6.4 13.4 6.4 12.6 L6.4 11.4 Q6.4 10.6 7.2 10.6 Z',
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
  train: [{ x: 22.6, y: 12 }],
  car: [
    { x: 21.1, y: 10.3 },
    { x: 21.1, y: 13.7 },
  ],
  bus: [
    { x: 22.1, y: 10.8 },
    { x: 22.1, y: 13.2 },
  ],
  // One masthead lamp at the bow, beam sweeping the water ahead.
  ferry: [{ x: 22.2, y: 12 }],
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

/*
  Halo geometry (owner pick, 2026-08-18): every vehicle wears a wide
  sticker-style ring in the outline color plus a thin inner stroke,
  which stays visible over selected countries where the old single
  stroke dissolved. The outline color remains theme-aware (the ocean
  tone): a light ring around ink on the light map, a dark ring around
  the pale glyph on the dark one - same contrast logic, both themes.
*/
export const HALO_WIDTH = 3.4;
export const HALO_INNER_WIDTH = 0.7;

/*
  The sticker's own colors (owner report, 2026-08-18: an ocean-toned
  halo blends into plain land, which is nearly the same cream). The
  approved design-sheet look is theme-INDEPENDENT: ink glyph, warm
  white ring - a sticker reads on any background, which is the point.
  The videos keep their own palettes (ticket ink, dark-backdrop rose).
*/
export const VEHICLE_INK = '#201e1d';
export const HALO_COLOR = '#fffdf6';

export interface PlaneSpriteOptions {
  x: number;
  y: number;
  /** Radians; 0 flies toward +x. */
  angle: number;
  /** Multiplier on the 24-unit box. */
  scale: number;
  fill: string;
  /** The halo ring color - theme-aware, usually the ocean tone. */
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
  ctx.lineJoin = 'round';
  ctx.strokeStyle = outline;
  ctx.globalAlpha = 0.95;
  ctx.lineWidth = HALO_WIDTH;
  ctx.stroke(glyph);
  ctx.globalAlpha = 1;
  ctx.fillStyle = fill;
  ctx.fill(glyph);
  ctx.lineWidth = HALO_INNER_WIDTH;
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
  ctx.lineJoin = 'round';

  // The ferry churns a wake (owner whim, 2026-08-18): diverging foam
  // strokes drifting astern, fading as they fall behind.
  if (mode === 'ferry') {
    const drift = (timeMs / 110) % 3.2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#f4fbfa';
    for (let k = 0; k < 3; k++) {
      const dist = k * 3.2 + drift;
      const alpha = Math.max(0, 0.55 - dist * 0.055);
      if (alpha <= 0.02) continue;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 1.1;
      const wx = 1.4 - dist;
      const spread = 1 + dist * 0.35;
      ctx.beginPath();
      ctx.moveTo(wx, 12 - spread);
      ctx.lineTo(wx + 2, 12 - spread * 0.4);
      ctx.moveTo(wx, 12 + spread);
      ctx.lineTo(wx + 2, 12 + spread * 0.4);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  ctx.strokeStyle = outline;
  ctx.globalAlpha = 0.95;
  ctx.lineWidth = HALO_WIDTH;
  ctx.stroke(glyph);
  ctx.globalAlpha = 1;
  ctx.fillStyle = fill;
  // evenodd: the windshield bands are cutouts, not decoration.
  ctx.fill(glyph, 'evenodd');
  ctx.lineWidth = HALO_INNER_WIDTH;
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
