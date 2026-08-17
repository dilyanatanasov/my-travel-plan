/**
 * The shareable card, in three styles.
 *
 * 1080×1350 (4:5) because that is the largest portrait frame Instagram shows
 * without cropping, and it also fits a Story with room to spare.
 *
 * The same function produces the on-screen preview and the downloaded file —
 * the preview is the export, scaled down. Two code paths would drift, and the
 * one thing worse than an ugly card is a preview that lies about it.
 *
 * No html2canvas: react-simple-maps renders a real inline <svg> with
 * serialisable paths and no external raster images, so the canvas is never
 * tainted and the output stays crisp.
 */

export type ShareStyle = 'warm' | 'ink' | 'editorial' | 'ticket' | 'story';

export interface ShareContent {
  /** e.g. "21 countries and counting" */
  headline: string;
  /** Small line above the headline. */
  kicker: string;
  /** Up to four label/value pairs. */
  facts: { label: string; value: string }[];
  /** The single number Ink builds itself around. */
  hero: { value: string; caption: string };
  /** displayName for the Ticket style's PASSENGER stub; null → TRAVELLER. */
  passenger?: string | null;
}

interface Palette {
  bg: string;
  text: string;
  muted: string;
  accent: string;
  mapBg: string;
}

const PALETTES: Record<ShareStyle, Palette> = {
  warm: {
    bg: '#f5ead8',
    text: '#201e1d',
    muted: '#645c50',
    accent: '#8c491a',
    mapBg: '#f5ead8',
  },
  ink: {
    bg: '#201e1d',
    text: '#f9f4ed',
    muted: '#c0b6a5',
    accent: '#f6a06b',
    mapBg: '#1a1817',
  },
  editorial: {
    bg: '#f9f4ed',
    text: '#201e1d',
    muted: '#645c50',
    accent: '#402310',
    mapBg: '#8fa073',
  },
  // Mirrors the TICKET constants; listed here so the Record stays total.
  ticket: {
    bg: '#e3d3b7',
    text: '#201e1d',
    muted: '#645c50',
    accent: '#8c491a',
    mapBg: '#f8f0e1',
  },
  // Story wears Warm's colours at 9:16 - the format is the feature.
  story: {
    bg: '#f5ead8',
    text: '#201e1d',
    muted: '#645c50',
    accent: '#8c491a',
    mapBg: '#f5ead8',
  },
};

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;
/*
  Instagram/WhatsApp stories are 9:16; the 4:5 card gets letterboxed with
  dead bars there (owner feedback, 2026-08-17). Story is the same card
  language recomposed for the tall frame.
*/
export const STORY_WIDTH = 1080;
export const STORY_HEIGHT = 1920;

export class ShareCardError extends Error {}

const body = (size: number, weight = '400') =>
  `${weight} ${size}px Figtree, system-ui, -apple-system, "Segoe UI", sans-serif`;
const display = (size: number) =>
  `400 ${size}px Caprasimo, Georgia, serif`;
const mono = (size: number, weight = '700') =>
  `${weight} ${size}px ui-monospace, SFMono-Regular, Menlo, monospace`;

function serializeSvg(svg: SVGSVGElement, width: number, height: number): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.removeAttribute('class');
  clone.removeAttribute('style');
  return new XMLSerializer().serializeToString(clone);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new ShareCardError('The map image could not be rendered'));
    image.src = src;
  });
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Shrink until it fits; long display names and headlines otherwise run off. */
function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startSize: number,
  fontFor: (size: number) => string,
): number {
  let size = startSize;
  ctx.font = fontFor(size);
  while (ctx.measureText(text).width > maxWidth && size > 14) {
    size -= 2;
    ctx.font = fontFor(size);
  }
  return size;
}

/** Wrap into at most `maxLines`, ellipsising the last if it overflows. */
function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) return lines;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, maxLines);
}

/**
 * Draw the map to fit entirely inside a box.
 *
 * Cover-cropping a 2:1 map into a nearly-square block throws away more than
 * half its width - which cut the user's countries off the Warm and Ink cards
 * while Editorial, whose band is close to 2:1, looked right. Now the map is
 * framed to the traveller's own region, cropping is exactly the wrong move:
 * there is no filler at the edges to lose.
 *
 * Any leftover space is covered by the block's backdrop, which is set to the
 * map's ocean colour so the fit is invisible.
 */
function drawMapContain(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const scale = Math.min(w / image.width, h / image.height);
  const dw = image.width * scale;
  const dh = image.height * scale;
  ctx.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

/**
 * Fill a box with the map, cropping the overflow.
 *
 * Only for Editorial's full-bleed band, which is close enough to the source's
 * aspect that the crop takes ocean rather than countries - and where a
 * letterbox would break the edge-to-edge effect that style exists for.
 */
function drawMapCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const scale = Math.max(w / image.width, h / image.height);
  const dw = image.width * scale;
  const dh = image.height * scale;
  ctx.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

/**
 * Wait until the world's geography is actually in the SVG.
 *
 * The countries come from a fetched TopoJSON while the routes come from data
 * already in the store, so there is a window where the map has paths - the
 * routes - but no land. Checking merely for "a path" passed in that window
 * and produced a card showing flight lines floating over an empty ocean.
 *
 * countries-110m carries ~177 features, so a threshold well above the number
 * of routes anyone will have distinguishes land from lines without needing to
 * reach inside react-simple-maps.
 *
 * The timeout is generous because the geography comes from a CDN on a cold
 * load. A short one meant the very first visit to Share timed out and
 * dead-ended, while every later visit worked from the browser cache - which
 * reads as "it only breaks the first time".
 */
const MIN_GEOGRAPHY_PATHS = 60;

async function waitForGeography(svg: SVGSVGElement, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  const ready = () =>
    svg.querySelectorAll('path').length >= MIN_GEOGRAPHY_PATHS &&
    // The canvas frames itself on the user's countries once their centroids
    // are known. Without waiting for that we would capture the unframed
    // first paint - the whole globe - and the card would disagree with the
    // map the user was just looking at.
    svg.getAttribute('data-framed') === '1';

  while (!ready()) {
    if (Date.now() > deadline) {
      throw new ShareCardError(
        'The map is still loading - try again in a moment',
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // One frame for the reframed view to paint before it is serialised.
  await new Promise((resolve) => requestAnimationFrame(resolve));
}

export async function renderShareCard(
  svg: SVGSVGElement,
  content: ShareContent,
  style: ShareStyle,
): Promise<Blob> {
  const srcWidth =
    Number(svg.getAttribute('width')) || svg.getBoundingClientRect().width;
  const srcHeight =
    Number(svg.getAttribute('height')) || svg.getBoundingClientRect().height;

  if (!srcWidth || !srcHeight) {
    throw new ShareCardError('The map is not ready yet - try again in a moment');
  }
  await waitForGeography(svg);

  // Webfonts must be resolved before measuring, or every fitFont call measures
  // the fallback and the finished card is mis-sized.
  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      /* fall back to whatever is loaded */
    }
  }

  const mapImage = await loadImage(
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
      serializeSvg(svg, srcWidth, srcHeight),
    )}`,
  );

  const canvas = document.createElement('canvas');
  canvas.width = style === 'story' ? STORY_WIDTH : CARD_WIDTH;
  canvas.height = style === 'story' ? STORY_HEIGHT : CARD_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ShareCardError('Your browser could not create the image');

  const p = PALETTES[style];
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textBaseline = 'top';

  if (style === 'ticket') {
    // The ticket paints its own ground and carries the domain on its stub,
    // so the shared palette background and watermark both stay out.
    const stubTop = drawTicketShell(ctx);
    drawTicket(ctx, mapImage, content, stubTop);
    drawTicketStub(ctx, stubTop, content.passenger ?? null);
  } else if (style === 'editorial') {
    drawEditorial(ctx, mapImage, content, p);
  } else if (style === 'ink') {
    drawInk(ctx, mapImage, content, p);
  } else if (style === 'story') {
    drawStory(ctx, mapImage, content, p);
  } else {
    drawWarm(ctx, mapImage, content, p);
  }

  if (style !== 'ticket') drawWatermark(ctx, p, canvas.width, canvas.height);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new ShareCardError('Your browser could not create the image'));
    }, 'image/png');
  });
}

/* ------------------------------------------------------------------ */
/* Trip card: one journey as a boarding pass (2026-08-14).             */
/* ------------------------------------------------------------------ */

export interface TripContent {
  /** Stop chain, e.g. ["SOF", "AMS", "NRT"]. */
  routeCodes: string[];
  /** Precision-aware date label, or null for an undated journey. */
  dateLabel: string | null;
  flights: number;
  km: number;
  /** displayName, shown as PASSENGER on the stub; null → TRAVELLER. */
  passenger: string | null;
}

/** Off-screen canvas id for the trip card - distinct from the map card's. */
export const TRIP_SVG_ID = 'trip-export-canvas';

/** Can this browser share a file, rather than only a link? */
export function canShareFiles(file: File): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })
  );
}

/** Poll for an export SVG by id; shared by the share panel and trip dialog. */
export async function findExportSvg(
  id: string,
  isCancelled: () => boolean,
  timeoutMs = 6000,
): Promise<SVGSVGElement | null> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const found = document.getElementById(id) as SVGSVGElement | null;
    // isConnected guards against grabbing a node mid-remount: a detached
    // SVG never loads geography, so we would wait for it until timeout.
    if ((found && found.isConnected) || Date.now() > deadline || isCancelled()) {
      return found;
    }
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
}

const TICKET = {
  bg: '#e3d3b7',
  paper: '#f8f0e1',
  text: '#201e1d',
  muted: '#645c50',
  accent: '#8c491a',
};

/* Shared ticket chrome - used by the trip card and the map's Ticket style. */

const TICKET_INSET = 24;

/** Paper on ground; returns the perforation line's y. */
function drawTicketShell(ctx: CanvasRenderingContext2D): number {
  const T = TICKET_INSET;
  ctx.fillStyle = TICKET.bg;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  roundedRect(ctx, T, T, CARD_WIDTH - T * 2, CARD_HEIGHT - T * 2, 48);
  ctx.fillStyle = TICKET.paper;
  ctx.fill();
  return CARD_HEIGHT - T - 170;
}

function drawTicketPair(
  ctx: CanvasRenderingContext2D,
  label: string,
  value: string,
  x: number,
  y: number,
  alignRight = false,
) {
  if (alignRight) ctx.textAlign = 'right';
  ctx.font = mono(20, '600');
  ctx.fillStyle = TICKET.muted;
  ctx.fillText(label, x, y);
  ctx.font = mono(40, '700');
  ctx.fillStyle = TICKET.text;
  ctx.fillText(value, x, y + 30);
  ctx.textAlign = 'left';
}

/** Dashed tear line with edge notches, then the PASSENGER/domain stub. */
function drawTicketStub(
  ctx: CanvasRenderingContext2D,
  stubTop: number,
  passenger: string | null,
) {
  const T = TICKET_INSET;
  const P = 88;
  ctx.strokeStyle = TICKET.muted;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 3;
  ctx.setLineDash([4, 16]);
  ctx.beginPath();
  ctx.moveTo(T + 44, stubTop);
  ctx.lineTo(CARD_WIDTH - T - 44, stubTop);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  ctx.fillStyle = TICKET.bg;
  for (const notchX of [T, CARD_WIDTH - T]) {
    ctx.beginPath();
    ctx.arc(notchX, stubTop, 26, 0, Math.PI * 2);
    ctx.fill();
  }
  const stubY = stubTop + 44;
  drawTicketPair(ctx, 'PASSENGER', (passenger ?? 'Traveller').toUpperCase(), P, stubY);
  ctx.textAlign = 'right';
  ctx.font = mono(26, '600');
  ctx.fillStyle = TICKET.accent;
  ctx.fillText('mycontrail.com', CARD_WIDTH - P, stubY + 34);
  ctx.textAlign = 'left';
}

function drawTicketHeader(ctx: CanvasRenderingContext2D, y: number) {
  const P = 88;
  ctx.font = mono(26, '600');
  ctx.fillStyle = TICKET.accent;
  ctx.fillText('MYCONTRAIL', P, y);
  ctx.fillStyle = TICKET.muted;
  ctx.textAlign = 'right';
  ctx.fillText('BOARDING PASS', CARD_WIDTH - P, y);
  ctx.textAlign = 'left';
}

/** The whole-map Ticket style: same paper, the life map in the strip. */
function drawTicket(
  ctx: CanvasRenderingContext2D,
  map: HTMLImageElement,
  content: ShareContent,
  stubTop: number,
) {
  const P = 88;
  const inner = CARD_WIDTH - P * 2;

  const headline = content.headline.toUpperCase();
  const headlineSize = fitFont(ctx, headline, inner, 72, (s) => mono(s, '700'));
  ctx.font = mono(headlineSize, '700');
  const lines = wrap(ctx, headline, inner, 2);
  const headlineH = lines.length * headlineSize * 1.15;

  const rowH = 20 + 10 + 40;
  const mapX = TICKET_INSET + 40;
  const mapW = CARD_WIDTH - mapX * 2;
  const mapH = mapW / 2;
  const contentTop = TICKET_INSET + 56;
  const blocksH = 30 + headlineH + rowH + mapH + rowH;
  const gap = Math.max(28, (stubTop - 40 - contentTop - blocksH) / 5);

  let y = contentTop;
  drawTicketHeader(ctx, y);
  y += 30 + gap;

  ctx.font = mono(headlineSize, '700');
  ctx.fillStyle = TICKET.text;
  lines.forEach((line, i) => ctx.fillText(line, P, y + i * headlineSize * 1.15));
  y += headlineH + gap;

  const [first, second, third, fourth] = content.facts;
  if (first) drawTicketPair(ctx, first.label.toUpperCase(), first.value, P, y);
  if (second)
    drawTicketPair(ctx, second.label.toUpperCase(), second.value, CARD_WIDTH - P, y, true);
  y += rowH + gap;

  ctx.save();
  roundedRect(ctx, mapX, y, mapW, mapH, 36);
  ctx.clip();
  // Backdrop first: any contain slack must read as paper, not a white bar.
  ctx.fillStyle = TICKET.paper;
  ctx.fillRect(mapX, y, mapW, mapH);
  drawMapContain(ctx, map, mapX, y, mapW, mapH);
  ctx.restore();
  y += mapH + gap;

  if (third) drawTicketPair(ctx, third.label.toUpperCase(), third.value, P, y);
  if (fourth)
    drawTicketPair(ctx, fourth.label.toUpperCase(), fourth.value, CARD_WIDTH - P, y, true);
}

/** Where the trip ticket put its map strip, and how the source fits in it. */
export interface TripMapPlacement {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  /** The contain transform: source px → card px. */
  scale: number;
  dx: number;
  dy: number;
}

/**
 * The whole boarding pass drawn onto a context; the map strip takes
 * whatever image it is given. Returns the strip's placement so the video
 * renderer can animate inside the same frame the still card uses -
 * "I lose my passport design" (owner, 2026-08-17) was the still and the
 * video wearing different clothes.
 */
function drawTripTicket(
  ctx: CanvasRenderingContext2D,
  mapImage: HTMLImageElement,
  trip: TripContent,
): TripMapPlacement {
  ctx.textBaseline = 'top';

  /* The ticket: a rounded paper card inset on a darker ground, so the
     perforation notches read as cut-outs rather than decoration. */
  const T = TICKET_INSET;
  const stubTop = drawTicketShell(ctx);
  const P = 88;
  const inner = CARD_WIDTH - P * 2;

  // Measure the route before laying anything out.
  const route = trip.routeCodes.join(' → ');
  const routeSize = fitFont(ctx, route, inner, 84, (s) => mono(s, '700'));
  ctx.font = mono(routeSize, '700');
  const routeLines = wrap(ctx, route, inner, 2);
  const routeH = routeLines.length * routeSize * 1.15;

  const rowH = 20 + 10 + 40;
  const mapX = T + 40;
  const mapW = CARD_WIDTH - mapX * 2;
  const mapH = mapW / 2;

  const contentTop = T + 56;
  const blocksH = 30 + routeH + rowH + mapH + rowH;
  const gap = Math.max(28, (stubTop - 40 - contentTop - blocksH) / 5);

  let y = contentTop;
  drawTicketHeader(ctx, y);
  y += 30 + gap;

  ctx.font = mono(routeSize, '700');
  ctx.fillStyle = TICKET.text;
  routeLines.forEach((line, i) =>
    ctx.fillText(line, P, y + i * routeSize * 1.15),
  );
  y += routeH + gap;

  drawTicketPair(ctx, 'DATE', (trip.dateLabel ?? '—').toUpperCase(), P, y);
  drawTicketPair(ctx, 'FLIGHTS', String(trip.flights), CARD_WIDTH - P, y, true);
  y += rowH + gap;

  const mapY = y;
  ctx.save();
  roundedRect(ctx, mapX, mapY, mapW, mapH, 36);
  ctx.clip();
  // Backdrop first: any contain slack must read as paper, not a white bar.
  ctx.fillStyle = TICKET.paper;
  ctx.fillRect(mapX, mapY, mapW, mapH);
  drawMapContain(ctx, mapImage, mapX, mapY, mapW, mapH);
  ctx.restore();
  y += mapH + gap;

  drawTicketPair(
    ctx,
    'DISTANCE',
    `${Math.round(trip.km).toLocaleString()} KM`,
    P,
    y,
  );
  drawTicketPair(
    ctx,
    'STOPS',
    String(Math.max(trip.routeCodes.length - 2, 0)),
    CARD_WIDTH - P,
    y,
    true,
  );

  drawTicketStub(ctx, stubTop, trip.passenger);

  const scale = Math.min(mapW / mapImage.width, mapH / mapImage.height);
  return {
    x: mapX,
    y: mapY,
    w: mapW,
    h: mapH,
    r: 36,
    scale,
    dx: mapX + (mapW - mapImage.width * scale) / 2,
    dy: mapY + (mapH - mapImage.height * scale) / 2,
  };
}

/**
 * The boarding pass with a given map image already fitted in its strip -
 * the video's per-frame backdrop. The caller supplies a ROUTELESS map so
 * the animation owns the trails; placement maps source pixels into the
 * strip for exactly that.
 */
export async function renderTripCardTemplate(
  trip: TripContent,
  routelessMap: HTMLImageElement,
): Promise<{ canvas: HTMLCanvasElement; placement: TripMapPlacement }> {
  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      /* fall back to whatever is loaded */
    }
  }
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ShareCardError('Your browser could not create the image');
  const placement = drawTripTicket(ctx, routelessMap, trip);
  return { canvas, placement };
}

export async function renderTripCard(
  svg: SVGSVGElement,
  trip: TripContent,
): Promise<Blob> {
  const srcWidth =
    Number(svg.getAttribute('width')) || svg.getBoundingClientRect().width;
  const srcHeight =
    Number(svg.getAttribute('height')) || svg.getBoundingClientRect().height;
  if (!srcWidth || !srcHeight) {
    throw new ShareCardError('The map is not ready yet - try again in a moment');
  }
  await waitForGeography(svg);
  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      /* fall back to whatever is loaded */
    }
  }

  const mapImage = await loadImage(
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
      serializeSvg(svg, srcWidth, srcHeight),
    )}`,
  );

  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ShareCardError('Your browser could not create the image');

  drawTripTicket(ctx, mapImage, trip);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new ShareCardError('Your browser could not create the image'));
    }, 'image/png');
  });
}

/**
 * The domain, bottom-right on every style. The kicker names the product but
 * a stranger seeing the card in a chat has no idea where it lives - the
 * watermark is the card's only actionable pointer back, i.e. the marketing.
 */
function drawWatermark(
  ctx: CanvasRenderingContext2D,
  p: Palette,
  width = CARD_WIDTH,
  height = CARD_HEIGHT,
) {
  ctx.save();
  ctx.font = mono(24, '600');
  ctx.fillStyle = p.muted;
  ctx.globalAlpha = 0.9;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('mycontrail.com', width - 72, height - 40);
  ctx.restore();
}

/*
  Warm and Ink share their geometry rules (2026-08-14 rework): the map block
  is near-full-bleed at the source's own 2:1 aspect - 1000×500, which
  contain-fits exactly, so no letterbox can appear inside the block - and the
  leftover card height is distributed evenly between the content blocks
  instead of pooling into one dead band above the facts, which is what
  "small map with gaps" was.
*/
const MAP_X = 40;
const MAP_W = CARD_WIDTH - MAP_X * 2;
const MAP_H = MAP_W / 2;

function drawMapBlock(
  ctx: CanvasRenderingContext2D,
  map: HTMLImageElement,
  y: number,
  p: Palette,
) {
  ctx.save();
  roundedRect(ctx, MAP_X, y, MAP_W, MAP_H, 40);
  ctx.clip();
  ctx.fillStyle = p.mapBg;
  ctx.fillRect(MAP_X, y, MAP_W, MAP_H);
  drawMapContain(ctx, map, MAP_X, y, MAP_W, MAP_H);
  ctx.restore();
}

function drawWarm(
  ctx: CanvasRenderingContext2D,
  map: HTMLImageElement,
  content: ShareContent,
  p: Palette,
) {
  const pad = 72;
  const inner = CARD_WIDTH - pad * 2;
  const topPad = 64;
  const bottomReserve = 120;

  // Measure before drawing: the gaps depend on every block's height.
  const size = fitFont(ctx, content.headline, inner, 96, display);
  ctx.font = display(size);
  const lines = wrap(ctx, content.headline, inner, 2);
  const headlineH = lines.length * size * 1.06;
  const factsH = 56 + 14 + 26;
  const blocksH = 28 + headlineH + MAP_H + factsH;
  const gap = Math.max(
    36,
    (CARD_HEIGHT - topPad - bottomReserve - blocksH) / 3,
  );

  let y = topPad;
  ctx.fillStyle = p.accent;
  ctx.font = mono(26, '600');
  ctx.fillText(content.kicker.toUpperCase(), pad, y);
  y += 28 + gap;

  ctx.font = display(size);
  ctx.fillStyle = p.text;
  lines.forEach((line, i) => ctx.fillText(line, pad, y + i * size * 1.06));
  y += headlineH + gap;

  drawMapBlock(ctx, map, y, p);
  y += MAP_H + gap;

  const columnWidth = inner / Math.max(Math.min(content.facts.length, 3), 1);
  content.facts.slice(0, 3).forEach((fact, i) => {
    const x = pad + i * columnWidth;
    ctx.fillStyle = p.text;
    ctx.font = display(56);
    ctx.fillText(fact.value, x, y);
    ctx.fillStyle = p.muted;
    ctx.font = body(24, '600');
    ctx.fillText(fact.label, x, y + 70);
  });
}

function drawInk(
  ctx: CanvasRenderingContext2D,
  map: HTMLImageElement,
  content: ShareContent,
  p: Palette,
) {
  const pad = 72;
  const inner = CARD_WIDTH - pad * 2;
  const topPad = 64;
  const bottomReserve = 110;

  // Measure first - same even-gap rule as Warm.
  const heroSize = fitFont(ctx, content.hero.value, inner, 190, display);
  const capSize = fitFont(ctx, content.hero.caption, inner, 30, (s) =>
    body(s, '600'),
  );
  const heroH = heroSize * 1.02 + capSize * 1.3;
  const blocksH = 34 + MAP_H + heroH;
  const gap = Math.max(
    40,
    (CARD_HEIGHT - topPad - bottomReserve - blocksH) / 2,
  );

  let y = topPad;
  ctx.fillStyle = p.accent;
  ctx.beginPath();
  ctx.arc(pad + 16, y + 14, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = mono(26, '600');
  ctx.fillText(content.kicker.toUpperCase(), pad + 48, y);
  y += 34 + gap;

  drawMapBlock(ctx, map, y, p);
  y += MAP_H + gap;

  ctx.font = display(heroSize);
  ctx.fillStyle = p.text;
  ctx.fillText(content.hero.value, pad, y);

  ctx.fillStyle = p.muted;
  ctx.font = body(capSize, '600');
  ctx.fillText(content.hero.caption.toUpperCase(), pad, y + heroSize * 1.02);
}

/**
 * Story: the Warm language recomposed for a 9:16 frame - kicker and
 * headline up top, the map in the middle, the hero number given the room
 * a phone screen offers, facts underneath. Even-gap rule as everywhere.
 */
function drawStory(
  ctx: CanvasRenderingContext2D,
  map: HTMLImageElement,
  content: ShareContent,
  p: Palette,
) {
  const pad = 84;
  const inner = STORY_WIDTH - pad * 2;
  const topPad = 140;
  const bottomReserve = 150;

  const mapW = inner;
  const mapH = mapW / 2;

  // Measure before drawing, same as Warm.
  const size = fitFont(ctx, content.headline, inner, 112, display);
  ctx.font = display(size);
  const lines = wrap(ctx, content.headline, inner, 2);
  const headlineH = lines.length * size * 1.06;
  const heroSize = fitFont(ctx, content.hero.value, inner, 230, display);
  const capSize = fitFont(ctx, content.hero.caption, inner, 34, (s) =>
    body(s, '600'),
  );
  const heroH = heroSize * 1.02 + capSize * 1.4;
  const factsH = 64 + 16 + 28;
  const blocksH = 32 + headlineH + mapH + heroH + factsH;
  const gap = Math.max(
    44,
    (STORY_HEIGHT - topPad - bottomReserve - blocksH) / 4,
  );

  let y = topPad;
  ctx.fillStyle = p.accent;
  ctx.font = mono(30, '600');
  ctx.fillText(content.kicker.toUpperCase(), pad, y);
  y += 32 + gap;

  ctx.font = display(size);
  ctx.fillStyle = p.text;
  lines.forEach((line, i) => ctx.fillText(line, pad, y + i * size * 1.06));
  y += headlineH + gap;

  ctx.save();
  roundedRect(ctx, pad, y, mapW, mapH, 44);
  ctx.clip();
  ctx.fillStyle = p.mapBg;
  ctx.fillRect(pad, y, mapW, mapH);
  drawMapContain(ctx, map, pad, y, mapW, mapH);
  ctx.restore();
  y += mapH + gap;

  ctx.font = display(heroSize);
  ctx.fillStyle = p.text;
  ctx.fillText(content.hero.value, pad, y);
  ctx.fillStyle = p.muted;
  ctx.font = body(capSize, '600');
  ctx.fillText(content.hero.caption.toUpperCase(), pad, y + heroSize * 1.02);
  y += heroH + gap;

  // The hero already owns its number; repeating it in the facts row read
  // as a copy-paste mistake in the first render.
  const facts = content.facts
    .filter((fact) => fact.value !== content.hero.value)
    .slice(0, 3);
  const columnWidth = inner / Math.max(Math.min(facts.length, 3), 1);
  facts.forEach((fact, i) => {
    const x = pad + i * columnWidth;
    ctx.fillStyle = p.text;
    ctx.font = display(60);
    ctx.fillText(fact.value, x, y);
    ctx.fillStyle = p.muted;
    ctx.font = body(26, '600');
    ctx.fillText(fact.label, x, y + 78);
  });
}

function drawEditorial(
  ctx: CanvasRenderingContext2D,
  map: HTMLImageElement,
  content: ShareContent,
  p: Palette,
) {
  // Full-bleed band: no rounding, no padding - the point of this one.
  const bandHeight = 620;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, CARD_WIDTH, bandHeight);
  ctx.clip();
  ctx.fillStyle = p.mapBg;
  ctx.fillRect(0, 0, CARD_WIDTH, bandHeight);
  drawMapCover(ctx, map, 0, 0, CARD_WIDTH, bandHeight);
  ctx.restore();

  const pad = 72;
  const inner = CARD_WIDTH - pad * 2;
  let y = bandHeight + 64;

  ctx.fillStyle = p.muted;
  ctx.font = mono(24, '600');
  ctx.fillText(content.kicker.toUpperCase(), pad, y);
  y += 46;

  const size = fitFont(ctx, content.headline, inner, 76, display);
  ctx.font = display(size);
  ctx.fillStyle = p.text;
  const lines = wrap(ctx, content.headline, inner, 2);
  lines.forEach((line, i) => ctx.fillText(line, pad, y + i * size * 1.05));
  y += lines.length * size * 1.05 + 40;

  ctx.strokeStyle = 'rgba(32,30,29,0.16)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pad, y);
  ctx.lineTo(CARD_WIDTH - pad, y);
  ctx.stroke();
  y += 46;

  // 2×2 grid of facts.
  const colWidth = inner / 2;
  content.facts.slice(0, 4).forEach((fact, i) => {
    const x = pad + (i % 2) * colWidth;
    const rowY = y + Math.floor(i / 2) * 130;
    ctx.fillStyle = p.text;
    ctx.font = display(44);
    ctx.fillText(fact.value, x, rowY);
    ctx.fillStyle = p.muted;
    ctx.font = body(23, '600');
    ctx.fillText(fact.label, x, rowY + 56);
  });
}
