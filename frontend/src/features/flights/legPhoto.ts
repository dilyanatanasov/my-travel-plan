const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

/**
 * Authed photo URL - <img> sends same-origin cookies, so no client magic.
 * Shared by the stop chip, the map postcards and the travel book.
 */
export function legPhotoUrl(legId: number, cacheBust?: number): string {
  return `${API_BASE}/flights/legs/${legId}/photo${
    cacheBust ? `?v=${cacheBust}` : ''
  }`;
}
