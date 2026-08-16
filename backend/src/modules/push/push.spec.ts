import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import * as webpush from 'web-push';
import { PushService } from './push.service';
import { PushSubscription } from './push-subscription.entity';

jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

/**
 * The permission model and the pruning rule: guests cannot subscribe,
 * unsubscribe never crosses user boundaries, and a 410 from the push
 * service deletes the row while a transient failure keeps it.
 */

function makeConfig(values: Record<string, string>): ConfigService {
  return {
    get: (key: string, fallback?: string) => values[key] ?? fallback,
  } as unknown as ConfigService;
}

const VAPID_ON = {
  VAPID_PUBLIC_KEY: 'test-public',
  VAPID_PRIVATE_KEY: 'test-private',
};

describe('PushService.subscribe', () => {
  const execute = jest.fn().mockResolvedValue(undefined);
  const upsertChain = {
    insert: () => upsertChain,
    values: () => upsertChain,
    orUpdate: () => upsertChain,
    execute,
  };
  const repo = { createQueryBuilder: () => upsertChain };
  const service = new PushService(
    makeConfig({}),
    repo as unknown as Repository<PushSubscription>,
  );

  it('refuses guests — a push endpoint outlives a guest account', async () => {
    await expect(
      service.subscribe({ id: 3, email: null }, 'https://p.example/e', 'k', 'a'),
    ).rejects.toThrow(ForbiddenException);
    expect(execute).not.toHaveBeenCalled();
  });

  it('upserts for a registered user', async () => {
    await service.subscribe(
      { id: 3, email: 'me@example.com' },
      'https://p.example/e',
      'k',
      'a',
    );
    expect(execute).toHaveBeenCalled();
  });
});

describe('PushService.unsubscribe', () => {
  it('deletes only the caller’s row for that endpoint', async () => {
    const del = jest.fn().mockResolvedValue({ affected: 0 });
    const service = new PushService(
      makeConfig({}),
      { delete: del } as unknown as Repository<PushSubscription>,
    );
    await service.unsubscribe(7, 'https://p.example/e');
    expect(del).toHaveBeenCalledWith({
      userId: 7,
      endpoint: 'https://p.example/e',
    });
  });
});

describe('PushService.sendToUser', () => {
  const rows = [
    { id: 1, userId: 7, endpoint: 'https://p.example/dead', p256dh: 'k', auth: 'a' },
    { id: 2, userId: 7, endpoint: 'https://p.example/live', p256dh: 'k', auth: 'a' },
  ];
  const payload = { title: 't', body: 'b', url: '/daily' };

  beforeEach(() => jest.clearAllMocks());

  function makeService(find: jest.Mock, del: jest.Mock) {
    return new PushService(
      makeConfig(VAPID_ON),
      { find, delete: del } as unknown as Repository<PushSubscription>,
    );
  }

  it('prunes a subscription the push service reports gone (410)', async () => {
    (webpush.sendNotification as jest.Mock).mockImplementation(
      (subscription: { endpoint: string }) =>
        subscription.endpoint.endsWith('/dead')
          ? Promise.reject({ statusCode: 410 })
          : Promise.resolve(),
    );
    const del = jest.fn().mockResolvedValue({ affected: 1 });
    const service = makeService(jest.fn().mockResolvedValue(rows), del);

    await service.sendToUser(7, payload);
    expect(webpush.sendNotification).toHaveBeenCalledTimes(2);
    expect(del).toHaveBeenCalledTimes(1);
    expect(del).toHaveBeenCalledWith({ id: 1 });
  });

  it('keeps the row on a transient failure', async () => {
    (webpush.sendNotification as jest.Mock).mockRejectedValue({
      statusCode: 500,
    });
    const del = jest.fn();
    const service = makeService(jest.fn().mockResolvedValue([rows[1]]), del);

    await service.sendToUser(7, payload);
    expect(del).not.toHaveBeenCalled();
  });

  it('sends nothing when VAPID is unset (dev/CI no-op)', async () => {
    const service = new PushService(
      makeConfig({}),
      {
        find: jest.fn().mockResolvedValue([rows[1]]),
        delete: jest.fn(),
      } as unknown as Repository<PushSubscription>,
    );
    await service.sendToUser(7, payload);
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });
});
