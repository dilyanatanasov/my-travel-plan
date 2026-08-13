import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Thin wrapper over Resend's REST API.
 *
 * With no RESEND_API_KEY set (development, tests, CI) nothing is sent: the
 * mail is logged instead, link included, so flows are fully exercisable
 * locally by copying the link out of the backend log. Same unset-env no-op
 * pattern as the analytics layer.
 *
 * Plain fetch rather than the SDK: one endpoint, one dependency saved.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly configService: ConfigService) {}

  private get apiKey(): string | undefined {
    return this.configService.get<string>('RESEND_API_KEY');
  }

  private get from(): string {
    return this.configService.get<string>(
      'MAIL_FROM',
      'myContrail <no-reply@mycontrail.com>',
    );
  }

  /** Base URL for links in emails, derived from the same DOMAIN nginx uses. */
  appUrl(): string {
    const domain = this.configService.get<string>('DOMAIN');
    return domain ? `https://${domain}` : 'http://localhost:5173';
  }

  async sendVerificationEmail(to: string, link: string): Promise<void> {
    await this.send(
      to,
      'Verify your email — myContrail',
      `<p>Welcome to myContrail!</p>
       <p>Confirm this is your email address to unlock sharing your map:</p>
       <p><a href="${link}">Verify my email</a></p>
       <p>The link works once and expires in 24 hours. If you didn't create
       this account, you can ignore this email.</p>`,
      `Welcome to myContrail!\n\nConfirm your email to unlock sharing your map:\n${link}\n\nThe link works once and expires in 24 hours. If you didn't create this account, ignore this email.`,
    );
  }

  async sendPasswordResetEmail(to: string, link: string): Promise<void> {
    await this.send(
      to,
      'Reset your password — myContrail',
      `<p>Someone asked to reset the password for this myContrail account.</p>
       <p><a href="${link}">Choose a new password</a></p>
       <p>The link works once and expires in 1 hour. If this wasn't you,
       ignore this email — your password is unchanged.</p>`,
      `Someone asked to reset the password for this myContrail account.\n\nChoose a new password:\n${link}\n\nThe link works once and expires in 1 hour. If this wasn't you, ignore this email — your password is unchanged.`,
    );
  }

  private async send(
    to: string,
    subject: string,
    html: string,
    text: string,
  ): Promise<void> {
    if (!this.apiKey) {
      this.logger.log(`[mail disabled] To: ${to} — ${subject}\n${text}`);
      return;
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: this.from, to, subject, html, text }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      // Thrown so callers decide: auth flows deliberately swallow-and-log,
      // because a mail outage must never fail a registration.
      throw new Error(`Resend responded ${res.status}: ${body}`);
    }
  }
}
