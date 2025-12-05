import { apiSlice } from '../../store/api/apiSlice';
import type { Country, Visit, CreateVisitDto, UpdateVisitDto } from '../../types';

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

    getHomeCountry: builder.query<Visit | null, void>({
      query: () => '/visits/home',
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

    updateVisit: builder.mutation<Visit, { id: number; data: UpdateVisitDto }>({
      query: ({ id, data }) => ({
        url: `/visits/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: ['Visit'],
    }),

    setHomeCountry: builder.mutation<Visit, number>({
      query: (countryId) => ({
        url: `/visits/home/${countryId}`,
        method: 'POST',
      }),
      invalidatesTags: ['Visit'],
      async onQueryStarted(countryId, { dispatch, queryFulfilled, getState }) {
        // Get countries for creating placeholder visit
        const state = getState() as { api: { queries: Record<string, { data?: Country[] }> } };
        const countriesQuery = Object.entries(state.api.queries).find(
          ([key]) => key.startsWith('getCountries')
        );
        const countries = countriesQuery?.[1]?.data || [];
        const country = countries.find((c) => c.id === countryId);

        // Optimistically update the visits cache
        const patchResult = dispatch(
          visitsApi.util.updateQueryData('getVisits', undefined, (draft) => {
            // Remove 'home' from any existing home country
            const existingHome = draft.find((v) => v.visitType === 'home');
            if (existingHome) {
              existingHome.visitType = 'trip';
            }
            // Set new home country or create placeholder
            const targetVisit = draft.find((v) => v.countryId === countryId);
            if (targetVisit) {
              targetVisit.visitType = 'home';
            } else if (country) {
              // Create placeholder visit (will be replaced by server response)
              draft.push({
                id: -Date.now(), // Temporary negative ID
                countryId,
                country,
                visitedAt: null,
                notes: null,
                visitType: 'home',
                source: 'manual',
                flightJourneyId: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
            }
          })
        );
        try {
          await queryFulfilled;
        } catch {
          // Revert on error
          patchResult.undo();
        }
      },
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
  useGetHomeCountryQuery,
  useAddVisitMutation,
  useUpdateVisitMutation,
  useSetHomeCountryMutation,
  useRemoveVisitMutation,
} = visitsApi;
