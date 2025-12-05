import { memo, useState, useCallback, useMemo } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from 'react-simple-maps';
import { useGetFlightsQuery } from '../../features/flights/flightsApi';
import { aggregateRoutes, extractUniqueAirports, countAirportVisits } from './routeUtils';
import { applyFilters, extractFilterOptions, countActiveFilters } from './filterUtils';
import { DEFAULT_FILTERS, type FlightFilters } from './filterTypes';
import FlightRoutes from './FlightRoutes';
import AirportMarkers from './AirportMarkers';
import RouteTooltip from './RouteTooltip';
import FlightMapFilters from './FlightMapFilters';
import type { AggregatedRoute } from './routeUtils';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

function FlightMap() {
  const { data: flights = [] } = useGetFlightsQuery();
  const [hoveredRoute, setHoveredRoute] = useState<AggregatedRoute | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [filters, setFilters] = useState<FlightFilters>(DEFAULT_FILTERS);

  // Extract filter options from all flights (unfiltered)
  const filterOptions = useMemo(() => extractFilterOptions(flights), [flights]);

  // Apply filters to flights
  const filteredFlights = useMemo(
    () => applyFilters(flights, filters),
    [flights, filters]
  );

  // Derive routes and airports from filtered flights
  const routes = useMemo(() => aggregateRoutes(filteredFlights), [filteredFlights]);
  const airports = useMemo(() => extractUniqueAirports(filteredFlights), [filteredFlights]);
  const airportVisitCounts = useMemo(
    () => countAirportVisits(filteredFlights),
    [filteredFlights]
  );
  const maxRouteCount = Math.max(...routes.map((r) => r.count), 1);

  const activeFilterCount = countActiveFilters(filters);

  const handleRouteHover = useCallback(
    (route: AggregatedRoute | null, event?: React.MouseEvent) => {
      setHoveredRoute(route);
      if (event && route) {
        setTooltipPosition({ x: event.clientX, y: event.clientY });
      }
    },
    []
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (hoveredRoute) {
        setTooltipPosition({ x: event.clientX, y: event.clientY });
      }
    },
    [hoveredRoute]
  );

  // Get highlighted airports when hovering a route
  const highlightedAirports = hoveredRoute
    ? [hoveredRoute.departure.iataCode, hoveredRoute.arrival.iataCode]
    : [];

  return (
    <div
      className="bg-white rounded-lg shadow-md overflow-hidden relative"
      onMouseMove={handleMouseMove}
    >
      {/* Filter Bar */}
      <FlightMapFilters
        filters={filters}
        onFiltersChange={setFilters}
        airports={filterOptions.airports}
        years={filterOptions.years}
      />

      <ComposableMap
        projectionConfig={{
          rotate: [-10, 0, 0],
          scale: 147,
        }}
        className="w-full h-[500px]"
      >
        <ZoomableGroup>
          {/* Background countries */}
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  style={{
                    default: {
                      fill: '#e5e7eb',
                      stroke: '#fff',
                      strokeWidth: 0.5,
                      outline: 'none',
                    },
                    hover: {
                      fill: '#d1d5db',
                      stroke: '#fff',
                      strokeWidth: 0.5,
                      outline: 'none',
                    },
                    pressed: {
                      fill: '#d1d5db',
                      stroke: '#fff',
                      strokeWidth: 0.5,
                      outline: 'none',
                    },
                  }}
                />
              ))
            }
          </Geographies>

          {/* Flight routes */}
          <FlightRoutes
            routes={routes}
            maxCount={maxRouteCount}
            hoveredRouteKey={hoveredRoute?.key || null}
            onHover={handleRouteHover}
          />

          {/* Airport markers */}
          <AirportMarkers
            airports={airports}
            visitCounts={airportVisitCounts}
            highlightedAirports={highlightedAirports}
          />
        </ZoomableGroup>
      </ComposableMap>

      {/* Legend */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-blue-500 rounded"></div>
            <span className="text-gray-600">Flight route</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-gray-600">Airport</span>
          </div>
          <span className="text-gray-400 ml-auto">
            {routes.length} route{routes.length !== 1 ? 's' : ''} •{' '}
            {airports.length} airport{airports.length !== 1 ? 's' : ''}
            {activeFilterCount > 0 && (
              <span className="ml-2 text-blue-500">
                ({activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active)
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Tooltip */}
      <RouteTooltip route={hoveredRoute} position={tooltipPosition} />
    </div>
  );
}

export default memo(FlightMap);
