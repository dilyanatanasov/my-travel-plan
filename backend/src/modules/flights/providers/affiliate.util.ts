/**
 * Affiliate tagging for booking deep links (plan M1; format corrected
 * 2026-08-16 after the real Travelpayouts signup). Kiwi bookings credit
 * through the Travelpayouts CLICK REDIRECT — shmarker + promo_id 3791 +
 * the kiwi.com deep link in custom_url — not through a bare query param
 * on kiwi.com; the previously used `affilid` would never have tracked.
 * No marker configured = links pass through untouched: the search works
 * identically, it just earns nothing.
 */

/** Travelpayouts' program id for Kiwi.com custom links. */
const KIWI_PROMO_ID = '3791';

export function withAffiliate(
  url: string,
  marker: string | undefined,
): string {
  if (!marker || !url) return url;
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith('kiwi.com')) return url;
    const redirect = new URL('https://c111.travelpayouts.com/click');
    redirect.searchParams.set('shmarker', marker);
    redirect.searchParams.set('promo_id', KIWI_PROMO_ID);
    redirect.searchParams.set('source_type', 'customlink');
    redirect.searchParams.set('type', 'click');
    redirect.searchParams.set('custom_url', url);
    return redirect.toString();
  } catch {
    // A malformed deep link is the provider's bug; never break the result.
    return url;
  }
}
