import { useEffect, useMemo, useState } from 'react';
import { useGetVisitsQuery } from '../visits/visitsApi';
import { HOME_ORIGIN, getMonthMatrix } from './fixtures/priceMatrix';
import { deriveRows, visitedIsoSet } from './discovery';
import type { DestinationPrices, DiscoveryRow } from './types';

export interface DiscoveryState {
  status: 'loading' | 'ready';
  origin: typeof HOME_ORIGIN;
  /** Unvisited countries with at least one known fare, unsorted. */
  rows: DiscoveryRow[];
  /** Unvisited countries the cache knows nothing about this month. */
  noData: DestinationPrices[];
}

/**
 * Everything the discovery UI needs for one month.
 *
 * The fixture "fetch" takes a beat on purpose: the loading state is part of
 * the design under review, and a synchronous render would hide it until v2
 * makes it real — the worst possible moment to discover it was never styled.
 */
export function useDiscovery(month: string): DiscoveryState {
  const { data: visits = [], isLoading: visitsLoading } = useGetVisitsQuery();
  const [settledMonth, setSettledMonth] = useState<string | null>(null);

  useEffect(() => {
    setSettledMonth(null);
    const timer = window.setTimeout(() => setSettledMonth(month), 450);
    return () => window.clearTimeout(timer);
  }, [month]);

  const { rows, noData } = useMemo(() => {
    if (settledMonth !== month || visitsLoading) return { rows: [], noData: [] };
    return deriveRows(getMonthMatrix(HOME_ORIGIN.iata, month), visitedIsoSet(visits));
  }, [settledMonth, month, visits, visitsLoading]);

  return {
    status: settledMonth === month && !visitsLoading ? 'ready' : 'loading',
    origin: HOME_ORIGIN,
    rows,
    noData,
  };
}
