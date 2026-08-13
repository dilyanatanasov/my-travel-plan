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

export type ShareStyle = 'warm' | 'ink' | 'editorial';

export interface ShareContent {
  /** e.g. "21 countries and counting" */
  headline: string;
  /** Small line above the headline. */
  kicker: string;
  /** Up to four label/value pairs. */
  facts: { label: string; value: string }[];
  /** The single number Ink builds itself around. */
  hero: { value: string; caption: string };
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
};

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;

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
 * half its width — which cut the user's countries off the Warm and Ink cards
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
 * aspect that the crop takes ocean rather than countries — and where a
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
 * already in the store, so there is a window where the map has paths — the
 * routes — but no land. Checking merely for "a path" passed in that window
 * and produced a card showing flight lines floating over an empty ocean.
 *
 * countries-110m carries ~177 features, so a threshold well above the number
 * of routes anyone will have distinguishes land from lines without needing to
 * reach inside react-simple-maps.
 *
 * The timeout is generous because the geography comes from a CDN on a cold
 * load. A short one meant the very first visit to Share timed out and
 * dead-ended, while every later visit worked from the browser cache — which
 * reads as "it only breaks the first time".
 */
const MIN_GEOGRAPHY_PATHS = 60;

async function waitForGeography(svg: SVGSVGElement, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  const ready = () =>
    svg.querySelectorAll('path').length >= MIN_GEOGRAPHY_PATHS &&
    // The canvas frames itself on the user's countries once their centroids
    // are known. Without waiting for that we would capture the unframed
    // first paint — the whole globe — and the card would disagree with the
    // map the user was just looking at.
    svg.getAttribute('data-framed') === '1';

  while (!ready()) {
    if (Date.now() > deadline) {
      throw new ShareCardError(
        'The map is still loading — try again in a moment',
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
    throw new ShareCardError('The map is not ready yet — try again in a moment');
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
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ShareCardError('Your browser could not create the image');

  const p = PALETTES[style];
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  ctx.textBaseline = 'top';

  if (style === 'editorial') {
    drawEditorial(ctx, mapImage, content, p);
  } else if (style === 'ink') {
    drawInk(ctx, mapImage, content, p);
  } else {
    drawWarm(ctx, mapImage, content, p);
  }

  drawWatermark(ctx, p);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new ShareCardError('Your browser could not create the image'));
    }, 'image/png');
  });
}

/**
 * The domain, bottom-right on every style. The kicker names the product but
 * a stranger seeing the card in a chat has no idea where it lives — the
 * watermark is the card's only actionable pointer back, i.e. the marketing.
 */
function drawWatermark(ctx: CanvasRenderingContext2D, p: Palette) {
  ctx.save();
  ctx.font = mono(24, '600');
  ctx.fillStyle = p.muted;
  ctx.globalAlpha = 0.9;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('mycontrail.com', CARD_WIDTH - 72, CARD_HEIGHT - 40);
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

  ctx.fillStyle = p.accent;
  ctx.font = mono(26, '600');
  ctx.fillText(content.kicker.toUpperCase(), pad, pad);

  const size = fitFont(ctx, content.headline, inner, 92, display);
  ctx.font = display(size);
  ctx.fillStyle = p.text;
  const lines = wrap(ctx, content.headline, inner, 2);
  lines.forEach((line, i) => ctx.fillText(line, pad, pad + 58 + i * size * 1.06));

  const factTop = CARD_HEIGHT - 190;
  const bandTop = pad + 58 + lines.length * size * 1.06 + 44;
  const bandHeight = factTop - 56 - bandTop;
  const mapHeight = Math.min(bandHeight, (inner * map.height) / map.width);
  const mapTop = bandTop + (bandHeight - mapHeight) / 2;

  ctx.save();
  roundedRect(ctx, pad, mapTop, inner, mapHeight, 44);
  ctx.clip();
  ctx.fillStyle = p.mapBg;
  ctx.fillRect(pad, mapTop, inner, mapHeight);
  drawMapContain(ctx, map, pad, mapTop, inner, mapHeight);
  ctx.restore();

  const columnWidth = inner / Math.max(content.facts.length, 1);
  content.facts.slice(0, 3).forEach((fact, i) => {
    const x = pad + i * columnWidth;
    ctx.fillStyle = p.text;
    ctx.font = display(50);
    ctx.fillText(fact.value, x, factTop);
    ctx.fillStyle = p.muted;
    ctx.font = body(24, '600');
    ctx.fillText(fact.label, x, factTop + 62);
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

  ctx.fillStyle = p.accent;
  ctx.beginPath();
  ctx.arc(pad + 16, pad + 16, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = mono(26, '600');
  ctx.fillText(content.kicker.toUpperCase(), pad + 48, pad + 2);

  const heroTop = CARD_HEIGHT - 260;
  const bandTop = pad + 90;
  const bandHeight = heroTop - 60 - bandTop;
  const mapHeight = Math.min(bandHeight, (inner * map.height) / map.width);
  const mapTop = bandTop + (bandHeight - mapHeight) / 2;

  ctx.save();
  roundedRect(ctx, pad, mapTop, inner, mapHeight, 44);
  ctx.clip();
  ctx.fillStyle = p.mapBg;
  ctx.fillRect(pad, mapTop, inner, mapHeight);
  drawMapContain(ctx, map, pad, mapTop, inner, mapHeight);
  ctx.restore();

  const heroSize = fitFont(ctx, content.hero.value, inner, 150, display);
  ctx.font = display(heroSize);
  ctx.fillStyle = p.text;
  ctx.fillText(content.hero.value, pad, heroTop);

  ctx.fillStyle = p.muted;
  const capSize = fitFont(ctx, content.hero.caption, inner, 30, (s) => body(s, '600'));
  ctx.font = body(capSize, '600');
  ctx.fillText(content.hero.caption.toUpperCase(), pad, heroTop + heroSize * 1.02);
}

function drawEditorial(
  ctx: CanvasRenderingContext2D,
  map: HTMLImageElement,
  content: ShareContent,
  p: Palette,
) {
  // Full-bleed band: no rounding, no padding — the point of this one.
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
