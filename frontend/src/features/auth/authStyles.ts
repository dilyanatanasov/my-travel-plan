/**
 * Shared form classes for the auth screens.
 *
 * Inputs are min-h-11 (44px) so they meet the touch-target guidance the rest
 * of the app currently fails — see the mobile pass (roadmap item 2).
 */
export const inputClass =
  'w-full min-h-11 px-3 py-2 border border-gray-300 rounded-lg text-base ' +
  'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent ' +
  'disabled:bg-gray-100 disabled:cursor-not-allowed';

export const inputErrorClass =
  'border-red-400 focus:ring-red-500';

export const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

export const submitClass =
  'w-full min-h-11 py-2.5 px-4 rounded-lg text-white font-medium bg-brand-600 ' +
  'hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 ' +
  'focus:ring-offset-2 transition-colors disabled:bg-gray-400 ' +
  'disabled:cursor-not-allowed';

export const fieldErrorClass = 'mt-1 text-sm text-red-600';

/** Pull a usable message out of an RTK Query error shape. */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  const data = (error as { data?: { message?: string | string[] } })?.data;
  const message = data?.message;
  if (Array.isArray(message)) return message[0] ?? fallback;
  if (typeof message === 'string') return message;
  if ((error as { status?: unknown })?.status === 'FETCH_ERROR') {
    return 'Could not reach the server. Is the backend running?';
  }
  return fallback;
}
