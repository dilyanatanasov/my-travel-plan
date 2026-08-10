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
  useUpdateVisitMutation,
} from '../features/visits/visitsApi';
import { useVisitActions } from '../features/visits/useVisitActions';
import { useToast } from '../components/Toast/ToastProvider';
import type { VisitType, Visit } from '../types';

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
  const [updateVisit] = useUpdateVisitMutation();
  const { addVisitForCountry, removeVisitWithUndo } = useVisitActions();
  const { showToast } = useToast();

  const visitedCountryIds = useMemo(() => {
    return new Set(visits.map((v) => v.countryId));
  }, [visits]);

  // Full record, not just the id, so a removal can be undone with its date,
  // notes and visit type intact.
  const visitByCountryId = useMemo(() => {
    const map = new Map<number, Visit>();
    visits.forEach((v) => {
      map.set(v.countryId, v);
    });
    return map;
  }, [visits]);

  const handleToggleCountry = useCallback(
    async (countryId: number) => {
      const existingVisit = visitByCountryId.get(countryId);
      if (existingVisit) {
        await removeVisitWithUndo(existingVisit);
      } else {
        await addVisitForCountry(countryId);
      }
    },
    [visitByCountryId, addVisitForCountry, removeVisitWithUndo]
  );

  const handleRemoveVisit = useCallback(
    async (visit: Visit) => {
      await removeVisitWithUndo(visit);
    },
    [removeVisitWithUndo]
  );

  const handleUpdateVisitType = useCallback(
    async (visitId: number, visitType: VisitType) => {
      try {
        await updateVisit({ id: visitId, data: { visitType } }).unwrap();
      } catch {
        showToast('Could not update that country', { tone: 'error' });
      }
    },
    [updateVisit, showToast]
  );

  // Stats for overview - handle undefined visitType for existing records
  const overviewStats = useMemo(() => {
    const tripCount = visits.filter((v) => {
      const type = v.visitType || 'trip'; // default to 'trip' for old records
      return type === 'trip' || type === 'home';
    }).length;
    const transitCount = visits.filter((v) => v.visitType === 'transit').length;
    const homeCountry = visits.find((v) => v.visitType === 'home');

    // Share of the world visited — more useful than the old "Total Countries"
    // card, which just repeated the Countries Visited number.
    const worldPercent =
      countries.length > 0
        ? Math.round((tripCount / countries.length) * 1000) / 10
        : 0;

    return {
      tripCount,
      transitCount,
      worldPercent,
      totalCountries: countries.length,
      homeCountry: homeCountry?.country?.name || 'Not set',
    };
  }, [visits, countries]);

  return (
    <div className="min-h-screen bg-canvas">
      {/* No page header here: the app header already says "Travel Tracker /
          Track your journeys around the world". Two headings stacked cost
          ~150px of a phone screen to say the same thing twice. */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Map */}
        <div className="mb-4 sm:mb-8">
          <TravelMap />
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-md">
          {/* Tab Navigation — scrolls horizontally rather than overflowing the
              page, which is what pushed the document to 426px at a 390px width. */}
          <div className="border-b border-gray-200">
            <nav
              className="flex -mb-px overflow-x-auto snap-x scrollbar-none"
              aria-label="Travel data sections"
            >
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  aria-current={activeTab === tab.id ? 'page' : undefined}
                  className={`snap-start whitespace-nowrap min-h-12 px-4 sm:px-6 py-3 text-sm font-medium border-b-2 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-500 ${
                    activeTab === tab.id
                      ? 'border-brand-500 text-brand-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-4 sm:p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-gray-900">
                  Travel Overview
                </h2>
                {/*
                  These four cards describe map categories, so each carries the
                  same colour its countries have on the map — the card teaches
                  the legend. Hue is reserved for map semantics; the app's own
                  accent (brand) is used only for the one card that is not a
                  map category.
                */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                  <div className="bg-map-visited/10 rounded-lg p-4">
                    <div className="text-2xl font-bold text-map-visited">
                      {overviewStats.tripCount}
                    </div>
                    <div className="text-sm text-ink-muted">
                      Countries visited
                    </div>
                  </div>
                  <div className="bg-map-transit/15 rounded-lg p-4">
                    <div className="text-2xl font-bold text-amber-600">
                      {overviewStats.transitCount}
                    </div>
                    <div className="text-sm text-ink-muted">
                      Transit countries
                    </div>
                  </div>
                  <div className="bg-brand-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-brand-700">
                      {overviewStats.worldPercent}%
                    </div>
                    <div className="text-sm text-ink-muted">
                      Of the world{' '}
                      <span className="text-ink-subtle">
                        ({overviewStats.tripCount}/{overviewStats.totalCountries})
                      </span>
                    </div>
                  </div>
                  <div className="bg-map-home/10 rounded-lg p-4">
                    <div className="text-lg font-bold text-map-home truncate">
                      {overviewStats.homeCountry}
                    </div>
                    <div className="text-sm text-ink-muted">Home country</div>
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
