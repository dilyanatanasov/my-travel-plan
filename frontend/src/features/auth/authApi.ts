import { apiSlice } from '../../store/api/apiSlice';

export interface AuthUser {
  id: number;
  email: string;
  displayName: string | null;
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

    register: builder.mutation<RegisterResponse, RegisterRequest>({
      query: (body) => ({
        url: '/auth/register',
        method: 'POST',
        body,
      }),
      invalidatesTags: [...USER_DATA_TAGS],
    }),

    login: builder.mutation<{ user: AuthUser }, LoginRequest>({
      query: (body) => ({
        url: '/auth/login',
        method: 'POST',
        body,
      }),
      invalidatesTags: [...USER_DATA_TAGS],
    }),

    logout: builder.mutation<{ success: boolean }, void>({
      query: () => ({
        url: '/auth/logout',
        method: 'POST',
      }),
      invalidatesTags: [...USER_DATA_TAGS],
    }),
  }),
});

export const {
  useGetAuthProfileQuery,
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
    // Only the first resolution should block rendering; background refetches
    // must not flash the loading screen.
    isLoading: isLoading || (isFetching && data === undefined),
  };
}
