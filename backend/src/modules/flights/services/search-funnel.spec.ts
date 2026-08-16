import { FlightResultDto } from '../dto/flight-result.dto';
import { PricePoint } from '../providers/flight-provider.interface';
import {
  judge,
  median,
  nightsBetween,
  paretoFront,
  selectCandidates,
  surfaceTtlHours,
} from './search-funnel.util';
import { SearchOrchestratorService } from './search-orchestrator.service';
import { CabinClass } from '../dto/search-flights.dto';

/**
 * The funnel's opinions: which dates deserve money, which results survive
 * the Pareto cut, and what the judgement copy claims. Plus the orchestrator
 * flow with every provider mocked: cache-first, budget-gated, capped.
 */

function point(
  departureDate: string,
  returnDate: string | null,
  price: number,
): PricePoint {
  return {
    origin: 'SOF',
    destination: 'NRT',
    departureDate,
    returnDate,
    price,
    currency: 'USD',
    provider: 'travelpayouts',
    observedAt: '2026-08-16T00:00:00Z',
    isEstimate: true,
  };
}

function result(
  itineraryId: string,
  lowestPrice: number,
  totalDurationMinutes: number,
): FlightResultDto {
  return {
    itineraryId,
    lowestPrice,
    totalDurationMinutes,
  } as unknown as FlightResultDto;
}

describe('surfaceTtlHours', () => {
  it('fresher requirements as departure approaches', () => {
    expect(surfaceTtlHours('2026-12-01', '2026-08-16')).toBe(48);
    expect(surfaceTtlHours('2026-09-15', '2026-08-16')).toBe(12);
    expect(surfaceTtlHours('2026-08-20', '2026-08-16')).toBe(4);
  });
});

describe('selectCandidates', () => {
  it('honours the nights window', () => {
    const picks = selectCandidates(
      [
        point('2026-10-01', '2026-10-03', 200), // 2 nights — too short
        point('2026-10-10', '2026-10-17', 300), // 7 nights
        point('2026-10-20', '2026-11-05', 250), // 16 nights — too long
      ],
      { minNights: 5, maxNights: 10 },
    );
    expect(picks).toHaveLength(1);
    expect(picks[0].departureDate).toBe('2026-10-10');
  });

  it('spreads across weeks before doubling up, cheapest first', () => {
    const picks = selectCandidates(
      [
        point('2026-10-05', '2026-10-12', 100),
        point('2026-10-06', '2026-10-13', 110), // same week as the 100
        point('2026-10-19', '2026-10-26', 300),
      ],
      { k: 2 },
    );
    expect(picks.map((p) => p.surfacePrice)).toEqual([100, 300]);
  });

  it('fills from the same week only when weeks run out', () => {
    const picks = selectCandidates(
      [
        point('2026-10-05', '2026-10-12', 100),
        point('2026-10-06', '2026-10-13', 110),
      ],
      { k: 2 },
    );
    expect(picks.map((p) => p.surfacePrice)).toEqual([100, 110]);
  });
});

describe('paretoFront', () => {
  it('keeps a result unless something is cheaper AND faster', () => {
    const front = paretoFront([
      result('cheap-slow', 300, 900),
      result('mid', 400, 700),
      result('fast-dear', 600, 500),
      result('dominated', 650, 950), // beaten by every other on both axes
    ]);
    expect(front.map((r) => r.itineraryId).sort()).toEqual([
      'cheap-slow',
      'fast-dear',
      'mid',
    ]);
  });

  it('ties survive: equal price and duration dominate nothing', () => {
    const front = paretoFront([
      result('a', 300, 700),
      result('b', 300, 700),
    ]);
    expect(front).toHaveLength(2);
  });
});

describe('judge', () => {
  it('anchors cheapness to the period median, speed to the fastest', () => {
    const front = [
      result('cheap', 315, 900),
      result('fast', 600, 500),
    ];
    const judgements = judge(front, 400);
    const cheap = judgements.find((j) => j.itineraryId === 'cheap');
    expect(cheap?.whyRecommended).toContain('$85 under the period median');
    expect(cheap?.whyRecommended).toContain('slower than the fastest');
    const fast = judgements.find((j) => j.itineraryId === 'fast');
    expect(fast?.whyRecommended).toContain('fastest option found');
  });

  it('empty front, no judgements; missing median, no price claim', () => {
    expect(judge([], 400)).toEqual([]);
    const judgements = judge([result('only', 300, 700)], null);
    expect(judgements[0].whyRecommended).not.toContain('median');
  });
});

describe('median', () => {
  it('handles odd, even and empty', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe('SearchOrchestratorService.runSearch', () => {
  const dto = {
    origin: 'SOF',
    destination: 'NRT',
    month: '2026-10',
    minNights: 5,
    maxNights: 10,
    passengers: 1,
    cabinClass: CabinClass.ECONOMY,
  };

  function makeOrchestrator(options: {
    cached: PricePoint[];
    tpPoints?: PricePoint[];
    kiwiResults?: FlightResultDto[];
    canSpend?: boolean;
  }) {
    const appended: PricePoint[][] = [];
    const observations = {
      freshSurface: jest.fn().mockResolvedValue(options.cached),
      append: jest.fn().mockImplementation((points: PricePoint[]) => {
        appended.push(points);
        return Promise.resolve();
      }),
      periodMedian: jest.fn().mockResolvedValue(null),
    };
    const travelpayouts = {
      name: 'travelpayouts',
      costPerCall: 0,
      isConfigured: () => true,
      getPriceSurface: jest.fn().mockResolvedValue(options.tpPoints ?? []),
    };
    const serpapi = {
      name: 'serpapi',
      costPerCall: 0.025,
      isConfigured: () => false,
      getPriceSurface: jest.fn(),
    };
    const kiwi = {
      name: 'kiwi',
      costPerCall: 0.00025,
      isConfigured: () => (options.kiwiResults ? true : false),
      searchPrecise: jest.fn().mockResolvedValue(options.kiwiResults ?? []),
    };
    const budget = {
      canSpend: jest.fn().mockResolvedValue(options.canSpend ?? true),
      record: jest.fn().mockResolvedValue(undefined),
    };
    const service = new SearchOrchestratorService(
      travelpayouts as never,
      serpapi as never,
      kiwi as never,
      budget as never,
      observations as never,
    );
    return { service, observations, travelpayouts, kiwi, budget, appended };
  }

  const cachedSurface = [point('2026-10-10', '2026-10-17', 300)];

  it('a fresh cache spends nothing upstream on the surface', async () => {
    const { service, travelpayouts, kiwi } = makeOrchestrator({
      cached: cachedSurface,
      kiwiResults: [result('bookable', 320, 800)],
    });
    const out = await service.runSearch(dto);
    expect(travelpayouts.getPriceSurface).not.toHaveBeenCalled();
    expect(kiwi.searchPrecise).toHaveBeenCalledTimes(1);
    expect(out.meta.cacheHits).toBe(1);
    expect(out.results).toHaveLength(1);
    expect(out.judgements[0].role).toBe('recommended');
  });

  it('an empty cache pays the surface provider and writes back', async () => {
    const { service, travelpayouts, appended } = makeOrchestrator({
      cached: [],
      tpPoints: cachedSurface,
    });
    const out = await service.runSearch(dto);
    expect(travelpayouts.getPriceSurface).toHaveBeenCalledTimes(1);
    expect(appended[0]).toEqual(cachedSurface);
    expect(out.meta.upstreamCalls).toBe(1);
    // Kiwi unconfigured: candidates exist, nothing bookable — degraded.
    expect(out.meta.degraded).toBe(true);
  });

  it('a refused budget degrades instead of failing', async () => {
    const { service, kiwi } = makeOrchestrator({
      cached: cachedSurface,
      kiwiResults: [result('bookable', 320, 800)],
      canSpend: false,
    });
    const out = await service.runSearch(dto);
    expect(kiwi.searchPrecise).not.toHaveBeenCalled();
    expect(out.meta.degraded).toBe(true);
    expect(out.results).toHaveLength(0);
  });

  it('streams surface, results and judgement in order', async () => {
    const { service } = makeOrchestrator({
      cached: cachedSurface,
      kiwiResults: [result('bookable', 320, 800)],
    });
    const events: string[] = [];
    await service.runSearch(dto, (event) => events.push(event.type));
    expect(events).toEqual(['surface', 'result', 'judgement']);
  });
});
