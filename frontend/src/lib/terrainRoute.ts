/*
  Terrain-aware routing (owner ask, 2026-08-18): a ferry crossing Varna to
  Burgas cut straight across Cape Emine, and the fix generalises - ships
  should stay on water, trains/cars/buses on land. One router serves both:
  the world atlas the map already ships is rasterised into a small land
  mask around the leg, A* finds the shortest path through the allowed
  medium, and string-pulling reduces it to a handful of waypoints.

  Results are geographic (lon/lat) so every surface can use them: the flat
  map projects them, the globe interpolates along them, the videos sample
  the SVG paths they produce. Failure is always safe: when no path exists
  (a strait too narrow for the 50m atlas, a drive across a real sea) the
  caller gets null and keeps today's straight chord.
*/
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { Feature, Geometry, Polygon, MultiPolygon } from 'geojson';
import { loadWorldAtlas } from './worldAtlas';

export type LonLat = [number, number];
export type TerrainMedium = 'water' | 'land';

/** Which medium a travel mode is confined to; flights roam free. */
export function modeMedium(
  mode: 'flight' | 'train' | 'car' | 'bus' | 'ferry',
): TerrainMedium | null {
  if (mode === 'flight') return null;
  return mode === 'ferry' ? 'water' : 'land';
}

export interface TerrainRequest {
  from: LonLat;
  to: LonLat;
  medium: TerrainMedium;
}

/* One polygon = outer ring + holes, pre-bboxed for cheap culling. */
interface LandPolygon {
  rings: LonLat[][];
  bbox: [number, number, number, number]; // minLon, minLat, maxLon, maxLat
}

let landPromise: Promise<LandPolygon[]> | null = null;

function collectPolygons(geometry: Geometry, out: LandPolygon[]): void {
  const push = (poly: Polygon['coordinates']) => {
    let minLon = Infinity;
    let minLat = Infinity;
    let maxLon = -Infinity;
    let maxLat = -Infinity;
    for (const [lon, lat] of poly[0]) {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    out.push({ rings: poly as LonLat[][], bbox: [minLon, minLat, maxLon, maxLat] });
  };
  if (geometry.type === 'Polygon') push(geometry.coordinates);
  else if (geometry.type === 'MultiPolygon')
    for (const poly of (geometry as MultiPolygon).coordinates) push(poly);
}

function loadLandPolygons(): Promise<LandPolygon[]> {
  landPromise ??= loadWorldAtlas()
    .then((atlas) => {
      const topology = atlas as Topology<{ countries: GeometryCollection }>;
      const collection = feature(topology, topology.objects.countries);
      const features = (
        collection.type === 'FeatureCollection' ? collection.features : [collection]
      ) as Feature[];
      const polygons: LandPolygon[] = [];
      for (const item of features) {
        if (item.geometry) collectPolygons(item.geometry, polygons);
      }
      return polygons;
    })
    .catch((error) => {
      landPromise = null;
      throw error;
    });
  return landPromise;
}

/*
  The mask is a plain lon/lat raster (equirectangular): x scales with
  longitude, y with latitude. Step costs are weighted by cos(lat) so
  "shortest" stays honest even though the grid squares are not.
*/
interface Mask {
  width: number;
  height: number;
  /** 1 where the medium is traversable. */
  cells: Uint8Array;
  /**
   * Cells to the nearest non-traversable cell, capped at 5 (0 = blocked).
   * For water this is coast clearance: routing charges extra near land,
   * so the ship stands visibly offshore where there's room (owner ask,
   * 2026-08-18: "some visible offset from the land") yet can still
   * thread a strait, where every cell is near a coast.
   */
  clearance: Uint8Array;
  minLon: number;
  maxLat: number;
  cellLon: number;
  cellLat: number;
}

/** Longest grid axis. Coarse enough to stay fast, fine enough that Cape
    Emine (a ~20 km headland on a ~90 km leg) actually exists. */
const GRID_CELLS = 220;

function buildMask(
  polygons: LandPolygon[],
  bbox: [number, number, number, number],
  medium: TerrainMedium,
): Mask | null {
  if (typeof document === 'undefined') return null;
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const lonSpan = maxLon - minLon;
  const latSpan = maxLat - minLat;
  if (lonSpan <= 0 || latSpan <= 0) return null;

  const longer = Math.max(lonSpan, latSpan);
  const width = Math.max(24, Math.round((lonSpan / longer) * GRID_CELLS));
  const height = Math.max(24, Math.round((latSpan / longer) * GRID_CELLS));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.fillStyle = '#000';
  for (const polygon of polygons) {
    const [pMinLon, pMinLat, pMaxLon, pMaxLat] = polygon.bbox;
    if (pMaxLon < minLon || pMinLon > maxLon || pMaxLat < minLat || pMinLat > maxLat)
      continue;
    ctx.beginPath();
    for (const ring of polygon.rings) {
      for (let i = 0; i < ring.length; i++) {
        const x = ((ring[i][0] - minLon) / lonSpan) * width;
        const y = ((maxLat - ring[i][1]) / latSpan) * height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    }
    ctx.fill('evenodd');
  }

  const image = ctx.getImageData(0, 0, width, height).data;
  const cells = new Uint8Array(width * height);
  for (let i = 0; i < cells.length; i++) {
    const isLand = image[i * 4 + 3] > 127;
    cells[i] = (medium === 'land') === isLand ? 1 : 0;
  }

  // Clearance: multi-source BFS out from every blocked cell, capped at 5.
  const CLEARANCE_CAP = 5;
  const clearance = new Uint8Array(width * height).fill(CLEARANCE_CAP);
  let frontier: number[] = [];
  for (let i = 0; i < cells.length; i++) {
    if (!cells[i]) {
      clearance[i] = 0;
      frontier.push(i);
    }
  }
  for (let ring = 1; ring < CLEARANCE_CAP && frontier.length > 0; ring++) {
    const next: number[] = [];
    for (const idx of frontier) {
      const x = idx % width;
      const y = (idx - x) / width;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const nIdx = ny * width + nx;
          if (clearance[nIdx] > ring) {
            clearance[nIdx] = ring;
            next.push(nIdx);
          }
        }
      }
    }
    frontier = next;
  }

  return {
    width,
    height,
    cells,
    clearance,
    minLon,
    maxLat,
    cellLon: lonSpan / width,
    cellLat: latSpan / height,
  };
}

function cellOf(mask: Mask, point: LonLat): [number, number] {
  const x = Math.min(
    mask.width - 1,
    Math.max(0, Math.floor((point[0] - mask.minLon) / mask.cellLon)),
  );
  const y = Math.min(
    mask.height - 1,
    Math.max(0, Math.floor((mask.maxLat - point[1]) / mask.cellLat)),
  );
  return [x, y];
}

/** Ports and stations sit ON the coast, so their cell is often the wrong
    medium - walk outward to the nearest traversable cell. */
function snapToMedium(mask: Mask, start: [number, number]): [number, number] | null {
  const { width, height, cells } = mask;
  if (cells[start[1] * width + start[0]]) return start;
  const maxRadius = 10;
  for (let radius = 1; radius <= maxRadius; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const x = start[0] + dx;
        const y = start[1] + dy;
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        if (cells[y * width + x]) return [x, y];
      }
    }
  }
  return null;
}

/** A* over the mask, 8-directional. Diagonals require both orthogonal
    neighbours open, so the path never slips through a pinched corner. */
function findPath(
  mask: Mask,
  start: [number, number],
  goal: [number, number],
  offshore: boolean,
): [number, number][] | null {
  const { width, height, cells, clearance } = mask;
  const size = width * height;
  const midLat =
    mask.maxLat - ((start[1] + goal[1]) / 2 + 0.5) * mask.cellLat;
  const kx = Math.max(0.05, Math.cos((midLat * Math.PI) / 180)) * mask.cellLon;
  const ky = mask.cellLat;

  const gScore = new Float64Array(size).fill(Infinity);
  const cameFrom = new Int32Array(size).fill(-1);
  const startIdx = start[1] * width + start[0];
  const goalIdx = goal[1] * width + goal[0];
  gScore[startIdx] = 0;

  const heuristic = (idx: number) => {
    const x = idx % width;
    const y = (idx - x) / width;
    return Math.hypot((x - goal[0]) * kx, (y - goal[1]) * ky);
  };

  // Binary heap keyed by f-score.
  const heap: number[] = [startIdx];
  const fScore = new Float64Array(size).fill(Infinity);
  fScore[startIdx] = heuristic(startIdx);
  const swap = (a: number, b: number) => {
    const t = heap[a];
    heap[a] = heap[b];
    heap[b] = t;
  };
  const heapPush = (idx: number) => {
    heap.push(idx);
    let i = heap.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (fScore[heap[parent]] <= fScore[heap[i]]) break;
      swap(parent, i);
      i = parent;
    }
  };
  const heapPop = (): number => {
    const top = heap[0];
    const last = heap.pop() as number;
    if (heap.length > 0) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const left = i * 2 + 1;
        const right = left + 1;
        let smallest = i;
        if (left < heap.length && fScore[heap[left]] < fScore[heap[smallest]])
          smallest = left;
        if (right < heap.length && fScore[heap[right]] < fScore[heap[smallest]])
          smallest = right;
        if (smallest === i) break;
        swap(i, smallest);
        i = smallest;
      }
    }
    return top;
  };

  const closed = new Uint8Array(size);
  while (heap.length > 0) {
    const current = heapPop();
    if (current === goalIdx) {
      const path: [number, number][] = [];
      let idx = current;
      while (idx !== -1) {
        const x = idx % width;
        path.push([x, (idx - x) / width]);
        idx = cameFrom[idx];
      }
      return path.reverse();
    }
    if (closed[current]) continue;
    closed[current] = 1;
    const cx = current % width;
    const cy = (current - cx) / width;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const next = ny * width + nx;
        if (!cells[next] || closed[next]) continue;
        if (
          dx !== 0 &&
          dy !== 0 &&
          (!cells[cy * width + nx] || !cells[ny * width + cx])
        )
          continue;
        // Hugging the coast costs extra when offshore routing is on -
        // a soft push, so straits (all-near-coast) remain passable.
        const nearness = offshore ? Math.max(0, 4 - clearance[next]) : 0;
        const cost = Math.hypot(dx * kx, dy * ky) * (1 + nearness * 0.4);
        const tentative = gScore[current] + cost;
        if (tentative < gScore[next]) {
          gScore[next] = tentative;
          cameFrom[next] = current;
          fScore[next] = tentative + heuristic(next);
          heapPush(next);
        }
      }
    }
  }
  return null;
}

/** Every cell a segment touches must be traversable - sampled at half-cell
    steps, so the pulled string cannot clip a headland between two centres. */
function lineIsClear(
  mask: Mask,
  a: [number, number],
  b: [number, number],
  minClearance: number,
): boolean {
  const { width, clearance } = mask;
  // The requirement adapts to its endpoints: a segment entering a strait
  // (where the A* path itself had clearance 1) may pass close to shore,
  // but open-water segments must keep the offshore margin the routing
  // paid for - otherwise the pull would iron the offset straight back out.
  const required = Math.max(
    1,
    Math.min(
      minClearance,
      clearance[a[1] * width + a[0]],
      clearance[b[1] * width + b[0]],
    ),
  );
  const steps = Math.max(
    1,
    Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) * 2),
  );
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = Math.round(a[0] + (b[0] - a[0]) * t);
    const y = Math.round(a[1] + (b[1] - a[1]) * t);
    if (clearance[y * width + x] < required) return false;
  }
  return true;
}

/** String-pulling: keep only the corners the coastline actually forces. */
function simplifyPath(
  mask: Mask,
  path: [number, number][],
  minClearance: number,
): [number, number][] {
  if (path.length <= 2) return path;
  const result: [number, number][] = [path[0]];
  let anchor = 0;
  while (anchor < path.length - 1) {
    let farthest = anchor + 1;
    for (let i = path.length - 1; i > anchor + 1; i--) {
      if (lineIsClear(mask, path[anchor], path[i], minClearance)) {
        farthest = i;
        break;
      }
    }
    result.push(path[farthest]);
    anchor = farthest;
  }
  return result;
}

/*
  Cache: geographic key, both directions (the reverse route is the same
  waypoints backwards). null is cached too - "no water path at this
  resolution" is an answer, and recomputing it every render would not
  change it.
*/
const routeCache = new Map<string, LonLat[] | null>();
const pending = new Map<string, Promise<LonLat[] | null>>();

export function terrainRequestKey(request: TerrainRequest): string {
  return routeKey(request.from, request.to, request.medium);
}

function routeKey(from: LonLat, to: LonLat, medium: TerrainMedium): string {
  const f = `${from[0].toFixed(4)},${from[1].toFixed(4)}`;
  const t = `${to[0].toFixed(4)},${to[1].toFixed(4)}`;
  return `${medium}|${f}->${t}`;
}

/**
 * One direct A* attempt. The three verdicts matter separately: 'straight'
 * (the chord is already valid), waypoints (route around something), or
 * 'blocked' (no path at this resolution) - only 'blocked' sends the water
 * router to the strait gates.
 */
type SegmentResult = LonLat[] | 'straight' | 'blocked';

async function routeSegment(
  from: LonLat,
  to: LonLat,
  medium: TerrainMedium,
): Promise<SegmentResult> {
  // Antimeridian-crossing legs keep the straight chord - the flat raster
  // cannot wrap, and these are vanishingly rare for surface travel.
  if (Math.abs(from[0] - to[0]) > 180) return 'straight';

  const polygons = await loadLandPolygons();

  const minLon = Math.min(from[0], to[0]);
  const maxLon = Math.max(from[0], to[0]);
  const minLat = Math.max(-85, Math.min(from[1], to[1]));
  const maxLat = Math.min(85, Math.max(from[1], to[1]));
  // Padding gives the detour room: a route may need to round a headland
  // that lies outside the endpoints' own bounding box.
  const pad = Math.max(1.0, Math.max(maxLon - minLon, maxLat - minLat) * 0.35);
  const bbox: [number, number, number, number] = [
    minLon - pad,
    Math.max(-85, minLat - pad),
    maxLon + pad,
    Math.min(85, maxLat + pad),
  ];

  const mask = buildMask(polygons, bbox, medium);
  if (!mask) return 'straight';

  const start = snapToMedium(mask, cellOf(mask, from));
  const goal = snapToMedium(mask, cellOf(mask, to));
  if (!start || !goal) return 'blocked';

  const offshore = medium === 'water';
  const cellPath = findPath(mask, start, goal, offshore);
  if (!cellPath || cellPath.length < 2) return 'blocked';

  const pulled = simplifyPath(mask, cellPath, offshore ? 2 : 1);
  if (pulled.length <= 2) return 'straight';

  const waypoints: LonLat[] = pulled.map(([x, y]) => [
    mask.minLon + (x + 0.5) * mask.cellLon,
    mask.maxLat - (y + 0.5) * mask.cellLat,
  ]);
  // The true endpoints replace their snapped cells: the route must leave
  // from the port, not from the middle of the nearest water pixel.
  waypoints[0] = from;
  waypoints[waypoints.length - 1] = to;
  return waypoints;
}

const segmentCache = new Map<string, SegmentResult>();

async function routeSegmentCached(
  from: LonLat,
  to: LonLat,
  medium: TerrainMedium,
): Promise<SegmentResult> {
  const key = routeKey(from, to, medium);
  const cached = segmentCache.get(key);
  if (cached !== undefined) return cached;
  const result = await routeSegment(from, to, medium);
  segmentCache.set(key, result);
  segmentCache.set(
    routeKey(to, from, medium),
    Array.isArray(result) ? [...result].reverse() : result,
  );
  return result;
}

/*
  Navigable chokepoints (owner pick, 2026-08-18: "strait gates + graph").
  A 700m strait cannot exist on a grid whose cells span 10km, so a leg
  like Varna -> Genoa finds no water and used to fall back to a straight
  cut across Anatolia. These gates are the fix: each is a pair of mouths
  the router may treat as connected regardless of what the raster says
  between them. Canals ride the same mechanism - Suez and Kiel are not
  water in ANY atlas resolution.
*/
const STRAIT_GATES: { name: string; a: LonLat; b: LonLat }[] = [
  { name: 'Bosphorus', a: [29.12, 41.24], b: [28.99, 40.96] },
  { name: 'Dardanelles', a: [26.72, 40.44], b: [26.15, 39.98] },
  { name: 'Kerch Strait', a: [36.62, 45.42], b: [36.52, 45.08] },
  { name: 'Strait of Gibraltar', a: [-6.05, 35.97], b: [-5.25, 36.02] },
  { name: 'Strait of Messina', a: [15.65, 38.28], b: [15.55, 38.05] },
  { name: 'Strait of Bonifacio', a: [8.95, 41.35], b: [9.35, 41.27] },
  { name: 'Corinth Canal', a: [22.92, 38.01], b: [23.01, 37.92] },
  { name: 'Suez Canal', a: [32.34, 31.31], b: [32.57, 29.9] },
  { name: 'Kiel Canal', a: [8.98, 53.9], b: [10.17, 54.38] },
  { name: 'Oresund', a: [12.6, 56.1], b: [12.73, 55.4] },
  { name: 'Great Belt', a: [10.85, 55.68], b: [10.78, 55.0] },
  { name: 'Panama Canal', a: [-79.92, 9.36], b: [-79.55, 8.88] },
  { name: 'Strait of Hormuz', a: [56.6, 26.75], b: [56.9, 26.3] },
  { name: 'Bab-el-Mandeb', a: [43.3, 12.85], b: [43.55, 12.35] },
];

const DEG_PER_RAD = 180 / Math.PI;

function geoDistanceDeg(a: LonLat, b: LonLat): number {
  // Haversine, in degrees of arc - enough precision for edge costs.
  const toRad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * toRad;
  const dLon = (b[0] - a[0]) * toRad;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[1] * toRad) * Math.cos(b[1] * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * Math.asin(Math.min(1, Math.sqrt(s))) * DEG_PER_RAD;
}

function chainLengthDeg(points: LonLat[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++)
    total += geoDistanceDeg(points[i - 1], points[i]);
  return total;
}

/**
 * Dijkstra over {origin, destination, gate mouths}: edges are open-water
 * segments the direct router can actually find, plus each gate's free
 * pass between its own mouths. Edge feasibility is evaluated lazily from
 * settled nodes only, and every probe lands in the segment cache, so the
 * expensive first Varna -> Genoa pays for every later Black Sea ferry.
 */
async function routeViaGates(from: LonLat, to: LonLat): Promise<LonLat[] | null> {
  const directDeg = geoDistanceDeg(from, to);
  // A gate is a candidate when the detour through it stays proportionate.
  const detourCap = directDeg * 2.2 + 12;
  const gates = STRAIT_GATES.filter((gate) => {
    const mid: LonLat = [
      (gate.a[0] + gate.b[0]) / 2,
      (gate.a[1] + gate.b[1]) / 2,
    ];
    return geoDistanceDeg(from, mid) + geoDistanceDeg(mid, to) <= detourCap;
  });
  if (gates.length === 0) return null;

  const nodes: { point: LonLat; gate: number }[] = [
    { point: from, gate: -1 },
    { point: to, gate: -1 },
  ];
  gates.forEach((gate, i) => {
    nodes.push({ point: gate.a, gate: i });
    nodes.push({ point: gate.b, gate: i });
  });
  const GOAL = 1;

  const dist = new Array<number>(nodes.length).fill(Infinity);
  const prev = new Array<number>(nodes.length).fill(-1);
  const geomTo: (LonLat[] | null)[] = new Array(nodes.length).fill(null);
  const settled = new Array<boolean>(nodes.length).fill(false);
  dist[0] = 0;

  for (;;) {
    let u = -1;
    for (let i = 0; i < nodes.length; i++) {
      if (!settled[i] && dist[i] < (u === -1 ? Infinity : dist[u])) u = i;
    }
    if (u === -1 || u === GOAL) break;
    settled[u] = true;

    for (let v = 0; v < nodes.length; v++) {
      if (v === u || settled[v]) continue;
      let geometry: LonLat[];
      const sameGate = nodes[u].gate !== -1 && nodes[u].gate === nodes[v].gate;
      if (sameGate) {
        // The gate's own passage: navigable by decree.
        geometry = [nodes[u].point, nodes[v].point];
      } else {
        const segment = await routeSegmentCached(
          nodes[u].point,
          nodes[v].point,
          'water',
        );
        if (segment === 'blocked') continue;
        geometry =
          segment === 'straight' ? [nodes[u].point, nodes[v].point] : segment;
      }
      const cost = chainLengthDeg(geometry);
      if (dist[u] + cost < dist[v]) {
        dist[v] = dist[u] + cost;
        prev[v] = u;
        geomTo[v] = geometry;
      }
    }
  }

  if (dist[GOAL] === Infinity) return null;
  const chain: LonLat[] = [];
  const parts: LonLat[][] = [];
  for (let v = GOAL; v !== 0; v = prev[v]) parts.push(geomTo[v] as LonLat[]);
  parts.reverse();
  for (const part of parts) {
    for (const point of chain.length > 0 ? part.slice(1) : part)
      chain.push(point);
  }
  return chain.length > 2 ? chain : null;
}

async function computeRoute(
  from: LonLat,
  to: LonLat,
  medium: TerrainMedium,
): Promise<LonLat[] | null> {
  const direct = await routeSegmentCached(from, to, medium);
  if (direct === 'straight') return null;
  if (direct !== 'blocked') return direct;
  // Only ships get the gate network; a blocked land route (a real sea in
  // the way) honestly stays a straight chord.
  if (medium !== 'water') return null;
  return routeViaGates(from, to);
}

/*
  "Is this a place a ship can call at?" (owner ask, 2026-08-18: ferries
  should connect coastal cities). Answered from the same atlas: rasterise
  a small box around the point and look for open water within reach.
  Honest caveats live with the callers: the atlas's countries carry no
  lakes or rivers, so a lakeside port may read as landlocked - which is
  why this powers a warning, never a hard block. null = cannot tell
  (no canvas, atlas failed): treat as fine.
*/
const nearWaterCache = new Map<string, boolean | null>();

export async function isNearWater(
  point: LonLat,
  maxKm = 20,
): Promise<boolean | null> {
  const key = `${point[0].toFixed(3)},${point[1].toFixed(3)}|${maxKm}`;
  const cached = nearWaterCache.get(key);
  if (cached !== undefined) return cached;

  let answer: boolean | null = null;
  try {
    const polygons = await loadLandPolygons();
    const latPad = (maxKm / 111) * 1.6;
    const lonPad =
      latPad / Math.max(0.2, Math.cos((point[1] * Math.PI) / 180));
    const mask = buildMask(
      polygons,
      [
        point[0] - lonPad,
        Math.max(-85, point[1] - latPad),
        point[0] + lonPad,
        Math.min(85, point[1] + latPad),
      ],
      'water',
    );
    if (mask) {
      const [cx, cy] = cellOf(mask, point);
      const kmPerCellLat = mask.cellLat * 111;
      const kmPerCellLon =
        mask.cellLon * 111 * Math.max(0.2, Math.cos((point[1] * Math.PI) / 180));
      answer = false;
      for (let y = 0; y < mask.height && !answer; y++) {
        for (let x = 0; x < mask.width; x++) {
          if (!mask.cells[y * mask.width + x]) continue;
          const km = Math.hypot(
            (x - cx) * kmPerCellLon,
            (y - cy) * kmPerCellLat,
          );
          if (km <= maxKm) {
            answer = true;
            break;
          }
        }
      }
    }
  } catch {
    answer = null;
  }
  nearWaterCache.set(key, answer);
  return answer;
}

/** The cached answer, or undefined when it has not been computed yet
    (null means "computed: keep the straight chord"). */
export function terrainWaypointsSync(
  from: LonLat,
  to: LonLat,
  medium: TerrainMedium,
): LonLat[] | null | undefined {
  return routeCache.get(routeKey(from, to, medium));
}

export function ensureTerrainWaypoints(
  from: LonLat,
  to: LonLat,
  medium: TerrainMedium,
): Promise<LonLat[] | null> {
  const key = routeKey(from, to, medium);
  const cached = routeCache.get(key);
  if (cached !== undefined) return Promise.resolve(cached);
  const inFlight = pending.get(key);
  if (inFlight) return inFlight;
  const task = computeRoute(from, to, medium)
    .catch(() => null)
    .then((waypoints) => {
      routeCache.set(key, waypoints);
      // The reverse leg is the same coastline in the other direction.
      routeCache.set(
        routeKey(to, from, medium),
        waypoints ? [...waypoints].reverse() : null,
      );
      pending.delete(key);
      return waypoints;
    });
  pending.set(key, task);
  return task;
}
