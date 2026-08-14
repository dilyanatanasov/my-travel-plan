import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from '@reduxjs/toolkit/query';
import { hasKnownAccount } from '../../features/auth/accountMemory';

const rawBaseQuery = fetchBaseQuery({
  // Relative by default: the dev server proxies /api to the backend, so the
  // app works from any host or device without an absolute URL baked into the
  // bundle. Override only when the API is genuinely on another origin.
  baseUrl: import.meta.env.VITE_API_URL || '/api',
  credentials: 'include',
});

/*
  One in-flight guest creation at a time.

  Several mutations can land together — tapping two countries quickly, or an
  import that fans out — and without this each 401 would mint its own account
  and the writes would scatter across them.
*/
let pendingGuest: Promise<boolean> | null = null;

async function ensureGuestSession(
  api: Parameters<BaseQueryFn>[1],
  extraOptions: Parameters<BaseQueryFn>[2],
): Promise<boolean> {
  pendingGuest ??= (async () => {
    const result = await rawBaseQuery(
      { url: '/auth/guest', method: 'POST' },
      api,
      extraOptions,
    );
    return !result.error;
  })().finally(() => {
    pendingGuest = null;
  });

  return pendingGuest;
}

/**
 * Wraps the base query with two behaviours.
 *
 * Session expiry: an unexpected 401 drops cached user data so RequireAuth can
 * react. `getAuthProfile` is excluded, because a 401 there is the expected
 * "logged out" answer rather than a session that just died.
 *
 * Lazy guest creation: an anonymous visitor gets no account until they
 * actually write something. Creating one on page load meant a row per bot and
 * per three-second bounce; creating one on the first write means the only
 * accounts that exist belong to people who did something worth keeping.
 *
 * Only mutations trigger it. A read that 401s has nothing to preserve, and
 * minting an account so someone can fetch an empty list is the very thing
 * this avoids.
 */
const baseQueryWithAuthHandling: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  let result = await rawBaseQuery(args, api, extraOptions);

  const isWrite = api.type === 'mutation';
  const isAuthCall =
    typeof args === 'object' && String(args.url ?? '').startsWith('/auth/');

  if (
    result.error?.status === 401 &&
    isWrite &&
    !isAuthCall &&
    // A device that has held an account should be asked to sign in, not
    // silently handed a brand new empty one.
    !hasKnownAccount()
  ) {
    const created = await ensureGuestSession(api, extraOptions);
    if (created) {
      result = await rawBaseQuery(args, api, extraOptions);
      // The session changed under the app; let anything auth-aware re-read it.
      api.dispatch(apiSlice.util.invalidateTags(['Auth']));
    }
  }

  /*
    Only treat a 401 as "the session died" on a device that has actually held
    an account. For an anonymous visitor a 401 is the normal answer, and
    invalidating Auth over it is a loop: the refetch of /auth/me 401s too, the
    re-render refires the data queries, and they 401 again. That did not bite
    while anonymous visitors were redirected to /login, because their queries
    never ran; now that they stay on the map, it spins forever.
  */
  if (
    result.error?.status === 401 &&
    api.endpoint !== 'getAuthProfile' &&
    hasKnownAccount()
  ) {
    api.dispatch(apiSlice.util.invalidateTags(['Auth']));
  }

  return result;
};

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithAuthHandling,
  tagTypes: [
    'Country',
    'Visit',
    'Airport',
    'Flight',
    'Duels',
    'FlightStats',
    'Auth',
    'Share',
    'LegPhoto',
    'Daily',
  ],
  endpoints: () => ({}),
});
