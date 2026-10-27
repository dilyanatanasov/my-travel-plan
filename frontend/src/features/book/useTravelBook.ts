import { useMemo } from 'react';
import { useGetFlightsQuery, useGetLegPhotoIdsQuery } from '../flights/flightsApi';
import { useGetCountriesQuery, useGetHomeCountryQuery } from '../visits/visitsApi';
import { useAuth } from '../auth/authApi';
import { buildBook, buildPages } from './buildBook';

/**
 * The owner's book. The only place in the feature that fetches: every
 * source is an existing, user-scoped endpoint, so the book adds no new
 * server surface. Page components get plain data from here.
 */
export function useTravelBook({ skip = false }: { skip?: boolean } = {}) {
  const { user } = useAuth();
  const flights = useGetFlightsQuery(undefined, { skip });
  const countries = useGetCountriesQuery(undefined, { skip });
  const photos = useGetLegPhotoIdsQuery(undefined, { skip });
  const home = useGetHomeCountryQuery(undefined, { skip });

  const book = useMemo(() => {
    if (!flights.data || !countries.data) return null;
    return buildBook({
      journeys: flights.data,
      countries: countries.data,
      photoLegIds: photos.data?.legIds ?? [],
      homeIso2: home.data?.country?.isoCode2 ?? null,
      ownerName: user?.displayName ?? null,
    });
  }, [flights.data, countries.data, photos.data, home.data, user?.displayName]);

  const pages = useMemo(() => (book ? buildPages(book) : []), [book]);

  return {
    book,
    pages,
    isLoading: flights.isLoading || countries.isLoading,
    isError: flights.isError || countries.isError,
  };
}
