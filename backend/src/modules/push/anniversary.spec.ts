import { Repository } from 'typeorm';
import { FlightJourney } from '../flights/entities/flight-journey.entity';
import { AnniversarySend } from './anniversary-send.entity';
import {
  AnniversaryService,
  anniversaryPayload,
  journeyDestination,
} from './anniversary.service';
import { PushService } from './push.service';

/**
 * The copy rules and the dedup claim: a round trip's destination is where
 * it turned around, and a claimed (user, journey, year) never sends twice.
 */

function legTo(
  order: number,
  city: string | null,
  country: string | null,
  name = 'Airport',
) {
  return {
    legOrder: order,
    arrivalAirport: { city, country, name },
  };
}

describe('journeyDestination', () => {
  it('reads the final arrival on a one-way', () => {
    const journey = {
      isRoundTrip: false,
      legs: [legTo(1, 'Vienna', 'Austria'), legTo(2, 'Tokyo', 'Japan')],
    } as unknown as FlightJourney;
    expect(journeyDestination(journey)).toBe('Tokyo, Japan');
  });

  it('a round trip ends at home, so the destination is the stop before', () => {
    const journey = {
      isRoundTrip: true,
      legs: [legTo(1, 'Rome', 'Italy'), legTo(2, 'Sofia', 'Bulgaria')],
    } as unknown as FlightJourney;
    expect(journeyDestination(journey)).toBe('Rome, Italy');
  });

  it('falls back through country and airport name', () => {
    const journey = {
      isRoundTrip: false,
      legs: [legTo(1, null, 'Iceland', 'Keflavik')],
    } as unknown as FlightJourney;
    expect(journeyDestination(journey)).toBe('Iceland');
    const bare = {
      isRoundTrip: false,
      legs: [legTo(1, null, null, 'Keflavik')],
    } as unknown as FlightJourney;
    expect(journeyDestination(bare)).toBe('Keflavik');
  });
});

describe('anniversaryPayload', () => {
  it('speaks singular and plural', () => {
    expect(anniversaryPayload(1, 'Tokyo, Japan').title).toBe(
      '✈️ One year ago today',
    );
    expect(anniversaryPayload(3, 'Tokyo, Japan').title).toBe(
      '✈️ 3 years ago today',
    );
  });
});

describe('AnniversaryService.sweep', () => {
  const now = new Date('2026-08-16T08:00:00Z');

  function makeService(
    candidates: unknown[],
    claimRaw: unknown[][],
    sendToUser: jest.Mock,
  ) {
    const journeyQb = {
      innerJoinAndSelect: () => journeyQb,
      where: () => journeyQb,
      andWhere: () => journeyQb,
      getMany: jest.fn().mockResolvedValue(candidates),
    };
    const claims = [...claimRaw];
    const claimChain = {
      insert: () => claimChain,
      values: () => claimChain,
      orIgnore: () => claimChain,
      execute: jest
        .fn()
        .mockImplementation(() =>
          Promise.resolve({ raw: claims.shift() ?? [] }),
        ),
    };
    return new AnniversaryService(
      { createQueryBuilder: () => journeyQb } as unknown as Repository<FlightJourney>,
      { createQueryBuilder: () => claimChain } as unknown as Repository<AnniversarySend>,
      { sendToUser } as unknown as PushService,
    );
  }

  const journey = {
    id: 11,
    userId: 7,
    journeyDate: '2024-08-16',
    isRoundTrip: false,
    legs: [legTo(1, 'Tokyo', 'Japan')],
  };

  it('sends once for a fresh claim, with the years spelled out', async () => {
    const sendToUser = jest.fn().mockResolvedValue(undefined);
    const service = makeService([journey], [[{ id: 1 }]], sendToUser);
    await expect(service.sweep(now)).resolves.toBe(1);
    expect(sendToUser).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ title: '✈️ 2 years ago today' }),
    );
  });

  it('skips a journey another run already claimed', async () => {
    const sendToUser = jest.fn();
    const service = makeService([journey], [[]], sendToUser);
    await expect(service.sweep(now)).resolves.toBe(0);
    expect(sendToUser).not.toHaveBeenCalled();
  });

  it('never celebrates a trip from this same year', async () => {
    const sendToUser = jest.fn();
    const thisYear = { ...journey, journeyDate: '2026-08-16' };
    const service = makeService([thisYear], [[{ id: 1 }]], sendToUser);
    await expect(service.sweep(now)).resolves.toBe(0);
    expect(sendToUser).not.toHaveBeenCalled();
  });
});
