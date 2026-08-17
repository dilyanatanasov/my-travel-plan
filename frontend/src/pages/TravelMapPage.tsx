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
import SharePanel from '../features/share/SharePanel';
import MapPeekBar from '../components/AppShell/MapPeekBar';
import MapTour from '../components/TravelMap/MapTour';
import { useGetFlightSummaryQuery } from '../features/flights/flightsApi';
import { useMilestones } from '../features/milestones/useMilestones';
import { useDailyNudge } from '../features/daily/useDailyNudge';
import { continentProgress } from '../features/stats/continentProgress';
import { getSection, type SectionId } from '../components/AppShell/sections';
import {
  useGetCountriesQuery,
  useGetVisitsQuery,
  useUpdateVisitMutation,
} from '../features/visits/visitsApi';
import { useVisitActions } from '../features/visits/useVisitActions';
import { useToast } from '../components/Toast/ToastProvider';
import { track } from '../lib/analytics';
import { useSectionDwell } from '../lib/useSectionDwell';
import { useIsDesktop } from '../hooks/useMediaQuery';
import { MapFocusProvider } from '../features/map/MapFocusContext';
import type { VisitType, Visit } from '../types';


/** One-time "add the flight?" toast after the first country is marked. */
const FLIGHT_NUDGE_KEY = 'mycontrail-flight-nudge-shown';

/** Visited countries, excluding transit - the same rule the Overview uses. */
function overviewStatsCountForMilestones(
  visits: { visitType?: string | null }[]
): number {
  return visits.filter((visit) => {
    const type = visit.visitType || 'trip';
    // Trips, homes and lived-in: transit never counted, and a wishlist
    // entry is a dream, not a milestone.
    return type === 'trip' || type === 'home' || type === 'lived';
  }).length;
}

function TravelMapPage() {
  // Null means "no panel" - the map gets the whole canvas. Countries opens by
  // default on desktop because it is the primary action; mobile starts closed
  // so the first thing you see is your map.
  const [activeSection, setActiveSection] = useState<SectionId | null>(null);
  const isDesktop = useIsDesktop();

  // "Where do they stay the most" - null section means the bare map.
  useSectionDwell(activeSection ?? 'map');

  const { data: countries = [] } = useGetCountriesQuery();
  const { data: visits = [], isLoading: visitsLoading } = useGetVisitsQuery();
  // The initial view needs only a flight count and total distance, so it uses
  // the cheap summary endpoint rather than the full stats payload (which loads
  // every journey with its legs and airports). The Stats panel still fetches
  // the full stats when opened.
  const { data: flightSummary } = useGetFlightSummaryQuery();
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
      // kind only - never which country (analytics privacy rule).
      track('map_interact', { kind: 'country_open' });
      /*
        Tap cycles the state (user's design, 2026-08-13; lived added
        2026-08-17): none → visited → lived → transit → want to go → removed.

        Home is deliberately NOT in the cycle: it is set only via the picker,
        and tapping it keeps the old remove-with-undo - a stray tap must
        never silently demote someone's home country. The picker remains the
        direct path to any state.
      */
      if (existingVisit) {
        // Same cycle as the map layer (lived joined 2026-08-17); toasts
        // share the coalescing key so cycling never stacks messages.
        const type = existingVisit.visitType || 'trip';
        if (type === 'trip') {
          await updateVisit({
            id: existingVisit.id,
            data: { visitType: 'lived' },
          }).unwrap();
          showToast('Lived here - tap again for transit', {
            durationMs: 3000,
            key: 'visit-cycle',
          });
        } else if (type === 'lived') {
          await updateVisit({
            id: existingVisit.id,
            data: { visitType: 'transit' },
          }).unwrap();
          showToast('Marked as transit - tap again for "want to go"', {
            durationMs: 3000,
            key: 'visit-cycle',
          });
        } else if (type === 'transit') {
          await updateVisit({
            id: existingVisit.id,
            data: { visitType: 'wishlist' },
          }).unwrap();
          showToast('On your "want to go" list - tap again to clear', {
            durationMs: 3000,
            key: 'visit-cycle',
          });
        } else {
          // wishlist completes the cycle; home skips it entirely.
          await removeVisitWithUndo(existingVisit);
        }
        return;
      }
      await addVisitForCountry(countryId);
      /*
        One-time flights nudge, at the moment of highest intent: they just
        marked somewhere they've been. Phrased as a question because flights
        are optional - bus, train and ship travellers have already done
        everything they need by tapping (user decision, 2026-08-13).
      */
      if (!localStorage.getItem(FLIGHT_NUDGE_KEY)) {
        localStorage.setItem(FLIGHT_NUDGE_KEY, '1');
        showToast('Marked as visited ✓ - got there by plane?', {
          durationMs: 8000,
          key: 'visit-cycle',
          action: {
            label: 'Add the flight',
            onAction: () => setActiveSection('flights'),
          },
        });
      }
    },
    [visitByCountryId, addVisitForCountry, removeVisitWithUndo, updateVisit, showToast]
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

  /*
    Celebrate thresholds as they are crossed. Placed here because this is the
    only component that already holds every total, and because the share
    screen it offers is a sibling section rather than a route.
  */
  const continentRows = useMemo(
    () => continentProgress(countries, visits),
    [countries, visits],
  );

  useMilestones({
    countries: overviewStatsCountForMilestones(visits),
    distanceKm: flightSummary?.totalDistanceKm ?? 0,
    flights: flightSummary?.totalFlights ?? 0,
    continents: continentRows,
    onShare: () => setActiveSection('share'),
  });

  // A streak-holder who has not played today gets one gentle reminder.
  useDailyNudge();

  const overviewStats = useMemo(() => {
    const tripCount = visits.filter((v) => {
      const type = v.visitType || 'trip';
      return type === 'trip' || type === 'home' || type === 'lived';
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
            countries={countries}
            visits={visits}
            tripCount={overviewStats.tripCount}
            transitCount={overviewStats.transitCount}
            worldPercent={overviewStats.worldPercent}
            totalCountries={overviewStats.totalCountries}
            homeCountry={overviewStats.homeCountry}
          />
        );

      case 'share':
        return <SharePanel />;

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
            {/* "Past or future?" was a real question (friend feedback,
                2026-08-17) - answer it before the form does. */}
            <p className="text-xs text-ink-muted -mb-3">
              Your flight log - trips you&rsquo;ve taken. A future date is
              kept as a plan and stays out of your stats until it happens.
            </p>
            <FlightForm />
            <ImportFlights />
            <FlightList />
          </div>
        );

      case 'stats':
        return <FlightStats />;

      default:
        return null;
    }
  })();

  // One source for both layouts: full-view replaces the map, the dock sits
  // beside it, but the content is the same component either way.
  const sectionBody = panelContent;

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
                {/*
                  One tour instead of two hint cards (friend feedback,
                  2026-08-17): the old empty-map hint and the gesture hint
                  overlapped and said half of this each. Once per device.
                */}
                <MapTour />

                <MapPeekBar
                  countriesVisited={overviewStats.tripCount}
                  worldPercent={overviewStats.worldPercent}
                  flights={flightSummary?.totalFlights ?? 0}
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
