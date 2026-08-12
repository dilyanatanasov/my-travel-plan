/*
  Booking handoff. Contrail does not sell tickets; it hands the search to
  Aviasales/Kiwi with our affiliate marker attached (D1). The marker arrives
  only after the Travelpayouts account exists, which is deliberately queued
  behind deployment — so until then links work unmarked.
*/

/**
 * Travelpayouts partner marker. Empty until the account exists (see
 * "Blocked on the user" in COORDINATION.md); links function without it,
 * they just do not earn.
 */
const AFFILIATE_MARKER = '';

/**
 * Aviasales search deep link: {origin}{DDMM}{destination} plus passenger
 * count. One-way, matching what a month-matrix price actually is.
 */
export function buildDeepLink(origin: string, destination: string, departDate: string): string {
  const [, month, day] = departDate.split('-');
  const url = `https://www.aviasales.com/search/${origin}${day}${month}${destination}1`;
  return AFFILIATE_MARKER ? `${url}?marker=${AFFILIATE_MARKER}` : url;
}

/**
 * D1's whole point: this decision gets revisited on click data or not at
 * all. Until the backend endpoint exists (v2), clicks accumulate in
 * localStorage so a review session can still read a real number.
 */
export function trackOutboundClick(destinationIata: string, price: number): void {
  try {
    const key = 'contrail.search.outbound-clicks';
    const log: { iata: string; price: number; at: string }[] = JSON.parse(
      localStorage.getItem(key) ?? '[]',
    );
    log.push({ iata: destinationIata, price, at: new Date().toISOString() });
    localStorage.setItem(key, JSON.stringify(log.slice(-200)));
  } catch {
    // Storage full or blocked — losing a click beats breaking the handoff.
  }
}
