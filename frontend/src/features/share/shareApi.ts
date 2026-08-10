import { apiSlice } from '../../store/api/apiSlice';

export interface PublicAirport {
  iataCode: string;
  city: string | null;
  latitude: number;
  longitude: number;
}

export interface PublicRoute {
  from: PublicAirport;
  to: PublicAirport;
  count: number;
  distanceKm: number;
}

export interface PublicCountry {
  isoCode: string;
  isoCode2: string;
  name: string;
  visitType: 'trip' | 'transit' | 'home';
}

export interface PublicMap {
  displayName: string;
  countries: PublicCountry[];
  airports: PublicAirport[];
  routes: PublicRoute[];
  stats: {
    countriesVisited: number;
    transitCount: number;
    totalCountries: number;
    worldPercent: number;
    journeys: number;
    flights: number;
    distanceKm: number;
  };
}

export const shareApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getShareStatus: builder.query<{ shareToken: string | null }, void>({
      query: () => '/share/status',
      providesTags: ['Share'],
    }),

    enableShare: builder.mutation<{ shareToken: string }, void>({
      query: () => ({ url: '/share/enable', method: 'POST' }),
      invalidatesTags: ['Share'],
    }),

    disableShare: builder.mutation<{ shareToken: null }, void>({
      query: () => ({ url: '/share', method: 'DELETE' }),
      invalidatesTags: ['Share'],
    }),

    // Public: no session required, and served by a controller that builds its
    // own payload so private notes can never leak into it.
    getPublicMap: builder.query<PublicMap, string>({
      query: (token) => `/share/${token}`,
    }),
  }),
});

export const {
  useGetShareStatusQuery,
  useEnableShareMutation,
  useDisableShareMutation,
  useGetPublicMapQuery,
} = shareApi;
