import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { FlightsService } from './flights.service';
import { FlightJourney } from './entities/flight-journey.entity';

/**
 * The reorder rule guards chronology: undated journeys swap freely, dated
 * ones only with the exact same stored date — a cross-date swap would
 * silently rewrite history. Repos are mocked; this pins the service rule.
 */

type Row = {
  id: number;
  journeyDate: string | null;
  sortIndex: number;
};

describe('FlightsService.reorder', () => {
  let rows: Map<number, Row>;
  let updates: Array<{ id: number; sortIndex: number }>;
  let service: FlightsService;

  const makeService = () => {
    const journeyRepo = {
      findOne: jest.fn(async ({ where }: { where: { id: number } }) => {
        const row = rows.get(where.id);
        return row ? { ...row } : null;
      }),
      manager: {
        transaction: jest.fn(
          async (work: (manager: unknown) => Promise<void>) => {
            await work({
              update: async (
                _entity: unknown,
                id: number,
                patch: { sortIndex: number },
              ) => {
                updates.push({ id, sortIndex: patch.sortIndex });
              },
            });
          },
        ),
      },
    };
    return new FlightsService(
      journeyRepo as unknown as Repository<FlightJourney>,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
  };

  beforeEach(() => {
    rows = new Map([
      [1, { id: 1, journeyDate: '2026-05-10', sortIndex: 1 }],
      [2, { id: 2, journeyDate: '2026-05-10', sortIndex: 2 }],
      [3, { id: 3, journeyDate: '2026-07-01', sortIndex: 3 }],
      [4, { id: 4, journeyDate: null, sortIndex: 4 }],
      [5, { id: 5, journeyDate: null, sortIndex: 5 }],
    ]);
    updates = [];
    service = makeService();
  });

  it('swaps sort indexes of two same-date journeys', async () => {
    await service.reorder(7, 1, 2);
    expect(updates).toEqual([
      { id: 1, sortIndex: 2 },
      { id: 2, sortIndex: 1 },
    ]);
  });

  it('swaps two undated journeys freely', async () => {
    await service.reorder(7, 4, 5);
    expect(updates).toEqual([
      { id: 4, sortIndex: 5 },
      { id: 5, sortIndex: 4 },
    ]);
  });

  it('refuses a dated↔dated swap across different dates', async () => {
    await expect(service.reorder(7, 1, 3)).rejects.toThrow(BadRequestException);
    expect(updates).toHaveLength(0);
  });

  it('refuses a dated↔undated swap', async () => {
    await expect(service.reorder(7, 1, 4)).rejects.toThrow(BadRequestException);
    expect(updates).toHaveLength(0);
  });

  it('refuses swapping a journey with itself', async () => {
    await expect(service.reorder(7, 1, 1)).rejects.toThrow(BadRequestException);
    expect(updates).toHaveLength(0);
  });

  it('404s on a journey that does not exist (or is not yours)', async () => {
    await expect(service.reorder(7, 1, 999)).rejects.toThrow();
    expect(updates).toHaveLength(0);
  });
});
