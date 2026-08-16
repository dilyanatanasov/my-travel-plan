import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TripWatch } from '../entities/trip-watch.entity';
import { PushService } from '../../push/push.service';
import { MailService } from '../../mail/mail.service';
import { BudgetService } from './budget.service';
import { PriceObservationsService } from './price-observations.service';
import { TravelpayoutsProvider } from '../providers/travelpayouts.provider';
import { nightsBetween } from './search-funnel.util';
import { alertCopy, shouldAlert } from './watch-alerts.util';

/** Bounded so the nightly sweep's upstream spend is bounded with it. */
const MAX_ACTIVE_WATCHES = 10;

export interface CreateWatchInput {
  origin: string;
  destination: string;
  month: string;
  minNights?: number;
  maxNights?: number;
  thresholdPrice?: number;
}

/**
 * Trip watches (M4): CRUD owner-scoped end to end, plus the nightly
 * refresh at 03:00 UTC. The sweep pays only the FREE surface provider
 * (Travelpayouts) — watches must never burn the paid budget while their
 * owner sleeps; SerpApi and Kiwi stay reserved for interactive searches.
 *
 * Alerts go out push-first (free, instant) with email alongside for
 * verified addresses — both channels carry the same fact and the same
 * 24h debounce recorded on the watch row.
 */
@Injectable()
export class WatchesService {
  private readonly logger = new Logger(WatchesService.name);

  constructor(
    @InjectRepository(TripWatch)
    private readonly watchRepository: Repository<TripWatch>,
    private readonly observations: PriceObservationsService,
    private readonly travelpayouts: TravelpayoutsProvider,
    private readonly budget: BudgetService,
    private readonly pushService: PushService,
    private readonly mailService: MailService,
  ) {}

  async create(userId: number, input: CreateWatchInput): Promise<TripWatch> {
    const active = await this.watchRepository.count({
      where: { userId, active: true },
    });
    if (active >= MAX_ACTIVE_WATCHES) {
      throw new BadRequestException(
        `You can watch up to ${MAX_ACTIVE_WATCHES} route-months at once`,
      );
    }
    try {
      return await this.watchRepository.save(
        this.watchRepository.create({
          userId,
          origin: input.origin.toUpperCase(),
          destination: input.destination.toUpperCase(),
          month: input.month,
          minNights: input.minNights ?? null,
          maxNights: input.maxNights ?? null,
          thresholdPrice: input.thresholdPrice ?? null,
        }),
      );
    } catch (error) {
      // The unique (user, route, month) makes duplicates a 400, not a 500.
      if ((error as { code?: string }).code === '23505') {
        throw new BadRequestException('You already watch this route-month');
      }
      throw error;
    }
  }

  async list(userId: number): Promise<TripWatch[]> {
    return this.watchRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async remove(userId: number, watchId: number): Promise<void> {
    const result = await this.watchRepository.delete({
      id: watchId,
      userId, // owner-scoped: someone else's id deletes nothing
    });
    if (!result.affected) throw new NotFoundException('Unknown watch');
  }

  @Cron('0 3 * * *', { timeZone: 'UTC' })
  scheduledSweep(): void {
    void this.sweep().catch((error) =>
      this.logger.error('Watch sweep failed', error as Error),
    );
  }

  /** Exposed for tests and manual runs. Returns alerts sent. */
  async sweep(now = new Date()): Promise<number> {
    const watches = await this.watchRepository.find({
      where: { active: true },
      relations: ['user'],
    });
    let alerts = 0;

    for (const watch of watches) {
      const currentMonth = now.toISOString().slice(0, 7);
      if (watch.month < currentMonth) {
        // A month in the past has no flights left to watch.
        await this.watchRepository.update(watch.id, { active: false });
        continue;
      }

      try {
        // History BEFORE today's refresh: the trailing floor the new price
        // must undercut, not a mirror it just wrote itself.
        const trailingMin = await this.observations.trailingMin(
          watch.origin,
          watch.destination,
          watch.month,
          now,
        );

        let surface = await this.observations.freshSurface(
          watch.origin,
          watch.destination,
          `${watch.month}-01`,
          now,
        );
        if (
          surface.length === 0 &&
          this.travelpayouts.isConfigured() &&
          (await this.budget.canSpend('travelpayouts'))
        ) {
          surface = await this.travelpayouts.getPriceSurface({
            origin: watch.origin,
            destination: watch.destination,
            month: `${watch.month}-01`,
            roundTrip: true,
          });
          await this.budget.record(
            'travelpayouts',
            1,
            this.travelpayouts.costPerCall,
          );
          await this.observations.append(surface);
        }

        const eligible = surface.filter((point) => {
          if (!point.returnDate) return watch.minNights === null;
          const nights = nightsBetween(point.departureDate, point.returnDate);
          if (watch.minNights !== null && nights < watch.minNights)
            return false;
          if (watch.maxNights !== null && nights > watch.maxNights)
            return false;
          return true;
        });
        if (eligible.length === 0) continue;
        const bestPrice = Math.min(...eligible.map((point) => point.price));

        if (
          !shouldAlert({
            bestPrice,
            thresholdPrice:
              watch.thresholdPrice === null ? null : Number(watch.thresholdPrice),
            trailingMin,
            lastNotifiedPrice:
              watch.lastNotifiedPrice === null
                ? null
                : Number(watch.lastNotifiedPrice),
            lastNotifiedAt: watch.lastNotifiedAt,
            now,
          })
        ) {
          continue;
        }

        const copy = alertCopy({ ...watch, bestPrice });
        await this.pushService.sendToUser(watch.userId, {
          ...copy,
          url: '/search/trips',
        });
        if (watch.user?.email && watch.user.emailVerified) {
          await this.mailService
            .sendPriceAlertEmail(watch.user.email, copy.title, copy.body)
            .catch((error: Error) =>
              // A mail outage must not stop the sweep or the push channel.
              this.logger.warn(`Alert email failed: ${error.message}`),
            );
        }
        await this.watchRepository.update(watch.id, {
          lastNotifiedPrice: bestPrice,
          lastNotifiedAt: now,
        });
        alerts += 1;
      } catch (error) {
        this.logger.warn(
          `Watch ${watch.id} sweep failed: ${(error as Error).message}`,
        );
      }
    }

    if (alerts > 0) this.logger.log(`Sent ${alerts} price alert(s)`);
    return alerts;
  }
}
