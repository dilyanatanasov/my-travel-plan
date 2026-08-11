import { useState, useMemo, useCallback } from 'react';
import TravelMap from '../components/TravelMap';
import FlightForm from '../components/FlightForm';
import ImportFlights from '../components/FlightForm/ImportFlights';
import FlightList from '../components/FlightList';
import FlightStats from '../components/FlightStats';
import CountryList from '../components/CountryList';
import CountrySelector from '../components/CountrySelector';
import SectionRail from '../components/AppShell/SectionRail';
import MobileTabBar from '../components/AppShell/MobileTabBar';
import SectionPanel from '../components/AppShell/SectionPanel';
import OverviewPanel from '../components/AppShell/OverviewPanel';
import MapPeekBar from '../components/AppShell/MapPeekBar';
import { useGetFlightStatsQuery } from '../features/flights/flightsApi';
import { getSection, type SectionId } from '../components/AppShell/sections';
import {
  useGetCountriesQuery,
  useGetVisitsQuery,
  useUpdateVisitMutation,
} from '../features/visits/visitsApi';
import { useVisitActions } from '../features/visits/useVisitActions';
import { useToast } from '../components/Toast/ToastProvider';
import { useIsDesktop } from '../hooks/useMediaQuery';
import { MapFocusProvider } from '../features/map/MapFocusContext';
import type { VisitType, Visit } from '../types';


function TravelMapPage() {
  // Null means "no panel" — the map gets the whole canvas. Countries opens by
  // default on desktop because it is the primary action; mobile starts closed
  // so the first thing you see is your map.
  const [activeSection, setActiveSection] = useState<SectionId | null>(null);
  const isDesktop = useIsDesktop();

  const { data: countries = [] } = useGetCountriesQuery();
  const { data: visits = [], isLoading: visitsLoading } = useGetVisitsQuery();
  const { data: flightStats } = useGetFlightStatsQuery();
  const [updateVisit] = useUpdateVisitMutation();
  const { addVisitForCountry, removeVisitWithUndo } = useVisitActions();
  const { showToast } = useToast();

  const visitedCountryIds = useMemo(
    () => new Set(visits.map((v) => v.countryId)),
    [visits]
  );

  const visitByCountryId = useMemo(() => {
    const map = new Map<number, Visit>();
    visits.forEach((v) => map.set(v.countryId, v));
    return map;
  }, [visits]);

  const handleToggleCountry = useCallback(
    async (countryId: number) => {
      const existingVisit = visitByCountryId.get(countryId);
      if (existingVisit) await removeVisitWithUndo(existingVisit);
      else await addVisitForCountry(countryId);
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

  const overviewStats = useMemo(() => {
    const tripCount = visits.filter((v) => {
      const type = v.visitType || 'trip';
      return type === 'trip' || type === 'home';
    }).length;
    const homeCountry = visits.find((v) => v.visitType === 'home');
    return {
      tripCount,
      transitCount: visits.filter((v) => v.visitType === 'transit').length,
      worldPercent:
        countries.length > 0
          ? Math.round((tripCount / countries.length) * 1000) / 10
          : 0,
      totalCountries: countries.length,
      homeCountry: homeCountry?.country?.name || 'Not set',
    };
  }, [visits, countries]);

  // Selecting the active section again closes it, so the map can be cleared
  // without hunting for a close button.
  const handleSelectSection = useCallback((id: SectionId) => {
    setActiveSection((current) => (current === id ? null : id));
  }, []);

  const section = activeSection ? getSection(activeSection) : null;
  const isFullView = Boolean(section?.fullView);

  const panelContent = (() => {
    switch (activeSection) {
      case 'overview':
        return (
          <OverviewPanel
            tripCount={overviewStats.tripCount}
            transitCount={overviewStats.transitCount}
            worldPercent={overviewStats.worldPercent}
            totalCountries={overviewStats.totalCountries}
            homeCountry={overviewStats.homeCountry}
          />
        );

      case 'countries':
        return (
          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-medium text-ink mb-2">Add a country</h3>
              <CountrySelector
                countries={countries}
                visitedCountryIds={visitedCountryIds}
                onToggleCountry={handleToggleCountry}
              />
            </div>
            <CountryList
              visits={visits}
              isLoading={visitsLoading}
              onRemove={handleRemoveVisit}
              onUpdateVisitType={handleUpdateVisitType}
            />
          </div>
        );

      case 'flights':
        return (
          <div className="space-y-6">
            <FlightForm />
            <ImportFlights />
            <FlightList />
          </div>
        );

      default:
        return null;
    }
  })();

  const sectionBody = isFullView ? <FlightStats /> : panelContent;

  // On a phone a section takes the whole screen. A half-height sheet left the
  // forms cramped and the map above it largely covered by the filter card
  // anyway, so the map was paying rent it could not afford.
  const showMobileFullSection = !isDesktop && section !== null;

  return (
    // Closing the section on focus is what puts the map on screen in time to
    // watch the new route fly.
    <MapFocusProvider onFocus={() => setActiveSection(null)}>
    <div className="h-full flex">
      <SectionRail
        activeSection={activeSection}
        onSelect={handleSelectSection}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex-1 min-h-0 flex">
          <div className="flex-1 min-w-0 relative">
            {showMobileFullSection || isFullView ? (
              // Keyed so switching section starts at the top rather than
              // inheriting the previous section's scroll offset.
              <div
                key={activeSection}
                className="absolute inset-0 overflow-y-auto overscroll-contain bg-canvas"
              >
                <div className="max-w-5xl mx-auto p-4 sm:p-6">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <h2 className="font-display font-normal text-2xl text-ink">
                      {section?.label}
                    </h2>
                    <button
                      type="button"
                      onClick={() => setActiveSection(null)}
                      className="flex-shrink-0 min-h-11 px-3 rounded-lg text-sm font-medium text-brand-700 hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      Back to map
                    </button>
                  </div>
                  {sectionBody}
                </div>
              </div>
            ) : (
              <>
                <TravelMap />
                <MapPeekBar
                  countriesVisited={overviewStats.tripCount}
                  worldPercent={overviewStats.worldPercent}
                  flights={flightStats?.totalFlights ?? 0}
                  onOpenOverview={() => setActiveSection('overview')}
                />
              </>
            )}
          </div>

          {/* Desktop keeps the map visible with the section docked beside it. */}
          {isDesktop && section && !isFullView && (
            <SectionPanel
              variant="dock"
              title={section.label}
              isOpen
              onClose={() => setActiveSection(null)}
            >
              {panelContent}
            </SectionPanel>
          )}
        </div>

        <MobileTabBar
          activeSection={activeSection}
          onSelect={handleSelectSection}
        />
      </div>
    </div>
    </MapFocusProvider>
  );
}

export default TravelMapPage;
