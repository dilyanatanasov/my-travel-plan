import { apiSlice } from '../../store/api/apiSlice';
import { rememberAccount } from './accountMemory';

// Re-exported so existing callers keep their import path.
export { hasKnownAccount, rememberAccount, forgetAccount } from './accountMemory';

export interface AuthUser {
  id: number;
  /** Null for a guest session, which has no credentials. */
  email: string | null;
  displayName: string | null;
  /** True until the account is claimed with an email and password. */
  isGuest: boolean;
  createdAt: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  displayName?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterResponse {
  user: AuthUser;
  /** Present when this account adopted pre-existing data (first account only). */
  claimed?: { visits: number; flightJourneys: number };
}

// Logging in or out changes whose data we should be showing, so every
// user-scoped tag is invalidated alongside Auth.
const USER_DATA_TAGS = ['Auth', 'Visit', 'Flight', 'FlightStats'] as const;

export const authApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getAuthProfile: builder.query<{ user: AuthUser }, void>({
      query: () => '/auth/me',
      providesTags: ['Auth'],
    }),

    /*
      Start using the app without an account. The server creates a real (but
      anonymous) user row, so every scoped query works untouched and signing
      up later upgrades this same row rather than migrating data between two.
    */
    createGuest: builder.mutation<{ user: AuthUser }, void>({
      query: () => ({
        url: '/auth/guest',
        method: 'POST',
      }),
      invalidatesTags: [...USER_DATA_TAGS],
    }),

    register: builder.mutation<RegisterResponse, RegisterRequest>({
      query: (body) => ({
        url: '/auth/register',
        method: 'POST',
        body,
      }),
      invalidatesTags: [...USER_DATA_TAGS],
      // Recorded here rather than in the page so no future caller can forget
      // it and leave a returning user exposed to the empty-guest-map trap.
      async onQueryStarted(_arg, { queryFulfilled }) {
        await queryFulfilled;
        rememberAccount();
      },
    }),

    login: builder.mutation<{ user: AuthUser }, LoginRequest>({
      query: (body) => ({
        url: '/auth/login',
        method: 'POST',
        body,
      }),
      invalidatesTags: [...USER_DATA_TAGS],
      async onQueryStarted(_arg, { queryFulfilled }) {
        await queryFulfilled;
        rememberAccount();
      },
    }),

    logout: builder.mutation<{ success: boolean }, void>({
      query: () => ({
        url: '/auth/logout',
        method: 'POST',
      }),
      invalidatesTags: [...USER_DATA_TAGS],
      // Note: signing out does NOT clear the account-known flag. It is a
      // property of the device ("an account exists somewhere"), not of the
      // session, and clearing it would send someone who just signed out into
      // a brand new guest map. Only abandoning a guest session clears it.
    }),
  }),
});

export const {
  useGetAuthProfileQuery,
  useCreateGuestMutation,
  useRegisterMutation,
  useLoginMutation,
  useLogoutMutation,
} = authApi;

/**
 * Single source of truth for auth state, derived from the /auth/me query
 * rather than a parallel Redux slice that could drift out of sync.
 */
export function useAuth() {
  const { data, isLoading, isError } = useGetAuthProfileQuery();
  return {
    user: data?.user ?? null,
    isAuthenticated: Boolean(data?.user) && !isError,
    /*
      "Has no real account" — true for an anonymous visitor with no session
      at all as well as for a guest session. Both need the same treatment:
      the save-your-map prompt, and no access to sharing. Since guest rows are
      now created lazily on first write, the no-session case is the common
      one and must not be treated as "signed in".
    */
    isGuest: !data?.user || Boolean(data.user.isGuest),
    // Only the first resolution should block rendering; background refetches
    // must not flash the loading screen.
    /*
      RTK's own isLoading, and nothing else: it means "first load, no data
      yet" and is already false for background refetches.

      This used to be OR'd with `isFetching && data === undefined` to avoid a
      flash. For a signed-in user that clause was harmless, because data
      arrives once and stays. For an anonymous visitor /auth/me never
      succeeds, so data is permanently undefined and the clause was
      permanently true — the app pinned itself to the loading screen and
      hammered the API. It only surfaced once anonymous visitors stopped
      being redirected to /login.
    */
    isLoading,
  };
}
