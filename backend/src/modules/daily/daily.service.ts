import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DailyResult } from './daily-result.entity';

export interface DailyStats {
  played: number;
  won: number;
  streak: number;
  maxStreak: number;
  lastWonDate: string | null;
}

/** Server clock, UTC — the same day everyone's puzzle derives from. */
export function todayUtc(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function previousDay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - 86_400_000)
    .toISOString()
    .slice(0, 10);
}

/**
 * Stats from the rows, pure so it can be tested cold. Streak = consecutive
 * won days counting back from today (or yesterday, if today is unplayed).
 */
export function computeStats(
  rows: { date: string; won: boolean }[],
  today: string,
): DailyStats {
  const byDate = new Map(rows.map((row) => [row.date, row.won]));
  const played = rows.length;
  const won = rows.filter((row) => row.won).length;
  const lastWonDate =
    rows
      .filter((row) => row.won)
      .map((row) => row.date)
      .sort()
      .at(-1) ?? null;

  // Current streak: anchored at today, or yesterday when today is pending.
  let cursor = byDate.has(today) ? today : previousDay(today);
  let streak = 0;
  while (byDate.get(cursor) === true) {
    streak += 1;
    cursor = previousDay(cursor);
  }

  // Max streak: one pass over the sorted won-dates.
  let maxStreak = 0;
  let run = 0;
  let previous: string | null = null;
  for (const date of [...byDate.keys()].sort()) {
    if (!byDate.get(date)) {
      run = 0;
      previous = null;
      continue;
    }
    run = previous !== null && previousDay(date) === previous ? run + 1 : 1;
    previous = date;
    maxStreak = Math.max(maxStreak, run);
  }

  return { played, won, streak, maxStreak, lastWonDate };
}

/**
 * The puzzle's server half (2026-08-14): the browser plays, the server
 * remembers. First write wins per (user, day) — replaying a cleared cache
 * cannot overwrite the answer of record — and only TODAY is writable, so
 * nobody backfills a streak.
 */
@Injectable()
export class DailyService {
  constructor(
    @InjectRepository(DailyResult)
    private readonly resultRepository: Repository<DailyResult>,
  ) {}

  async record(
    userId: number,
    date: string,
    won: boolean,
    tries: number,
  ): Promise<DailyStats> {
    if (date !== todayUtc()) {
      throw new BadRequestException('Only today’s puzzle can be recorded');
    }
    // orIgnore: the unique (user_id, date) makes replays a no-op.
    await this.resultRepository
      .createQueryBuilder()
      .insert()
      .values({ userId, date, won, tries })
      .orIgnore()
      .execute();
    return this.stats(userId);
  }

  async stats(userId: number): Promise<DailyStats> {
    const rows = await this.resultRepository.find({
      where: { userId },
      select: ['date', 'won'],
    });
    return computeStats(
      rows.map((row) => ({ date: String(row.date), won: row.won })),
      todayUtc(),
    );
  }
}
