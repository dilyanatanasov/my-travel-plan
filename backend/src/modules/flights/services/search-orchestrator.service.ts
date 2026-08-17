import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Airport } from '../../airports/entities/airport.entity';
import { KNOWN_HUBS } from '../data/hubs';
import { CabinClass } from '../dto/search-flights.dto';
import {
  SmartSearchDto,
  SmartSearchResultDto,
} from '../dto/smart-search.dto';
import { FlightResultDto } from '../dto/flight-result.dto';
import { PricePoint } from '../providers/flight-provider.interface';
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
import {
  composeSplitResults,
  composeSurfaceCombos,
  nearestHubCodes,
} from './split-search.util';
import { directEstimate, splitEstimate } from './estimate-results.util';
import { kiwiDeepLink, withAffiliate } from '../providers/affiliate.util';

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
/** Positioning hubs tried for the split-ticket tier. */
const SPLIT_HUBS = 3;

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
    @InjectRepository(Airport)
    private readonly airportRepository: Repository<Airport>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * The active precise tier: Kiwi when its key exists, else SerpApi's
   * Google Flights, else none — in which case the surface's own date
   * pairs become estimate cards rather than an empty page.
   */
  private preciseProvider(): KiwiProvider | SerpapiProvider | null {
    if (this.kiwi.isConfigured()) return this.kiwi;
    if (this.serpapi.isConfigured()) return this.serpapi;
    return null;
  }

  /** Affiliate-wrapped live-search link for a route + date pair. */
  private searchLink(
    origin: string,
    destination: string,
    departureDate: string,
    returnDate?: string | null,
  ): string {
    return withAffiliate(
      kiwiDeepLink(origin, destination, departureDate, returnDate),
      this.configService.get<string>('TRAVELPAYOUTS_MARKER'),
    );
  }

  /**
   * A route's surface for a month: history first, then the providers in
   * order of cheapness, each budget-gated. Shared by the direct tier and
   * every split leg; returns the points plus what the fetch cost.
   */
  private async ensureSurface(
    origin: string,
    destination: string,
    month: string,
    remainingCalls: number,
  ): Promise<{ points: PricePoint[]; calls: number; refused: boolean }> {
    const cached = await this.observations.freshSurface(
      origin,
      destination,
      month,
    );
    if (cached.length > 0) return { points: cached, calls: 0, refused: false };

    let calls = 0;
    let refused = false;
    for (const provider of [this.travelpayouts, this.serpapi]) {
      if (!provider.isConfigured()) continue;
      if (calls >= remainingCalls) break;
      if (!(await this.budget.canSpend(provider.name))) {
        refused = true;
        continue;
      }
      const points = await provider.getPriceSurface({
        origin,
        destination,
        month,
        roundTrip: true,
      });
      calls += 1;
      await this.budget.record(provider.name, 1, provider.costPerCall);
      if (points.length > 0) {
        await this.observations.append(points);
        return { points, calls, refused };
      }
    }
    return { points: [], calls, refused };
  }

  /** The origin's positioning hubs, by geography, from the airports table. */
  private async positioningHubs(
    origin: string,
    destination: string,
  ): Promise<string[]> {
    const hubCodes = KNOWN_HUBS.map((hub) => hub.code);
    const airports = await this.airportRepository.find({
      where: { iataCode: In([origin, ...hubCodes]) },
    });
    const originAirport = airports.find((a) => a.iataCode === origin);
    if (!originAirport) return [];
    return nearestHubCodes(
      {
        iataCode: origin,
        latitude: Number(originAirport.latitude),
        longitude: Number(originAirport.longitude),
      },
      airports
        .filter((a) => a.iataCode !== origin)
        .map((a) => ({
          iataCode: a.iataCode,
          latitude: Number(a.latitude),
          longitude: Number(a.longitude),
        })),
      destination,
      SPLIT_HUBS,
    );
  }

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
    const direct = await this.ensureSurface(
      origin,
      destination,
      month,
      HARD_CALL_CAP,
    );
    const surface = direct.points;
    cacheHits = direct.calls === 0 ? surface.length : 0;
    upstreamCalls += direct.calls;
    if (direct.refused) degraded = true;

    const candidates = selectCandidates(surface, {
      minNights: dto.minNights,
      maxNights: dto.maxNights,
      k: MAX_CANDIDATES,
    });
    onEvent?.({ type: 'surface', surface, candidates });

    // L2 — pay the precise tier for the candidates, batched, under both caps.
    const results: FlightResultDto[] = [];
    const precise = this.preciseProvider();
    if (precise && candidates.length > 0) {
      for (
        let batchStart = 0;
        batchStart < candidates.length;
        batchStart += MAX_CONCURRENT
      ) {
        const batch = candidates
          .slice(batchStart, batchStart + MAX_CONCURRENT)
          .filter(() => upstreamCalls < HARD_CALL_CAP);
        if (batch.length === 0) break;
        if (!(await this.budget.canSpend(precise.name, batch.length))) {
          degraded = true;
          break;
        }
        upstreamCalls += batch.length;
        await this.budget.record(
          precise.name,
          batch.length,
          precise.costPerCall,
        );

        const settled = await Promise.allSettled(
          batch.map((candidate) =>
            precise.searchPrecise({
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
                provider: precise.name,
                observedAt: new Date().toISOString(),
                isEstimate: false,
              },
            ]);
          }
        }
      }
    }

    // No live itineraries? The surface's real date pairs become estimate
    // cards — indicative totals plus affiliate deep links into the live
    // search for those exact dates. Better a priced date than a blank page.
    if (results.length === 0 && candidates.length > 0) {
      if (precise === null) degraded = true;
      for (const candidate of candidates.slice(0, 5)) {
        const estimate = directEstimate(
          origin,
          destination,
          candidate,
          this.searchLink(
            origin,
            destination,
            candidate.departureDate,
            candidate.returnDate,
          ),
        );
        results.push(estimate);
        onEvent?.({ type: 'result', result: estimate });
      }
    }

    /*
      L2.5 — split tickets via positioning hubs (user decision 2026-08-16):
      a separate-booking combination IS a route — Varna⇄Sofia on one ticket
      plus Sofia⇄Reykjavík on another — so it is priced end-to-end and
      judged on the same front as any through-ticket. Leg surfaces are the
      free tier (and double as the seasonality check: a month a hub route
      does not fly contributes no combos); only the best combo per hub
      spends Kiwi calls.
    */
    if (upstreamCalls < HARD_CALL_CAP) {
      try {
        const hubs = await this.positioningHubs(origin, destination);
        for (const hub of hubs) {
          const legA = await this.ensureSurface(
            origin,
            hub,
            month,
            HARD_CALL_CAP - upstreamCalls,
          );
          upstreamCalls += legA.calls;
          const legB = await this.ensureSurface(
            hub,
            destination,
            month,
            HARD_CALL_CAP - upstreamCalls,
          );
          upstreamCalls += legB.calls;
          if (legA.refused || legB.refused) degraded = true;

          const combos = composeSurfaceCombos(hub, legA.points, legB.points, {
            minNights: dto.minNights,
            maxNights: dto.maxNights,
            k: 1,
          });
          for (const combo of combos) {
            let composedAny = false;
            if (
              precise &&
              upstreamCalls + 2 <= HARD_CALL_CAP &&
              (await this.budget.canSpend(precise.name, 2))
            ) {
              upstreamCalls += 2;
              await this.budget.record(precise.name, 2, precise.costPerCall);

              const settled = await Promise.allSettled([
                precise.searchPrecise({
                  origin,
                  destination: hub,
                  departureDate: combo.legA.departureDate,
                  returnDate: combo.legA.returnDate,
                  passengers: dto.passengers ?? 1,
                  cabinClass: dto.cabinClass ?? CabinClass.ECONOMY,
                }),
                precise.searchPrecise({
                  origin: hub,
                  destination,
                  departureDate: combo.legB.departureDate,
                  returnDate: combo.legB.returnDate,
                  passengers: dto.passengers ?? 1,
                  cabinClass: dto.cabinClass ?? CabinClass.ECONOMY,
                }),
              ]);
              const [aResults, bResults] = settled.map((outcome) =>
                outcome.status === 'fulfilled' ? outcome.value : [],
              );

              // Composition needs real times BOTH ways; SerpApi's one-call
              // results carry no return leg, so they fall through to the
              // estimate below rather than composing a guess.
              const composed = composeSplitResults(hub, aResults, bResults);
              for (const result of composed) {
                results.push(result);
                onEvent?.({ type: 'result', result });
              }
              composedAny = composed.length > 0;
              // The composed total is a real, bookable end-to-end price for
              // the full route; future medians should know it.
              if (composed[0]) {
                await this.observations.append([
                  {
                    origin,
                    destination,
                    departureDate: combo.legA.departureDate,
                    returnDate: combo.legA.returnDate,
                    price: composed[0].lowestPrice,
                    currency: composed[0].currency,
                    provider: precise.name,
                    observedAt: new Date().toISOString(),
                    isEstimate: false,
                  },
                ]);
              }
            }

            if (!composedAny) {
              const estimate = splitEstimate(
                origin,
                destination,
                combo,
                this.searchLink(
                  origin,
                  hub,
                  combo.legA.departureDate,
                  combo.legA.returnDate,
                ),
                this.searchLink(
                  hub,
                  destination,
                  combo.legB.departureDate,
                  combo.legB.returnDate,
                ),
              );
              results.push(estimate);
              onEvent?.({ type: 'result', result: estimate });
            }
          }
        }
      } catch (error) {
        // The split tier is an upgrade, never a point of failure.
        this.logger.warn(`Split tier failed: ${(error as Error).message}`);
      }
    }

    // L3 — judgement over the Pareto front, anchored to route history.
    const periodMedian =
      (await this.observations.periodMedian(origin, destination, month)) ??
      median(surface.map((point) => point.price));
    // Estimates carry no durations — judging them would crown a zero.
    const front = paretoFront(results.filter((result) => !result.isEstimate));
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
