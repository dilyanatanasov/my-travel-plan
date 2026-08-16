import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FlightJourney } from '../flights/entities/flight-journey.entity';
import { AnniversarySend } from './anniversary-send.entity';
import { PushPayload, PushService } from './push.service';

/**
 * Where a journey "went", for the notification copy. A round trip ends
 * where it started, so its destination is the stop before the return leg;
 * everything else reads the final arrival.
 */
export function journeyDestination(journey: FlightJourney): string {
  const legs = [...(journey.legs ?? [])].sort(
    (a, b) => a.legOrder - b.legOrder,
  );
  if (legs.length === 0) return 'somewhere on your map';
  const leg =
    journey.isRoundTrip && legs.length >= 2 ? legs[legs.length - 2] : legs[legs.length - 1];
  const airport = leg.arrivalAirport;
  const place = [airport?.city, airport?.country].filter(Boolean).join(', ');
  return place || airport?.name || 'somewhere on your map';
}

export function anniversaryPayload(
  years: number,
  destination: string,
): PushPayload {
  const when = years === 1 ? 'One year ago today' : `${years} years ago today`;
  return {
    title: `✈️ ${when}`,
    body: `You landed in ${destination}. Tap to relive the trip.`,
    url: '/',
  };
}

/**
 * The anniversary sweep (M2 of the push plan): once a day, find journeys
 * whose exact date matches today's month and day, and tell their owners how
 * long it has been.
 *
 * Only day-precision dates can anniversary — "sometime in 2019" has no
 * today. Feb 29 trips ring only on leap years, which is what really
 * happened. The candidate query already requires the user to hold at least
 * one push subscription, so the send-log records only notifications that
 * had somewhere to go.
 *
 * Dedup is claim-then-send: an INSERT … ON CONFLICT DO NOTHING into
 * anniversary_sends is the lock, so a restart mid-sweep (or a second
 * container) skips what was already claimed rather than sending it twice.
 */
@Injectable()
export class AnniversaryService {
  private readonly logger = new Logger(AnniversaryService.name);

  constructor(
    @InjectRepository(FlightJourney)
    private readonly journeyRepository: Repository<FlightJourney>,
    @InjectRepository(AnniversarySend)
    private readonly sendLogRepository: Repository<AnniversarySend>,
    private readonly pushService: PushService,
  ) {}

  // 08:00 UTC: morning for the app's Europe-centred users. Users have no
  // stored timezone; a fixed hour is the honest v1.
  @Cron('0 8 * * *', { timeZone: 'UTC' })
  scheduledSweep(): void {
    void this.sweep().catch((error) =>
      // A failed sweep must never take the app down; tomorrow retries
      // whatever was not yet claimed.
      this.logger.error('Anniversary sweep failed', error as Error),
    );
  }

  /** Exposed for tests and for running by hand. Returns sends attempted. */
  async sweep(now = new Date()): Promise<number> {
    const today = now.toISOString().slice(0, 10);
    const year = Number(today.slice(0, 4));
    const month = Number(today.slice(5, 7));
    const day = Number(today.slice(8, 10));

    // Eager relations do not apply inside a query builder, so the legs and
    // their arrival airports are joined explicitly.
    const candidates = await this.journeyRepository
      .createQueryBuilder('journey')
      .innerJoinAndSelect('journey.legs', 'leg')
      .innerJoinAndSelect('leg.arrivalAirport', 'arrival')
      .where('journey.user_id IS NOT NULL')
      .andWhere("journey.date_precision = 'day'")
      .andWhere('journey.journey_date IS NOT NULL')
      .andWhere('EXTRACT(MONTH FROM journey.journey_date) = :month', { month })
      .andWhere('EXTRACT(DAY FROM journey.journey_date) = :day', { day })
      .andWhere('EXTRACT(YEAR FROM journey.journey_date) < :year', { year })
      .andWhere(
        'EXISTS (SELECT 1 FROM push_subscriptions ps WHERE ps.user_id = journey.user_id)',
      )
      .getMany();

    let sent = 0;
    for (const journey of candidates) {
      const journeyYear = Number(String(journey.journeyDate).slice(0, 4));
      const years = year - journeyYear;
      if (years < 1 || !journey.userId) continue;

      const claim = await this.sendLogRepository
        .createQueryBuilder()
        .insert()
        .values({ userId: journey.userId, journeyId: journey.id, year })
        .orIgnore()
        .execute();
      // Postgres RETURNING is empty when ON CONFLICT ignored the row —
      // someone (an earlier run, another container) already claimed it.
      const claimed = Array.isArray(claim.raw) && claim.raw.length > 0;
      if (!claimed) continue;

      await this.pushService.sendToUser(
        journey.userId,
        anniversaryPayload(years, journeyDestination(journey)),
      );
      sent += 1;
    }

    if (sent > 0) {
      this.logger.log(`Sent ${sent} anniversary notification(s)`);
    }
    return sent;
  }
}
