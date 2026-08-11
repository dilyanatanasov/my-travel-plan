/**
 * Export the map as a PNG.
 *
 * No html2canvas or dom-to-image: react-simple-maps renders a real inline
 * <svg> whose geography paths and inline fills are fully serialisable, and it
 * embeds no external raster images, so the canvas is never tainted.
 *
 * The source is the off-screen MapExportCanvas, not the visible map. The
 * visible one deliberately overflows its container so it fills the screen,
 * which meant exporting it produced a cropped world.
 */

const SCALE = 1.5; // Output crispness multiplier over the source SVG size.
const PAD = 32; // Caption padding, in source pixels.

export interface ExportCaption {
  title: string;
  stats: string[];
}

export class MapExportError extends Error {}

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
      reject(new MapExportError('The map image could not be rendered'));
    image.src = src;
  });
}

const font = (size: number, weight = '') =>
  `${weight} ${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.trim();

/**
 * Shrink text until it fits the available width.
 *
 * The previous version used fixed sizes against a canvas as narrow as the
 * phone viewport, so long names and stat lines ran off the edge.
 */
function fitFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startSize: number,
  weight = ''
): number {
  let size = startSize;
  ctx.font = font(size, weight);
  while (ctx.measureText(text).width > maxWidth && size > 10) {
    size -= 1;
    ctx.font = font(size, weight);
  }
  return size;
}

export async function renderMapPng(
  svg: SVGSVGElement,
  caption: ExportCaption
): Promise<Blob> {
  // Trust the SVG's own attributes rather than its rendered box: the export
  // canvas lives off-screen and may be transformed.
  const width = Number(svg.getAttribute('width')) || svg.getBoundingClientRect().width;
  const height = Number(svg.getAttribute('height')) || svg.getBoundingClientRect().height;

  if (!width || !height) {
    throw new MapExportError('The map is not ready yet — try again in a moment');
  }

  // A blank world means the geography fetch has not resolved.
  if (!svg.querySelector('path')) {
    throw new MapExportError('The map is still loading — try again in a moment');
  }

  const svgString = serializeSvg(svg, width, height);
  const image = await loadImage(
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`
  );

  const measure = document.createElement('canvas').getContext('2d');
  if (!measure) throw new MapExportError('Your browser could not create the image');

  const textWidth = width - PAD * 2;
  const titleSize = fitFontSize(measure, caption.title, textWidth, 38, '600');
  const statsText = caption.stats.join('   ·   ');
  const statsSize = fitFontSize(measure, statsText, textWidth, 24);

  // Height derived from the text rather than a fixed constant, so nothing is
  // clipped when either line needs more room.
  const captionHeight = PAD + titleSize * 1.25 + 12 + statsSize * 1.25 + PAD;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * SCALE);
  canvas.height = Math.round((height + captionHeight) * SCALE);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new MapExportError('Your browser could not create the image');
  ctx.scale(SCALE, SCALE);

  ctx.fillStyle = '#eef4f8';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, height, width, captionHeight);

  ctx.textBaseline = 'top';
  ctx.fillStyle = '#ffffff';
  ctx.font = font(titleSize, '600');
  ctx.fillText(caption.title, PAD, height + PAD);

  ctx.fillStyle = '#94a3b8';
  ctx.font = font(statsSize);
  ctx.fillText(statsText, PAD, height + PAD + titleSize * 1.25 + 12);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new MapExportError('Your browser could not create the image'));
    }, 'image/png');
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking synchronously can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
