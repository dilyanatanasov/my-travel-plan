import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ComposableMap, ZoomableGroup } from 'react-simple-maps';
import { useGetPublicMapQuery } from '../features/share/shareApi';
import CountriesLayer from '../components/TravelMap/CountriesLayer';
import FlightRoutes from '../components/FlightMap/FlightRoutes';
import AirportMarkers from '../components/FlightMap/AirportMarkers';
import { useMapViewport } from '../components/TravelMap/useMapViewport';
import { useMapColors } from '../theme/mapColors';
import type { CountryDisplayInfo } from '../components/TravelMap/countryColors';
import type { AggregatedRoute } from '../components/FlightMap/routeUtils';
import type { Airport } from '../types';

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-surface rounded-lg px-4 py-3 border border-line">
      <div className="text-xl sm:text-2xl font-bold text-ink">{value}</div>
      <div className="text-xs sm:text-sm text-ink-muted">{label}</div>
    </div>
  );
}

function SharedMapPage() {
  const { token = '' } = useParams();
  const { data, isLoading, isError } = useGetPublicMapQuery(token, {
    skip: !token,
  });
  // The shared page is a document, not the shell, so the map keeps a fixed
  // aspect box; the hook measures whatever that box resolves to.
  const { map: colors, legend } = useMapColors();
  const { ref: mapBoxRef, viewport } = useMapViewport<HTMLDivElement>();
  const { width, height, scale } = viewport;

  const countryDisplayMap = useMemo(() => {
    const map = new Map<string, CountryDisplayInfo>();
    data?.countries.forEach((country) => {
      map.set(country.isoCode, {
        isoCode: country.isoCode,
        visitType: country.visitType,
        isHome: country.visitType === 'home',
        hasFlights: false,
        visit: null,
      });
    });
    return map;
  }, [data]);

  // Adapt the public payload to the shapes the existing map layers expect,
  // rather than forking those components for the read-only view.
  // `flights` stays empty: it only feeds the hover tooltip, which this
  // read-only map does not render, and the journeys behind it are private.
  const routes = useMemo<AggregatedRoute[]>(
    () =>
      (data?.routes ?? []).map((route) => ({
        key: `${route.from.iataCode}-${route.to.iataCode}`,
        departure: route.from as unknown as Airport,
        arrival: route.to as unknown as Airport,
        count: route.count,
        totalDistance: route.distanceKm,
        flights: [],
      })),
    [data]
  );

  const airports = useMemo(
    () => (data?.airports ?? []) as unknown as Airport[],
    [data]
  );

  const airportVisitCounts = useMemo(() => {
    const counts = new Map<string, number>();
    data?.routes.forEach((route) => {
      counts.set(
        route.from.iataCode,
        (counts.get(route.from.iataCode) ?? 0) + route.count
      );
      counts.set(
        route.to.iataCode,
        (counts.get(route.to.iataCode) ?? 0) + route.count
      );
    });
    return counts;
  }, [data]);

  const maxRouteCount = Math.max(...routes.map((r) => r.count), 1);

  if (isLoading) {
    return (
      <div className="scroll-page bg-canvas flex items-center justify-center">
        <p className="text-ink-muted">Loading map…</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="scroll-page bg-canvas flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <h1 className="text-2xl font-bold text-ink mb-2">
            This map isn't available
          </h1>
          <p className="text-ink-muted mb-6">
            The link may have been turned off, or it was never valid.
          </p>
          <Link
            to="/"
            className="inline-flex items-center min-h-11 px-4 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700"
          >
            Go to Travel Tracker
          </Link>
        </div>
      </div>
    );
  }

  const { stats } = data;

  return (
    <div className="scroll-page bg-canvas">
      <header className="bg-surface border-b border-line">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-ink truncate">
              {data.displayName}'s travel map
            </h1>
            <p className="text-sm text-ink-muted">
              {stats.countriesVisited} countries · {stats.worldPercent}% of the world
            </p>
          </div>
          <Link
            to="/register"
            className="flex-shrink-0 inline-flex items-center min-h-11 px-3 sm:px-4 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700"
          >
            Make your own
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-8 space-y-4 sm:space-y-6">
        <div className="bg-surface rounded-lg shadow-md overflow-hidden">
          <div
            ref={mapBoxRef}
            className="w-full aspect-[4/3] md:aspect-[2/1]"
            style={{ backgroundColor: colors.ocean }}
          >
            <ComposableMap
              width={width}
              height={height}
              projectionConfig={{ rotate: [-10, 0, 0], scale }}
              className="w-full h-full"
            >
            <ZoomableGroup>
              <rect
                x={-width * 2}
                y={-height * 2}
                width={width * 5}
                height={height * 5}
                fill={colors.ocean}
              />
              {/* No onCountryClick: this view is read-only. */}
              <CountriesLayer countryDisplayMap={countryDisplayMap} />
              {routes.length > 0 && (
                <FlightRoutes
                  routes={routes}
                  maxCount={maxRouteCount}
                  hoveredRouteKey={null}
                  onHover={() => undefined}
                />
              )}
              {airports.length > 0 && (
                <AirportMarkers
                  airports={airports}
                  visitCounts={airportVisitCounts}
                  highlightedAirports={[]}
                />
              )}
              </ZoomableGroup>
            </ComposableMap>
          </div>

          <div className="px-4 py-2.5 border-t border-line flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
            {legend.map((entry) => (
              <div key={entry.label} className="flex items-center gap-1.5">
                <span
                  className="w-3 h-3 rounded flex-shrink-0"
                  style={{ backgroundColor: entry.color }}
                  aria-hidden="true"
                />
                <span className="text-ink-muted">{entry.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatTile
            value={String(stats.countriesVisited)}
            label="Countries visited"
          />
          <StatTile value={`${stats.worldPercent}%`} label="Of the world" />
          <StatTile value={String(stats.flights)} label="Flights" />
          <StatTile
            value={`${stats.distanceKm.toLocaleString()} km`}
            label="Distance flown"
          />
        </div>

        <p className="text-center text-sm text-ink-muted py-4">
          Made with{' '}
          <Link to="/" className="text-brand-700 font-medium hover:underline">
            Travel Tracker
          </Link>
        </p>
      </main>
    </div>
  );
}

export default SharedMapPage;
