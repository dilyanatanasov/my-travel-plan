/**
 * Analytics facade over self-hosted Umami.
 *
 * Two hard rules from the observability plan (2026-08-12):
 *
 * 1. NO TRAVEL DATA leaves the app. Events carry section ids, durations,
 *    kinds and counts — never a country name, airport code, journey date or
 *    anything derived from them. The product is a private map of someone's
 *    life; instrumenting it must not quietly turn it into a dataset.
 *
 * 2. Everything routes through this one file, and it no-ops when the env is
 *    unset — local development and tests produce zero traffic, and swapping
 *    vendors later touches only this module.
 */

const UMAMI_URL = import.meta.env.VITE_UMAMI_URL as string | undefined;
const WEBSITE_ID = import.meta.env.VITE_UMAMI_WEBSITE_ID as string | undefined;

const enabled = Boolean(UMAMI_URL && WEBSITE_ID);

type EventProps = Record<string, string | number | boolean>;

interface UmamiGlobal {
  umami?: { track?: (event: string, props?: EventProps) => void };
}

/**
 * Inject the tracker script. VITE_UMAMI_URL is a path (/umami) in the
 * intended deployment — nginx proxies only script.js and api/send from it —
 * so the host-url is made absolute here; a full URL also works for a future
 * split-origin setup.
 */
export function initAnalytics(): void {
  if (!enabled || document.getElementById('umami-tracker')) return;

  const hostUrl = UMAMI_URL!.startsWith('http')
    ? UMAMI_URL!
    : window.location.origin + UMAMI_URL!;

  const script = document.createElement('script');
  script.id = 'umami-tracker';
  script.defer = true;
  script.src = `${hostUrl}/script.js`;
  script.setAttribute('data-website-id', WEBSITE_ID!);
  // Without this the tracker would post to the script's origin root, which
  // nginx does not proxy — collect must go to <hostUrl>/api/send.
  script.setAttribute('data-host-url', hostUrl);
  document.head.appendChild(script);
}

/** Fire-and-forget; silently does nothing when analytics is off or blocked. */
export function track(event: string, props?: EventProps): void {
  if (!enabled) return;
  (window as UmamiGlobal).umami?.track?.(event, props);
}
