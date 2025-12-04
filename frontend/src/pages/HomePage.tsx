import { useMemo, useCallback } from 'react';
import WorldMap from '../components/WorldMap';
import CountryList from '../components/CountryList';
import CountrySelector from '../components/CountrySelector';
import {
  useGetCountriesQuery,
  useGetVisitsQuery,
  useAddVisitMutation,
  useRemoveVisitMutation,
} from '../features/visits/visitsApi';

function HomePage() {
  const { data: countries = [] } = useGetCountriesQuery();
  const { data: visits = [], isLoading: visitsLoading } = useGetVisitsQuery();
  const [addVisit] = useAddVisitMutation();
  const [removeVisit] = useRemoveVisitMutation();

  const visitedIsoCodes = useMemo(() => {
    return new Set(visits.map((v) => v.country?.isoCode).filter(Boolean) as string[]);
  }, [visits]);

  const visitedCountryIds = useMemo(() => {
    return new Set(visits.map((v) => v.countryId));
  }, [visits]);

  const countryByIsoCode = useMemo(() => {
    const map = new Map<string, number>();
    countries.forEach((c) => {
      map.set(c.isoCode, c.id);
    });
    return map;
  }, [countries]);

  const visitByCountryId = useMemo(() => {
    const map = new Map<number, number>();
    visits.forEach((v) => {
      map.set(v.countryId, v.id);
    });
    return map;
  }, [visits]);

  const handleCountryClick = useCallback(
    async (isoCode: string, _countryName: string) => {
      const countryId = countryByIsoCode.get(isoCode);
      if (!countryId) {
        console.warn(`Country with ISO code ${isoCode} not found in database`);
        return;
      }

      const existingVisitId = visitByCountryId.get(countryId);
      if (existingVisitId) {
        await removeVisit(existingVisitId);
      } else {
        await addVisit({
          countryId,
          visitedAt: new Date().toISOString().split('T')[0],
        });
      }
    },
    [countryByIsoCode, visitByCountryId, addVisit, removeVisit]
  );

  const handleRemoveVisit = useCallback(
    async (visitId: number) => {
      await removeVisit(visitId);
    },
    [removeVisit]
  );

  const handleToggleCountry = useCallback(
    async (countryId: number, _countryName: string) => {
      const existingVisitId = visitByCountryId.get(countryId);
      if (existingVisitId) {
        await removeVisit(existingVisitId);
      } else {
        await addVisit({
          countryId,
          visitedAt: new Date().toISOString().split('T')[0],
        });
      }
    },
    [visitByCountryId, addVisit, removeVisit]
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Search for a country (useful for small countries like Malta, Vatican, etc.)
        </label>
        <CountrySelector
          countries={countries}
          visitedCountryIds={visitedCountryIds}
          onToggleCountry={handleToggleCountry}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <WorldMap
            visitedIsoCodes={visitedIsoCodes}
            onCountryClick={handleCountryClick}
          />
        </div>
        <div>
          <CountryList
            visits={visits}
            isLoading={visitsLoading}
            onRemove={handleRemoveVisit}
          />
        </div>
      </div>
    </div>
  );
}

export default HomePage;
