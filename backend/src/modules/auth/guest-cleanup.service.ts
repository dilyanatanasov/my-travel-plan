import { Injectable, Logger } from '@nestjs/common';
import { Interval, Timeout } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';

/** How long an untouched guest account is kept before it is collected. */
const GUEST_TTL_DAYS = 30;

/** How often the sweep runs. */
const SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** Delay before the first sweep, so boot is never blocked by it. */
const FIRST_SWEEP_DELAY_MS = 60 * 1000;

/**
 * Collects abandoned guest accounts.
 *
 * Anonymous sessions create a real row so that every scoped query, the
 * distance maths and the country derivation keep working unchanged — but
 * without this, one row accumulates per visitor who never signs up and the
 * users table fills with accounts nobody will return to.
 *
 * `visits` and `flight_journeys` both cascade on user_id, so deleting the row
 * takes its data with it; there is nothing to clean up by hand.
 *
 * On @nestjs/schedule since 2026-08-16: this was the app's only scheduled
 * job and ran on a raw setInterval, with a note to switch to the real
 * scheduler when a second job appeared. The anniversary sweep is that job.
 */
@Injectable()
export class GuestCleanupService {
  private readonly logger = new Logger(GuestCleanupService.name);
  private running = false;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  @Timeout(FIRST_SWEEP_DELAY_MS)
  firstSweep(): void {
    void this.sweep();
  }

  @Interval(SWEEP_INTERVAL_MS)
  scheduledSweep(): void {
    void this.sweep();
  }

  /** Exposed for tests and for running it by hand. */
  async sweep(): Promise<number> {
    // A slow sweep must never overlap itself and delete twice.
    if (this.running) return 0;
    this.running = true;

    try {
      const cutoff = new Date(Date.now() - GUEST_TTL_DAYS * 24 * 60 * 60 * 1000);

      /*
        isGuest is part of the where clause, not just an assumption: an
        account that has been upgraded has isGuest false, and a bug that
        deleted real accounts by their last_seen_at would be unrecoverable.
      */
      const result = await this.userRepository.delete({
        isGuest: true,
        lastSeenAt: LessThan(cutoff),
      });

      const removed = result.affected ?? 0;
      if (removed > 0) {
        this.logger.log(
          `Removed ${removed} guest account(s) untouched for ${GUEST_TTL_DAYS}+ days`,
        );
      }
      return removed;
    } catch (error) {
      // Housekeeping must never take the app down.
      this.logger.error('Guest cleanup sweep failed', error as Error);
      return 0;
    } finally {
      this.running = false;
    }
  }
}
