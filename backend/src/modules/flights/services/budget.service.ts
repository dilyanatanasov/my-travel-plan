import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiSpend } from '../entities/api-spend.entity';
import { ProviderName } from '../providers/flight-provider.interface';

/**
 * The monthly spend gate (plan M1). Key ROTATION stays in
 * ApiKeyManagerService — that concern is "which key", this one is
 * "may we call at all". Callers must pass canSpend() before paying
 * providers and record() after; the ledger row per (provider, month)
 * survives restarts, so a redeploy cannot reset the month to zero.
 *
 * On exhaustion the orchestrator degrades to cache-only — this service
 * only answers the question, it never throws.
 */

/** Per-provider monthly call caps; 0 or unset = that provider is uncapped. */
const CAP_ENV: Record<ProviderName, string> = {
  kiwi: 'BUDGET_KIWI_CALLS',
  serpapi: 'BUDGET_SERPAPI_CALLS',
  travelpayouts: 'BUDGET_TRAVELPAYOUTS_CALLS',
};

export function currentPeriod(now = new Date()): string {
  return now.toISOString().slice(0, 7);
}

@Injectable()
export class BudgetService {
  private readonly logger = new Logger(BudgetService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(ApiSpend)
    private readonly spendRepository: Repository<ApiSpend>,
  ) {}

  cap(provider: ProviderName): number {
    const raw = this.configService.get<string>(CAP_ENV[provider]);
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }

  async canSpend(provider: ProviderName, calls = 1): Promise<boolean> {
    const cap = this.cap(provider);
    if (cap === 0) return true;
    const row = await this.spendRepository.findOne({
      where: { provider, periodMonth: currentPeriod() },
    });
    const used = row?.calls ?? 0;
    const allowed = used + calls <= cap;
    if (!allowed) {
      this.logger.warn(
        `Budget exhausted for ${provider}: ${used}/${cap} this month`,
      );
    }
    return allowed;
  }

  async record(
    provider: ProviderName,
    calls: number,
    costPerCall: number,
  ): Promise<void> {
    const period = currentPeriod();
    // Upsert-then-increment keeps concurrent searches additive.
    await this.spendRepository
      .createQueryBuilder()
      .insert()
      .values({ provider, periodMonth: period, calls: 0, estCost: 0 })
      .orIgnore()
      .execute();
    await this.spendRepository
      .createQueryBuilder()
      .update()
      .set({
        calls: () => `calls + ${Math.max(0, Math.floor(calls))}`,
        estCost: () => `est_cost + ${(calls * costPerCall).toFixed(4)}`,
      })
      .where('provider = :provider AND period_month = :period', {
        provider,
        period,
      })
      .execute();
  }
}
