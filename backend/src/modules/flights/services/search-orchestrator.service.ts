import { Injectable, Logger } from '@nestjs/common';
import { CabinClass } from '../dto/search-flights.dto';
import {
  SmartSearchDto,
  SmartSearchResultDto,
} from '../dto/smart-search.dto';
import { FlightResultDto } from '../dto/flight-result.dto';
import {
  PricePoint,
  SurfaceQuery,
} from '../providers/flight-provider.interface';
import { KiwiProvider } from '../providers/kiwi.provider';
import { SerpapiProvider } from '../providers/serpapi.provider';
import { TravelpayoutsProvider } from '../providers/travelpayouts.provider';
import { BudgetService } from './budget.service';
import { PriceObservationsService } from './price-observations.service';
import {
  CandidatePick,
  Judgement,
  judge,
  median,
  paretoFront,
  selectCandidates,
} from './search-funnel.util';

/** Streaming seam for M3: the SSE layer subscribes, M2 callers ignore it. */
export type SearchEvent =
  | { type: 'surface'; surface: PricePoint[]; candidates: CandidatePick[] }
  | { type: 'result'; result: FlightResultDto }
  | { type: 'judgement'; judgements: Judgement[] };

const MAX_CANDIDATES = 8;
const MAX_CONCURRENT = 3;
/** Upstream calls one search may ever spend, all providers combined. */
const HARD_CALL_CAP = 25;
/** Response weight: per-candidate result cap after price sort. */
const RESULTS_PER_CANDIDATE = 10;

/**
 * The funnel (M2): surface → candidates → precise → judgement.
 *
 * Order of cheapness: yesterday's observations are free, Travelpayouts is
 * free, SerpApi costs cents, Kiwi is the only tier that returns something
 * bookable. Budget gates guard every paid hop, the hard per-search cap
 * bounds the worst case, and every price seen — estimate or quote — is
 * appended to price_observations on the way through.
 *
 * Hub exploration (the old exploration service) is NOT wired in yet:
 * plan says it joins only when L1/L2 finds nothing sane, which needs live
 * keys to calibrate — parked for M3.
 */
@Injectable()
export class SearchOrchestratorService {
  private readonly logger = new Logger(SearchOrchestratorService.name);

  constructor(
    private readonly travelpayouts: TravelpayoutsProvider,
    private readonly serpapi: SerpapiProvider,
    private readonly kiwi: KiwiProvider,
    private readonly budget: BudgetService,
    private readonly observations: PriceObservationsService,
  ) {}

  async runSearch(
    dto: SmartSearchDto,
    onEvent?: (event: SearchEvent) => void,
  ): Promise<SmartSearchResultDto> {
    const started = Date.now();
    const origin = dto.origin.toUpperCase();
    const destination = dto.destination.toUpperCase();
    const month = `${dto.month}-01`;
    let upstreamCalls = 0;
    let cacheHits = 0;
    let degraded = false;

    // L1 — the surface. History first; providers only for what it lacks.
    let surface = await this.observations.freshSurface(
      origin,
      destination,
      month,
    );
    cacheHits = surface.length;

    if (surface.length === 0) {
      const surfaceQuery: SurfaceQuery = {
        origin,
        destination,
        month,
        roundTrip: true,
      };
      for (const provider of [this.travelpayouts, this.serpapi]) {
        if (surface.length > 0) break;
        if (!provider.isConfigured()) continue;
        if (upstreamCalls >= HARD_CALL_CAP) break;
        if (!(await this.budget.canSpend(provider.name))) {
          degraded = true;
          continue;
        }
        const points = await provider.getPriceSurface(surfaceQuery);
        upstreamCalls += 1;
        await this.budget.record(provider.name, 1, provider.costPerCall);
        if (points.length > 0) {
          surface = points;
          await this.observations.append(points);
        }
      }
    }

    const candidates = selectCandidates(surface, {
      minNights: dto.minNights,
      maxNights: dto.maxNights,
      k: MAX_CANDIDATES,
    });
    onEvent?.({ type: 'surface', surface, candidates });

    // L2 — pay Kiwi for the candidates, a few at a time, under both caps.
    const results: FlightResultDto[] = [];
    if (this.kiwi.isConfigured() && candidates.length > 0) {
      for (
        let batchStart = 0;
        batchStart < candidates.length;
        batchStart += MAX_CONCURRENT
      ) {
        const batch = candidates
          .slice(batchStart, batchStart + MAX_CONCURRENT)
          .filter(() => upstreamCalls < HARD_CALL_CAP);
        if (batch.length === 0) break;
        if (!(await this.budget.canSpend('kiwi', batch.length))) {
          degraded = true;
          break;
        }
        upstreamCalls += batch.length;
        await this.budget.record('kiwi', batch.length, this.kiwi.costPerCall);

        const settled = await Promise.allSettled(
          batch.map((candidate) =>
            this.kiwi.searchPrecise({
              origin,
              destination,
              departureDate: candidate.departureDate,
              returnDate: candidate.returnDate ?? undefined,
              passengers: dto.passengers ?? 1,
              cabinClass: dto.cabinClass ?? CabinClass.ECONOMY,
            }),
          ),
        );

        for (const [index, outcome] of settled.entries()) {
          if (outcome.status === 'rejected') {
            this.logger.warn(
              `L2 failed for ${batch[index].departureDate}: ${outcome.reason}`,
            );
            continue;
          }
          const top = outcome.value
            .slice()
            .sort((a, b) => a.lowestPrice - b.lowestPrice)
            .slice(0, RESULTS_PER_CANDIDATE);
          for (const result of top) {
            results.push(result);
            onEvent?.({ type: 'result', result });
          }
          // The quote of record: L2's cheapest is a real price, not an
          // estimate, and future medians should know it.
          if (top[0]) {
            await this.observations.append([
              {
                origin,
                destination,
                departureDate: batch[index].departureDate,
                returnDate: batch[index].returnDate,
                price: top[0].lowestPrice,
                currency: top[0].currency,
                provider: 'kiwi',
                observedAt: new Date().toISOString(),
                isEstimate: false,
              },
            ]);
          }
        }
      }
    } else if (candidates.length > 0) {
      degraded = true; // surface exists but nothing bookable can be fetched
    }

    // L3 — judgement over the Pareto front, anchored to route history.
    const periodMedian =
      (await this.observations.periodMedian(origin, destination, month)) ??
      median(surface.map((point) => point.price));
    const front = paretoFront(results);
    const judgements = judge(front, periodMedian);
    onEvent?.({ type: 'judgement', judgements });

    return {
      origin,
      destination,
      month: dto.month,
      surface,
      candidates,
      results,
      judgements,
      periodMedian,
      meta: {
        upstreamCalls,
        cacheHits,
        durationMs: Date.now() - started,
        degraded,
      },
    };
  }
}
