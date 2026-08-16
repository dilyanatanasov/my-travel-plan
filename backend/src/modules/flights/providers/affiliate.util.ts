/**
 * Affiliate marker on booking deep links (plan M1). The Kiwi affiliate
 * program runs through Travelpayouts: kiwi.com URLs carry the marker as
 * `affilid`. No marker configured = links pass through untouched — the
 * search works identically, it just earns nothing.
 */
export function withAffiliate(
  url: string,
  marker: string | undefined,
): string {
  if (!marker || !url) return url;
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith('kiwi.com')) return url;
    parsed.searchParams.set('affilid', marker);
    return parsed.toString();
  } catch {
    // A malformed deep link is the provider's bug; never break the result.
    return url;
  }
}
