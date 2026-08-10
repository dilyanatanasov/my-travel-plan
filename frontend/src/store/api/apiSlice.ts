import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from '@reduxjs/toolkit/query';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  // Required for the httpOnly auth cookie to be sent cross-origin
  // (the dev frontend is :5173, the API is :3000).
  credentials: 'include',
});

/**
 * Wraps the base query so an expired or missing session is handled in one
 * place: drop cached user data and let RequireAuth redirect to /login.
 *
 * `getAuthProfile` is excluded because a 401 there is the expected "logged
 * out" answer, not a session that just died.
 */
const baseQueryWithAuthHandling: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  const result = await rawBaseQuery(args, api, extraOptions);

  if (result.error?.status === 401 && api.endpoint !== 'getAuthProfile') {
    api.dispatch(apiSlice.util.invalidateTags(['Auth']));
  }

  return result;
};

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithAuthHandling,
  tagTypes: ['Country', 'Visit', 'Airport', 'Flight', 'FlightStats', 'Auth'],
  endpoints: () => ({}),
});
