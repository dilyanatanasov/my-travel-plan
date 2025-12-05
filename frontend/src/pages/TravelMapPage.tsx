import { useState, useMemo, useCallback } from 'react';
import TravelMap from '../components/TravelMap';
import FlightForm from '../components/FlightForm';
import FlightList from '../components/FlightList';
import FlightStats from '../components/FlightStats';
import CountryList from '../components/CountryList';
import CountrySelector from '../components/CountrySelector';
import {
  useGetCountriesQuery,
  useGetVisitsQuery,
  useAddVisitMutation,
  useRemoveVisitMutation,
  useUpdateVisitMutation,
} from '../features/visits/visitsApi';
import type { VisitType } from '../types';

type TabId = 'overview' | 'countries' | 'flights' | 'stats';

interface Tab {
  id: TabId;
  label: string;
}

const TABS: Tab[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'countries', label: 'Countries' },
  { id: 'flights', label: 'Flights' },
  { id: 'stats', label: 'Statistics' },
];

function TravelMapPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const { data: countries = [] } = useGetCountriesQuery();
  const { data: visits = [], isLoading: visitsLoading } = useGetVisitsQuery();
  const [addVisit] = useAddVisitMutation();
  const [removeVisit] = useRemoveVisitMutation();
  const [updateVisit] = useUpdateVisitMutation();

  const visitedCountryIds = useMemo(() => {
    return new Set(visits.map((v) => v.countryId));
  }, [visits]);

  const visitByCountryId = useMemo(() => {
    const map = new Map<number, number>();
    visits.forEach((v) => {
      map.set(v.countryId, v.id);
    });
    return map;
  }, [visits]);

  const handleToggleCountry = useCallback(
    async (countryId: number) => {
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

  const handleRemoveVisit = useCallback(
    async (visitId: number) => {
      await removeVisit(visitId);
    },
    [removeVisit]
  );

  const handleUpdateVisitType = useCallback(
    async (visitId: number, visitType: VisitType) => {
      await updateVisit({ id: visitId, data: { visitType } });
    },
    [updateVisit]
  );

  // Stats for overview - handle undefined visitType for existing records
  const overviewStats = useMemo(() => {
    const tripCount = visits.filter((v) => {
      const type = v.visitType || 'trip'; // default to 'trip' for old records
      return type === 'trip' || type === 'home';
    }).length;
    const transitCount = visits.filter((v) => v.visitType === 'transit').length;
    const homeCountry = visits.find((v) => v.visitType === 'home');

    return {
      tripCount,
      transitCount,
      totalVisits: visits.length,
      homeCountry: homeCountry?.country?.name || 'Not set',
    };
  }, [visits]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Travel Map</h1>
          <p className="text-gray-500">
            Track your countries, flights, and adventures around the world
          </p>
        </div>

        {/* Map */}
        <div className="mb-8">
          <TravelMap />
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-md">
          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-gray-900">
                  Travel Overview
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-green-600">
                      {overviewStats.tripCount}
                    </div>
                    <div className="text-sm text-green-700">
                      Countries Visited
                    </div>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-orange-600">
                      {overviewStats.transitCount}
                    </div>
                    <div className="text-sm text-orange-700">
                      Transit Countries
                    </div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-blue-600">
                      {overviewStats.totalVisits}
                    </div>
                    <div className="text-sm text-blue-700">Total Countries</div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4">
                    <div className="text-lg font-bold text-purple-600 truncate">
                      {overviewStats.homeCountry}
                    </div>
                    <div className="text-sm text-purple-700">Home Country</div>
                  </div>
                </div>

                <div className="text-sm text-gray-500">
                  Click on countries in the map to toggle visited status. Use
                  the controls above the map to show/hide layers and set your
                  home country.
                </div>
              </div>
            )}

            {activeTab === 'countries' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Add Country
                  </h3>
                  <CountrySelector
                    countries={countries}
                    visitedCountryIds={visitedCountryIds}
                    onToggleCountry={handleToggleCountry}
                  />
                </div>
                <div>
                  <CountryList
                    visits={visits}
                    isLoading={visitsLoading}
                    onRemove={handleRemoveVisit}
                    onUpdateVisitType={handleUpdateVisitType}
                  />
                </div>
              </div>
            )}

            {activeTab === 'flights' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <FlightForm />
                </div>
                <div>
                  <FlightList />
                </div>
              </div>
            )}

            {activeTab === 'stats' && <FlightStats />}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TravelMapPage;
