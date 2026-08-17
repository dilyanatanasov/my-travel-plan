import { Repository } from 'typeorm';
import { PriceObservation } from '../entities/price-observation.entity';
import { PriceObservationsService } from './price-observations.service';

/**
 * The janitor's rules: estimates die at 120 days, real quotes live to 730,
 * and the split is enforced in the delete criteria - not by hope.
 */
describe('PriceObservationsService.prune', () => {
  it('deletes stale estimates and ancient quotes on separate clocks', async () => {
    const calls: unknown[] = [];
    const del = jest.fn().mockImplementation((criteria) => {
      calls.push(criteria);
      return Promise.resolve({ affected: 2 });
    });
    const service = new PriceObservationsService({
      delete: del,
    } as unknown as Repository<PriceObservation>);

    const now = new Date('2026-08-17T03:30:00Z');
    await expect(service.prune(now)).resolves.toBe(4);

    expect(del).toHaveBeenCalledTimes(2);
    const [estimates, quotes] = calls as {
      isEstimate: boolean;
      observedAt: { value: Date };
    }[];
    expect(estimates.isEstimate).toBe(true);
    expect(quotes.isEstimate).toBe(false);
    const days = (cutoff: Date) =>
      Math.round((now.getTime() - cutoff.getTime()) / 86_400_000);
    expect(days(estimates.observedAt.value)).toBe(120);
    expect(days(quotes.observedAt.value)).toBe(730);
  });
});
