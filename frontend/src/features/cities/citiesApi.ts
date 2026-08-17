import { apiSlice } from '../../store/api/apiSlice';
import type { CityRef } from '../../types';

/**
 * City typeahead for land-travel endpoints (2026-08-17). Server-side
 * search: the GeoNames table holds ~130k rows, which do not belong in a
 * browser. Population does the ranking there, so "var" means Varna.
 */
export const citiesApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    searchCities: builder.query<CityRef[], string>({
      query: (q) => `/cities?q=${encodeURIComponent(q)}`,
    }),
  }),
});

export const { useLazySearchCitiesQuery, useSearchCitiesQuery } = citiesApi;
