import { apiSlice } from '../../store/api/apiSlice';
import type {
  Airport,
  FlightJourney,
  FlightStats,
  FlightSummary,
  CreateFlightDto,
  UpdateFlightDto,
} from '../../types';

export const flightsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Airport endpoints
    searchAirports: builder.query<Airport[], string>({
      query: (searchQuery) => `/airports?q=${encodeURIComponent(searchQuery)}`,
      providesTags: ['Airport'],
    }),

    getAirport: builder.query<Airport, number>({
      query: (id) => `/airports/${id}`,
      providesTags: ['Airport'],
    }),

    getAirportByIata: builder.query<Airport, string>({
      query: (code) => `/airports/iata/${code}`,
      providesTags: ['Airport'],
    }),

    // Flight endpoints
    getFlights: builder.query<FlightJourney[], void>({
      query: () => '/flights',
      providesTags: ['Flight'],
    }),

    getFlight: builder.query<FlightJourney, number>({
      query: (id) => `/flights/${id}`,
      providesTags: ['Flight'],
    }),

    // 'Visit' too: the backend auto-creates visits for the flight's
    // countries, so without it the map only colors them after a reload —
    // which read as "auto-visit doesn't exist" in user testing.
    addFlight: builder.mutation<FlightJourney, CreateFlightDto>({
      query: (body) => ({
        url: '/flights',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Flight', 'FlightStats', 'Visit'],
    }),

    updateFlight: builder.mutation<FlightJourney, { id: number; data: UpdateFlightDto }>({
      query: ({ id, data }) => ({
        url: `/flights/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: ['Flight', 'FlightStats', 'Visit'],
    }),

    importFlights: builder.mutation<
      ImportResult,
      { journeys: { date?: string; legs: { from: string; to: string }[]; notes?: string }[] }
    >({
      query: (body) => ({
        url: '/flights/import',
        method: 'POST',
        body,
      }),
      // An import creates journeys and, through them, country visits.
      invalidatesTags: ['Flight', 'FlightStats', 'Visit'],
    }),

    /**
     * Swap the replay order of two journeys. The server enforces the rule
     * the arrows encode: both undated, or the exact same stored date.
     */
    reorderFlights: builder.mutation<void, { aId: number; bId: number }>({
      query: (body) => ({
        url: '/flights/reorder',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Flight'],
    }),

    removeFlight: builder.mutation<void, number>({
      query: (id) => ({
        url: `/flights/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Flight', 'FlightStats'],
    }),

    /*
      Trip photos (2026-08-14): one per stop. The list feeds both the leg
      chips' camera state and the replay's postcard schedule; the image
      itself is fetched by <img src> — same-origin cookies ride along, so
      the authenticated stream needs no special client.
    */
    getLegPhotoIds: builder.query<{ legIds: number[] }, void>({
      query: () => '/flights/legs/photos',
      providesTags: ['LegPhoto'],
    }),

    uploadLegPhoto: builder.mutation<{ legId: number }, { legId: number; file: File }>({
      query: ({ legId, file }) => {
        const body = new FormData();
        body.append('photo', file);
        return { url: `/flights/legs/${legId}/photo`, method: 'POST', body };
      },
      invalidatesTags: ['LegPhoto'],
    }),

    deleteLegPhoto: builder.mutation<void, number>({
      query: (legId) => ({
        url: `/flights/legs/${legId}/photo`,
        method: 'DELETE',
      }),
      invalidatesTags: ['LegPhoto'],
    }),

    // Stats endpoint
    getFlightStats: builder.query<FlightStats, void>({
      query: () => '/flights/stats',
      providesTags: ['FlightStats'],
    }),

    // Cheap totals for the map's initial view — COUNT/SUM, no journey graph.
    getFlightSummary: builder.query<FlightSummary, void>({
      query: () => '/flights/summary',
      providesTags: ['FlightStats'],
    }),
  }),
});

export interface ImportResult {
  imported: number;
  skipped: number;
  failed: { row: number; route: string; reason: string }[];
}

export const {
  useSearchAirportsQuery,
  useLazySearchAirportsQuery,
  useGetAirportQuery,
  useGetAirportByIataQuery,
  useGetFlightsQuery,
  useGetFlightQuery,
  useAddFlightMutation,
  useUpdateFlightMutation,
  useImportFlightsMutation,
  useReorderFlightsMutation,
  useRemoveFlightMutation,
  useGetLegPhotoIdsQuery,
  useUploadLegPhotoMutation,
  useDeleteLegPhotoMutation,
  useGetFlightStatsQuery,
  useGetFlightSummaryQuery,
} = flightsApi;
