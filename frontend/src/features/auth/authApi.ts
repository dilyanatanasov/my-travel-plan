import { apiSlice } from '../../store/api/apiSlice';

export interface AuthUser {
  id: number;
  /** Null for a guest session, which has no credentials. */
  email: string | null;
  displayName: string | null;
  /** True until the account is claimed with an email and password. */
  isGuest: boolean;
  createdAt: string;
}

/*
  Remembers that this device has signed in at least once.

  Without it, an expired session on a returning user's device would be
  indistinguishable from a first visit, and RequireAuth would silently hand
  them a fresh empty guest map — which looks exactly like their travel history
  being deleted. Knowing an account exists, we send them to /login instead.
*/
const ACCOUNT_KNOWN_KEY = 'contrail-account-known';

export function hasKnownAccount(): boolean {
  try {
    return localStorage.getItem(ACCOUNT_KNOWN_KEY) === '1';
  } catch {
    // Private mode or blocked storage: fall back to guest, never to a
    // redirect loop.
    return false;
  }
}

export function rememberAccount(): void {
  try {
    localStorage.setItem(ACCOUNT_KNOWN_KEY, '1');
  } catch {
    /* non-fatal */
  }
}

export function forgetAccount(): void {
  try {
    localStorage.removeItem(ACCOUNT_KNOWN_KEY);
  } catch {
    /* non-fatal */
  }
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
  const { data, isLoading, isFetching, isError } = useGetAuthProfileQuery();
  return {
    user: data?.user ?? null,
    isAuthenticated: Boolean(data?.user) && !isError,
    /** Signed in, but anonymously — their data is not recoverable yet. */
    isGuest: Boolean(data?.user?.isGuest),
    // Only the first resolution should block rendering; background refetches
    // must not flash the loading screen.
    isLoading: isLoading || (isFetching && data === undefined),
  };
}
