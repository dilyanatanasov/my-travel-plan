import { apiSlice } from '../../store/api/apiSlice';
import type {
  SearchFlightsDto,
  FlightSearchResultDto,
  FlexibleSearchDto,
  FlightExplorationResultDto,
  SortOption,
} from '../../types';

interface SearchFlightsRequest {
  searchParams: SearchFlightsDto;
  sortBy?: SortOption;
}

export const flightSearchApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    searchFlights: builder.mutation<FlightSearchResultDto, SearchFlightsRequest>({
      query: ({ searchParams, sortBy }) => ({
        url: sortBy ? `/flights/search?sortBy=${sortBy}` : '/flights/search',
        method: 'POST',
        body: searchParams,
      }),
    }),
    exploreFlights: builder.mutation<FlightExplorationResultDto, FlexibleSearchDto>({
      query: (searchParams) => ({
        url: '/flights/explore',
        method: 'POST',
        body: searchParams,
      }),
    }),
  }),
});

export const { useSearchFlightsMutation, useExploreFlightsMutation } = flightSearchApi;
