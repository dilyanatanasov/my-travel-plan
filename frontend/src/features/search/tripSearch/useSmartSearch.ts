import { useCallback, useEffect, useRef, useState } from 'react';
import type { FlightResultDto } from '../../../types';

/** Mirrors the backend's smart-search stream payloads (M3). */
export interface SurfacePoint {
  departureDate: string;
  returnDate: string | null;
  price: number;
  isEstimate: boolean;
}

export interface Candidate {
  departureDate: string;
  returnDate: string | null;
  surfacePrice: number;
}

export interface SearchJudgement {
  itineraryId: string;
  role: 'recommended' | 'cheapest' | 'fastest';
  whyRecommended: string;
}

export interface SearchMeta {
  upstreamCalls: number;
  cacheHits: number;
  durationMs: number;
  degraded: boolean;
}

export type CabinClass =
  | 'economy'
  | 'premium_economy'
  | 'business'
  | 'first';

export interface SmartSearchParams {
  origin: string;
  destination: string;
  month: string; // YYYY-MM
  minNights?: number;
  maxNights?: number;
  passengers?: number;
  cabinClass?: CabinClass;
}

interface SmartSearchState {
  phase: 'idle' | 'starting' | 'streaming' | 'done' | 'error';
  surface: SurfacePoint[];
  candidates: Candidate[];
  results: FlightResultDto[];
  judgements: SearchJudgement[];
  meta: SearchMeta | null;
  error: string | null;
}

const INITIAL: SmartSearchState = {
  phase: 'idle',
  surface: [],
  candidates: [],
  results: [],
  judgements: [],
  meta: null,
  error: null,
};

/**
 * The streaming search lifecycle: POST starts the funnel, EventSource
 * watches it fill in. The surface lands first (calendar paints), results
 * stream one by one, judgement closes the show. Cookie auth rides
 * withCredentials; the server replays missed events, so connecting a beat
 * late loses nothing.
 */
export function useSmartSearch() {
  const [state, setState] = useState<SmartSearchState>(INITIAL);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => () => sourceRef.current?.close(), []);

  const search = useCallback(async (params: SmartSearchParams) => {
    sourceRef.current?.close();
    setState({ ...INITIAL, phase: 'starting' });

    const base = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';
    let searchId: string;
    try {
      const response = await fetch(`${base}/flights/smart-search/stream`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!response.ok) throw new Error(String(response.status));
      ({ searchId } = (await response.json()) as { searchId: string });
    } catch {
      setState({
        ...INITIAL,
        phase: 'error',
        error: 'Could not start the search — try again.',
      });
      return;
    }

    const source = new EventSource(
      `${base}/flights/smart-search/${searchId}/stream`,
      { withCredentials: true },
    );
    sourceRef.current = source;

    source.addEventListener('surface', (event) => {
      const data = JSON.parse((event as MessageEvent).data) as {
        surface: SurfacePoint[];
        candidates: Candidate[];
      };
      setState((current) => ({
        ...current,
        phase: 'streaming',
        surface: data.surface,
        candidates: data.candidates,
      }));
    });

    source.addEventListener('result', (event) => {
      const data = JSON.parse((event as MessageEvent).data) as {
        result: FlightResultDto;
      };
      setState((current) => ({
        ...current,
        results: [...current.results, data.result],
      }));
    });

    source.addEventListener('judgement', (event) => {
      const data = JSON.parse((event as MessageEvent).data) as {
        judgements: SearchJudgement[];
      };
      setState((current) => ({ ...current, judgements: data.judgements }));
    });

    source.addEventListener('done', (event) => {
      const data = JSON.parse((event as MessageEvent).data) as {
        meta: SearchMeta;
      };
      source.close();
      setState((current) => ({ ...current, phase: 'done', meta: data.meta }));
    });

    source.addEventListener('error', (event) => {
      // Named server error event carries data; a transport failure does not.
      const message =
        (event as MessageEvent).data !== undefined
          ? (JSON.parse((event as MessageEvent).data) as { message: string })
              .message
          : 'The search stream dropped — results may be incomplete.';
      source.close();
      setState((current) =>
        current.phase === 'done'
          ? current
          : { ...current, phase: 'error', error: message },
      );
    });
  }, []);

  return { ...state, search };
}
