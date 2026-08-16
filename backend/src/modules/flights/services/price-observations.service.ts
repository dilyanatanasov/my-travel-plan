import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PriceObservation } from '../entities/price-observation.entity';
import { PricePoint } from '../providers/flight-provider.interface';
import { nightsBetween, surfaceTtlHours } from './search-funnel.util';

/**
 * The funnel's memory: every observed price is appended, and the surface
 * reads back only what is still fresh for its lead time (48h beyond 60
 * days out, 12h at 14–60, 4h inside two weeks).
 */
@Injectable()
export class PriceObservationsService {
  constructor(
    @InjectRepository(PriceObservation)
    private readonly observationRepository: Repository<PriceObservation>,
  ) {}

  async append(points: PricePoint[]): Promise<void> {
    if (points.length === 0) return;
    await this.observationRepository.insert(
      points.map((point) => ({
        origin: point.origin,
        destination: point.destination,
        departureDate: point.departureDate,
        returnDate: point.returnDate,
        nights: point.returnDate
          ? nightsBetween(point.departureDate, point.returnDate)
          : null,
        totalPrice: point.price,
        currency: point.currency,
        provider: point.provider,
        isEstimate: point.isEstimate,
        observedAt: new Date(point.observedAt),
      })),
    );
  }

  /**
   * Fresh surface for a route+month from history alone. Returns the latest
   * observation per date pair that is still inside its TTL; the caller
   * decides whether the coverage is good enough or providers must be paid.
   */
  async freshSurface(
    origin: string,
    destination: string,
    month: string,
    now = new Date(),
  ): Promise<PricePoint[]> {
    const monthPrefix = month.slice(0, 7);
    const rows = await this.observationRepository
      .createQueryBuilder('obs')
      .where('obs.origin = :origin AND obs.destination = :destination', {
        origin,
        destination,
      })
      .andWhere("to_char(obs.departure_date, 'YYYY-MM') = :monthPrefix", {
        monthPrefix,
      })
      .orderBy('obs.observed_at', 'DESC')
      .limit(2000)
      .getMany();

    const today = now.toISOString().slice(0, 10);
    const freshest = new Map<string, PriceObservation>();
    for (const row of rows) {
      const key = `${row.departureDate}|${row.returnDate ?? ''}`;
      if (!freshest.has(key)) freshest.set(key, row); // rows come newest-first
    }

    return [...freshest.values()]
      .filter((row) => {
        const ttlMs =
          surfaceTtlHours(String(row.departureDate), today) * 3_600_000;
        return now.getTime() - new Date(row.observedAt).getTime() <= ttlMs;
      })
      .map((row) => ({
        origin: row.origin,
        destination: row.destination,
        departureDate: String(row.departureDate),
        returnDate: row.returnDate ? String(row.returnDate) : null,
        price: Number(row.totalPrice),
        currency: row.currency,
        provider: row.provider as PricePoint['provider'],
        observedAt: new Date(row.observedAt).toISOString(),
        isEstimate: row.isEstimate,
      }));
  }

  /**
   * The 30-day trailing minimum for a route+month, deliberately excluding
   * the last 24h: it is the floor a NEW price must undercut, so it must
   * not include the refresh that is about to be judged against it.
   */
  async trailingMin(
    origin: string,
    destination: string,
    month: string,
    now = new Date(),
  ): Promise<number | null> {
    const result: { min: string | null } | undefined =
      await this.observationRepository
        .createQueryBuilder('obs')
        .select('MIN(obs.total_price)', 'min')
        .where('obs.origin = :origin AND obs.destination = :destination', {
          origin,
          destination,
        })
        .andWhere("to_char(obs.departure_date, 'YYYY-MM') = :monthPrefix", {
          monthPrefix: month.slice(0, 7),
        })
        .andWhere('obs.observed_at BETWEEN :from AND :to', {
          from: new Date(now.getTime() - 30 * 86_400_000),
          to: new Date(now.getTime() - 86_400_000),
        })
        .getRawOne();
    const value = Number(result?.min);
    return Number.isFinite(value) ? value : null;
  }

  /** Median observed price for a route+month over a trailing window. */
  async periodMedian(
    origin: string,
    destination: string,
    month: string,
  ): Promise<number | null> {
    const result: { median: string | null } | undefined =
      await this.observationRepository
        .createQueryBuilder('obs')
        .select(
          'percentile_cont(0.5) WITHIN GROUP (ORDER BY obs.total_price)',
          'median',
        )
        .where('obs.origin = :origin AND obs.destination = :destination', {
          origin,
          destination,
        })
        .andWhere("to_char(obs.departure_date, 'YYYY-MM') = :monthPrefix", {
          monthPrefix: month.slice(0, 7),
        })
        .getRawOne();
    const value = Number(result?.median);
    return Number.isFinite(value) ? value : null;
  }
}
