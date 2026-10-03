import { ConfigService } from '@nestjs/config';

/**
 * The public base URL of the app: where emailed links point and where
 * OAuth providers send people back. Derived from the same DOMAIN nginx
 * uses, so production needs no extra setting. APP_URL overrides it for a
 * dev stack on a non-default port.
 */
export function appUrl(config: ConfigService): string {
  const explicit = config.get<string>('APP_URL');
  if (explicit) return explicit.replace(/\/+$/, '');
  const domain = config.get<string>('DOMAIN');
  return domain ? `https://${domain}` : 'http://localhost:5173';
}
