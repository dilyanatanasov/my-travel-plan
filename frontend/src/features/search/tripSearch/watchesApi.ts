import { apiSlice } from '../../../store/api/apiSlice';

export interface TripWatch {
  id: number;
  origin: string;
  destination: string;
  month: string;
  minNights: number | null;
  maxNights: number | null;
  thresholdPrice: number | null;
  lastNotifiedPrice: number | null;
  active: boolean;
}

export const watchesApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getWatches: builder.query<TripWatch[], void>({
      query: () => '/flights/watches',
      providesTags: ['Watch'],
    }),

    createWatch: builder.mutation<
      TripWatch,
      {
        origin: string;
        destination: string;
        month: string;
        minNights?: number;
        maxNights?: number;
        thresholdPrice?: number;
      }
    >({
      query: (body) => ({
        url: '/flights/watches',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Watch'],
    }),

    removeWatch: builder.mutation<void, number>({
      query: (id) => ({
        url: `/flights/watches/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Watch'],
    }),
  }),
});

export const {
  useGetWatchesQuery,
  useCreateWatchMutation,
  useRemoveWatchMutation,
} = watchesApi;
