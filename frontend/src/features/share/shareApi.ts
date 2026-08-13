import type { Alpha2, Alpha3 } from '../../types';
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
  // Same two conventions as everywhere else; see types/index.ts.
  isoCode: Alpha3;
  isoCode2: Alpha2;
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

    // The rendered card, sent as a raw PNG body so link previews for
    // /s/:token can show this user's actual map. The server replaces the
    // previous card — one per user, no history.
    uploadShareCard: builder.mutation<{ ok: true }, Blob>({
      query: (card) => ({
        url: '/share/card',
        method: 'POST',
        body: card,
        headers: { 'Content-Type': 'image/png' },
      }),
    }),

    // Public: no session required, and served by a controller that builds its
    // own payload so private notes can never leak into it.
    getPublicMap: builder.query<PublicMap, string>({
      query: (token) => `/share/${token}`,
    }),

    /* Two public maps in one payload — the duel. Public like the maps it
       composes; the page gates the juicy details, not the data. */
    getDuel: builder.query<
      {
        a: PublicMap & { token: string };
        b: PublicMap & { token: string };
      },
      { a: string; b: string }
    >({
      query: ({ a, b }) => `/share/duel/${a}/${b}`,
    }),

    getSavedDuels: builder.query<
      { token: string; displayName: string; countries: number }[],
      void
    >({
      query: () => '/share/duels',
      providesTags: ['Duels'],
    }),

    saveDuel: builder.mutation<{ ok: true }, string>({
      query: (token) => ({
        url: '/share/duels',
        method: 'POST',
        body: { token },
      }),
      invalidatesTags: ['Duels'],
    }),

    removeDuel: builder.mutation<{ ok: true }, string>({
      query: (token) => ({
        url: `/share/duels/${token}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Duels'],
    }),
  }),
});

export const {
  useGetShareStatusQuery,
  useEnableShareMutation,
  useDisableShareMutation,
  useUploadShareCardMutation,
  useGetPublicMapQuery,
  useGetDuelQuery,
  useGetSavedDuelsQuery,
  useSaveDuelMutation,
  useRemoveDuelMutation,
} = shareApi;
