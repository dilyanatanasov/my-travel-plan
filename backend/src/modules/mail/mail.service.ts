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
      'Verify your email - myContrail',
      this.branded({
        paragraphs: [
          'Welcome to myContrail!',
          'Confirm this is your email address to unlock sharing your map:',
        ],
        cta: { label: 'Verify my email', link },
        fineprint:
          "The link works once and expires in 24 hours. If you didn't create this account, you can ignore this email.",
      }),
      `Welcome to myContrail!\n\nConfirm your email to unlock sharing your map:\n${link}\n\nThe link works once and expires in 24 hours. If you didn't create this account, ignore this email.`,
    );
  }

  async sendPasswordResetEmail(to: string, link: string): Promise<void> {
    await this.send(
      to,
      'Reset your password - myContrail',
      this.branded({
        paragraphs: [
          'Someone asked to reset the password for this myContrail account.',
        ],
        cta: { label: 'Choose a new password', link },
        fineprint:
          "The link works once and expires in 1 hour. If this wasn't you, ignore this email - your password is unchanged.",
      }),
      `Someone asked to reset the password for this myContrail account.\n\nChoose a new password:\n${link}\n\nThe link works once and expires in 1 hour. If this wasn't you, ignore this email - your password is unchanged.`,
    );
  }

  /** Price-drop alert for a trip watch (search v2 M4). */
  async sendPriceAlertEmail(
    to: string,
    title: string,
    body: string,
  ): Promise<void> {
    const link = `${this.appUrl()}/search/trips`;
    await this.send(
      to,
      `${title} - myContrail`,
      this.branded({
        paragraphs: [title, body],
        cta: { label: 'See the dates', link },
        fineprint:
          'You get at most one alert per watch per day. Manage your watches on the trip search page.',
      }),
      `${title}\n\n${body}\n\n${link}\n\nYou get at most one alert per watch per day.`,
    );
  }

  /**
   * Shared branded shell: logo, two-tone wordmark, one CTA button.
   *
   * Table layout and inline styles on purpose - email clients ignore
   * stylesheets and most CSS layout. Colors are the app's own light-theme
   * tokens (brand-600 terracotta on cream canvas) so inbox and app feel
   * like one product. The plain-text part always carries the same link.
   */
  private branded(opts: {
    paragraphs: string[];
    cta: { label: string; link: string };
    fineprint: string;
  }): string {
    const app = this.appUrl();
    const body = opts.paragraphs
      .map(
        (p) =>
          `<p style="margin:0 0 12px;color:#262220;font-size:15px;line-height:1.6;">${p}</p>`,
      )
      .join('');
    return `
<div style="background:#f5ead8;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:440px;width:100%;background:#fffdf9;border-radius:16px;">
      <tr><td style="padding:32px 32px 20px;text-align:center;">
        <img src="${app}/icon-192.png" width="48" height="48" alt="myContrail" style="border-radius:12px;display:inline-block;">
        <p style="margin:12px 0 0;font-size:22px;font-family:Georgia,serif;">
          <span style="color:#9c5220;">my</span><span style="color:#262220;">Contrail</span>
        </p>
      </td></tr>
      <tr><td style="padding:0 32px 8px;">${body}</td></tr>
      <tr><td style="padding:12px 32px 32px;text-align:center;">
        <a href="${opts.cta.link}" style="display:inline-block;background:#9c5220;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:13px 28px;border-radius:12px;">${opts.cta.label}</a>
        <p style="margin:18px 0 0;font-size:12px;line-height:1.5;color:#8a7f72;">${opts.fineprint}</p>
      </td></tr>
    </table>
    <p style="margin:16px 0 0;font-size:12px;color:#8a7f72;">
      You leave a trail. See it. · <a href="${app}" style="color:#9c5220;">mycontrail.com</a>
    </p>
  </td></tr></table>
</div>`;
  }

  private async send(
    to: string,
    subject: string,
    html: string,
    text: string,
  ): Promise<void> {
    if (!this.apiKey) {
      this.logger.log(`[mail disabled] To: ${to} - ${subject}\n${text}`);
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
