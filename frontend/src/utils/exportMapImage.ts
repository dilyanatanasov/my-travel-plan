/**
 * Export the live map SVG as a PNG.
 *
 * No html2canvas or dom-to-image: react-simple-maps already renders a real
 * inline <svg> whose geography paths and inline fills are fully serialisable,
 * and it embeds no external raster images, so the canvas is never tainted.
 * Pulling in a DOM-rasterising dependency for this would be waste.
 */

const SCALE = 2; // Render at 2x so the shared image is not soft on retina screens.
const CAPTION_HEIGHT = 132;

export interface ExportCaption {
  title: string;
  stats: string[];
}

export class MapExportError extends Error {}

function serializeSvg(svg: SVGSVGElement, width: number, height: number): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;

  // The live element is sized by CSS classes that will not exist inside a
  // standalone SVG document, so pin the dimensions explicitly.
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  clone.removeAttribute('class');
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

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

function drawCaption(
  ctx: CanvasRenderingContext2D,
  caption: ExportCaption,
  width: number,
  top: number
) {
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, top, width, CAPTION_HEIGHT * SCALE);

  ctx.fillStyle = '#ffffff';
  ctx.font = `600 ${28 * SCALE}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textBaseline = 'top';
  ctx.fillText(caption.title, 32 * SCALE, top + 28 * SCALE);

  ctx.fillStyle = '#94a3b8';
  ctx.font = `${18 * SCALE}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.fillText(caption.stats.join('   ·   '), 32 * SCALE, top + 74 * SCALE);
}

/**
 * Rasterise the given map SVG and hand the caller a PNG blob.
 *
 * @param svg     the live `.rsm-svg` element
 * @param caption title and stat line composited beneath the map — a shared
 *                image with no context does not travel
 */
export async function renderMapPng(
  svg: SVGSVGElement,
  caption: ExportCaption
): Promise<Blob> {
  const rect = svg.getBoundingClientRect();
  const width = Math.round(rect.width);
  const height = Math.round(rect.height);

  if (!width || !height) {
    throw new MapExportError('The map is not visible on screen');
  }

  const svgString = serializeSvg(svg, width, height);
  const encoded = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
  const image = await loadImage(encoded);

  const canvas = document.createElement('canvas');
  canvas.width = width * SCALE;
  canvas.height = height * SCALE + CAPTION_HEIGHT * SCALE;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new MapExportError('Your browser could not create the image');
  }

  // The map SVG has a transparent background outside the ocean rect.
  ctx.fillStyle = '#eef4f8';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, width * SCALE, height * SCALE);
  drawCaption(ctx, caption, canvas.width, height * SCALE);

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
  // Revoke on the next tick; revoking synchronously can cancel the download
  // in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
