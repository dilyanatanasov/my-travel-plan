import { apiSlice } from '../../store/api/apiSlice';
import type { DailyStats } from './dailyPuzzle';

/**
 * The puzzle's server half, for sessions that have one (guests included —
 * registering keeps the history). Anonymous players never call this; their
 * streaks stay in localStorage, which is the deal anonymity makes.
 */
export const dailyApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getDailyStats: builder.query<DailyStats, void>({
      query: () => '/daily/stats',
      providesTags: ['Daily'],
    }),

    postDailyResult: builder.mutation<
      DailyStats,
      { date: string; won: boolean; tries: number }
    >({
      query: (body) => ({
        url: '/daily/result',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Daily'],
    }),
  }),
});

export const { useGetDailyStatsQuery, usePostDailyResultMutation } = dailyApi;
