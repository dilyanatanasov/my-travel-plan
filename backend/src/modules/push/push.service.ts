import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as webpush from 'web-push';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PushSubscription } from './push-subscription.entity';

export interface PushPayload {
  title: string;
  body: string;
  /** In-app path the notification click opens, e.g. "/daily". */
  url: string;
}

/**
 * Web push over VAPID.
 *
 * With no VAPID keys set (development, tests, CI) nothing is sent: the
 * notification is logged instead — same unset-env no-op pattern as
 * MailService. Keys live only in the droplet `.env` (recreate to apply);
 * the public half is served to the browser via GET /push/public-key rather
 * than baked into the frontend build, so the pair can never drift apart.
 *
 * Permission model: a subscription row belongs to its user; subscribe and
 * unsubscribe operate only on the caller's rows, and sends are always
 * server-initiated — there is no user-facing send endpoint.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private vapidConfigured = false;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(PushSubscription)
    private readonly subscriptionRepository: Repository<PushSubscription>,
  ) {}

  publicKey(): string | null {
    return this.configService.get<string>('VAPID_PUBLIC_KEY') ?? null;
  }

  private get privateKey(): string | undefined {
    return this.configService.get<string>('VAPID_PRIVATE_KEY');
  }

  private get enabled(): boolean {
    return Boolean(this.publicKey() && this.privateKey);
  }

  private ensureVapid(): void {
    if (this.vapidConfigured) return;
    webpush.setVapidDetails(
      this.configService.get<string>(
        'VAPID_SUBJECT',
        'mailto:no-reply@mycontrail.com',
      ),
      this.publicKey()!,
      this.privateKey!,
    );
    this.vapidConfigured = true;
  }

  /**
   * Guests cannot subscribe: a push endpoint outlives the session that
   * created it, and a guest row is collected after 30 idle days — the
   * subscription would then push to a browser whose account no longer
   * exists. Registration is the durability line, checked here rather than
   * in the controller so no future caller can forget it.
   */
  async subscribe(
    user: AuthenticatedUser,
    endpoint: string,
    p256dh: string,
    auth: string,
  ): Promise<void> {
    if (user.email === null) {
      throw new ForbiddenException(
        'Create an account to receive notifications',
      );
    }
    // The endpoint identifies one browser profile. On conflict, reassign to
    // whoever is signed in now — the previous owner logged out of this device.
    await this.subscriptionRepository
      .createQueryBuilder()
      .insert()
      .values({ userId: user.id, endpoint, p256dh, auth })
      .orUpdate(['user_id', 'p256dh', 'auth', 'last_seen_at'], ['endpoint'])
      .execute();
  }

  /** Scoped to the caller: someone else's endpoint is silently untouched. */
  async unsubscribe(userId: number, endpoint: string): Promise<void> {
    await this.subscriptionRepository.delete({ userId, endpoint });
  }

  /**
   * Send to every subscription the user holds. Dead endpoints (404/410 from
   * the push service) are deleted on the spot; other failures are logged and
   * kept — a temporarily unreachable push service is not a dead browser.
   */
  async sendToUser(userId: number, payload: PushPayload): Promise<void> {
    const subscriptions = await this.subscriptionRepository.find({
      where: { userId },
    });
    if (subscriptions.length === 0) return;

    if (!this.enabled) {
      this.logger.log(
        `[push disabled] to user ${userId}: ${payload.title} — ${payload.body} (${payload.url})`,
      );
      return;
    }
    this.ensureVapid();

    const body = JSON.stringify(payload);
    for (const subscription of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          body,
        );
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await this.subscriptionRepository.delete({ id: subscription.id });
        } else {
          this.logger.warn(
            `Push to subscription ${subscription.id} failed: ${statusCode ?? error}`,
          );
        }
      }
    }
  }
}
