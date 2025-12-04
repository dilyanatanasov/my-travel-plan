import { apiSlice } from '../../store/api/apiSlice';
import type { Country, Visit, CreateVisitDto } from '../../types';

export const visitsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getCountries: builder.query<Country[], void>({
      query: () => '/countries',
      providesTags: ['Country'],
    }),

    getVisits: builder.query<Visit[], void>({
      query: () => '/visits',
      providesTags: ['Visit'],
    }),

    addVisit: builder.mutation<Visit, CreateVisitDto>({
      query: (body) => ({
        url: '/visits',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Visit'],
    }),

    removeVisit: builder.mutation<void, number>({
      query: (id) => ({
        url: `/visits/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Visit'],
    }),
  }),
});

export const {
  useGetCountriesQuery,
  useGetVisitsQuery,
  useAddVisitMutation,
  useRemoveVisitMutation,
} = visitsApi;
