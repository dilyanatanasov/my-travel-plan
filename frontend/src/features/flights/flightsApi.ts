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

    addFlight: builder.mutation<FlightJourney, CreateFlightDto>({
      query: (body) => ({
        url: '/flights',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Flight', 'FlightStats'],
    }),

    updateFlight: builder.mutation<FlightJourney, { id: number; data: UpdateFlightDto }>({
      query: ({ id, data }) => ({
        url: `/flights/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: ['Flight', 'FlightStats'],
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

    removeFlight: builder.mutation<void, number>({
      query: (id) => ({
        url: `/flights/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Flight', 'FlightStats'],
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
  useRemoveFlightMutation,
  useGetFlightStatsQuery,
  useGetFlightSummaryQuery,
} = flightsApi;
