import { useEffect, useRef } from 'react';
import { useToast } from '../../components/Toast/ToastProvider';
import type { ContinentRow } from '../stats/continentProgress';

interface MilestoneInput {
  countries: number;
  distanceKm: number;
  flights: number;
  /** Per-continent progress; a full row is a milestone of its own. */
  continents?: ContinentRow[];
  /** Opens the share screen. Sections are shell state, not routes. */
  onShare: () => void;
}

/** Thresholds worth stopping for. Sorted ascending within each kind. */
const COUNTRY_STEPS = [1, 5, 10, 25, 50, 75, 100, 150];
const FLIGHT_STEPS = [1, 10, 25, 50, 100, 250, 500];
const DISTANCE_STEPS = [10_000, 40_075, 100_000, 250_000, 384_400, 1_000_000];

const STORAGE_KEY = 'contrail-milestones-seen';

function loadSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function persistSeen(seen: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...seen]));
  } catch {
    /* Private mode: the worst case is celebrating twice. */
  }
}

/** Highest threshold reached, or null. */
function reached(steps: number[], value: number): number | null {
  let hit: number | null = null;
  for (const step of steps) {
    if (value >= step) hit = step;
    else break;
  }
  return hit;
}

function describe(kind: string, step: number): string | null {
  if (kind === 'countries') {
    return step === 1
      ? 'First country on the map.'
      : `That's ${step} countries.`;
  }
  if (kind === 'flights') {
    return step === 1 ? 'First flight logged.' : `That's ${step} flights.`;
  }
  if (kind === 'distance') {
    if (step === 40_075) return "You've flown once around the Earth.";
    if (step === 384_400) return "You've flown the distance to the Moon.";
    return `${step.toLocaleString()} km in the air.`;
  }
  return null;
}

/**
 * Notice when someone crosses a threshold, and say so.
 *
 * The moment right after adding a country is the only time someone feels
 * anything about their map, and it is therefore the only moment a share
 * prompt is welcome rather than nagging. Everything here is derived from
 * totals that already exist; nothing new is stored server-side.
 *
 * Seen milestones live in localStorage rather than the database, deliberately:
 * this is a nicety, not a record, and it must never block a render or cost a
 * request. Losing it means someone sees one extra toast.
 */
export function useMilestones({
  countries,
  distanceKm,
  flights,
  continents,
  onShare,
}: MilestoneInput) {
  const { showToast } = useToast();
  const seenRef = useRef<Set<string> | null>(null);
  /*
    Skip the first evaluation after mount. Loading an existing map would
    otherwise fire a toast for every threshold already passed, which is not a
    celebration — it is a queue of them for something you did months ago.
  */
  const primedRef = useRef(false);

  useEffect(() => {
    if (seenRef.current === null) seenRef.current = loadSeen();
    const seen = seenRef.current;

    const hits: { key: string; message: string }[] = [];
    const checks: [string, number[], number][] = [
      ['countries', COUNTRY_STEPS, countries],
      ['flights', FLIGHT_STEPS, flights],
      ['distance', DISTANCE_STEPS, Math.round(distanceKm)],
    ];

    for (const [kind, steps, value] of checks) {
      const step = reached(steps, value);
      if (step === null) continue;
      const key = `${kind}:${step}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const message = describe(kind, step);
      if (message) hits.push({ key, message });
    }

    // A finished continent is a milestone regardless of the count it lands
    // on. Same seen-set, same primed rule: history is recorded quietly.
    for (const row of continents ?? []) {
      if (row.total === 0 || row.visited < row.total) continue;
      const key = `continent:${row.continent}`;
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push({
        key,
        message: `${row.continent}, complete — every country on the map.`,
      });
    }

    if (hits.length === 0) return;
    persistSeen(seen);

    // On the first pass we only record what has already been passed.
    if (!primedRef.current) {
      primedRef.current = true;
      return;
    }

    // One at a time: several at once would stack and read as spam.
    const best = hits[hits.length - 1];
    showToast(best.message, {
      tone: 'success',
      durationMs: 8000,
      action: {
        label: 'Share it',
        onAction: onShare,
      },
    });
  }, [countries, distanceKm, flights, continents, showToast, onShare]);
}
