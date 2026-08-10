import { memo, useState, useCallback, useMemo } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from 'react-simple-maps';
import {
  useGetVisitsQuery,
  useGetCountriesQuery,
  useSetHomeCountryMutation,
} from '../../features/visits/visitsApi';
import { useVisitActions } from '../../features/visits/useVisitActions';
import { useToast } from '../Toast/ToastProvider';
import type { Visit } from '../../types';
import { useGetFlightsQuery } from '../../features/flights/flightsApi';
import { aggregateRoutes, extractUniqueAirports, countAirportVisits } from '../FlightMap/routeUtils';
import { applyFilters, extractFilterOptions } from '../FlightMap/filterUtils';
import { DEFAULT_FILTERS, type FlightFilters } from '../FlightMap/filterTypes';
import FlightRoutes from '../FlightMap/FlightRoutes';
import AirportMarkers from '../FlightMap/AirportMarkers';
import RouteTooltip from '../FlightMap/RouteTooltip';
import MapControlPanel, { type TravelMapSettings } from './MapControlPanel';
import { useMapViewport } from './useMapViewport';
import { MAP, MAP_HOVER, MAP_PRESSED } from '../../theme/mapColors';
import {
  buildCountryDisplayMap,
  getCountryColor,
  getCountryHoverColor,
  getCountryPressedColor,
} from './countryColors';
import type { AggregatedRoute } from '../FlightMap/routeUtils';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// Mapping from ISO 3166-1 numeric codes to alpha-3 codes
const numericToAlpha3: Record<string, string> = {
  '4': 'AFG', '8': 'ALB', '12': 'DZA', '20': 'AND', '24': 'AGO',
  '28': 'ATG', '32': 'ARG', '51': 'ARM', '36': 'AUS', '40': 'AUT',
  '31': 'AZE', '44': 'BHS', '48': 'BHR', '50': 'BGD', '52': 'BRB',
  '112': 'BLR', '56': 'BEL', '84': 'BLZ', '204': 'BEN', '64': 'BTN',
  '68': 'BOL', '70': 'BIH', '72': 'BWA', '76': 'BRA', '96': 'BRN',
  '100': 'BGR', '854': 'BFA', '108': 'BDI', '132': 'CPV', '116': 'KHM',
  '120': 'CMR', '124': 'CAN', '140': 'CAF', '148': 'TCD', '152': 'CHL',
  '156': 'CHN', '170': 'COL', '174': 'COM', '178': 'COG', '188': 'CRI',
  '191': 'HRV', '192': 'CUB', '196': 'CYP', '203': 'CZE', '180': 'COD',
  '208': 'DNK', '262': 'DJI', '212': 'DMA', '214': 'DOM', '218': 'ECU',
  '818': 'EGY', '222': 'SLV', '226': 'GNQ', '232': 'ERI', '233': 'EST',
  '748': 'SWZ', '231': 'ETH', '242': 'FJI', '246': 'FIN', '250': 'FRA',
  '266': 'GAB', '270': 'GMB', '268': 'GEO', '276': 'DEU', '288': 'GHA',
  '300': 'GRC', '308': 'GRD', '320': 'GTM', '324': 'GIN', '624': 'GNB',
  '328': 'GUY', '332': 'HTI', '340': 'HND', '348': 'HUN', '352': 'ISL',
  '356': 'IND', '360': 'IDN', '364': 'IRN', '368': 'IRQ', '372': 'IRL',
  '376': 'ISR', '380': 'ITA', '384': 'CIV', '388': 'JAM', '392': 'JPN',
  '400': 'JOR', '398': 'KAZ', '404': 'KEN', '296': 'KIR', '-99': 'XKX',
  '414': 'KWT', '417': 'KGZ', '418': 'LAO', '428': 'LVA', '422': 'LBN',
  '426': 'LSO', '430': 'LBR', '434': 'LBY', '438': 'LIE', '440': 'LTU',
  '442': 'LUX', '450': 'MDG', '454': 'MWI', '458': 'MYS', '462': 'MDV',
  '466': 'MLI', '470': 'MLT', '584': 'MHL', '478': 'MRT', '480': 'MUS',
  '484': 'MEX', '583': 'FSM', '498': 'MDA', '492': 'MCO', '496': 'MNG',
  '499': 'MNE', '504': 'MAR', '508': 'MOZ', '104': 'MMR', '516': 'NAM',
  '520': 'NRU', '524': 'NPL', '528': 'NLD', '554': 'NZL', '558': 'NIC',
  '562': 'NER', '566': 'NGA', '408': 'PRK', '807': 'MKD', '578': 'NOR',
  '512': 'OMN', '586': 'PAK', '585': 'PLW', '275': 'PSE', '591': 'PAN',
  '598': 'PNG', '600': 'PRY', '604': 'PER', '608': 'PHL', '616': 'POL',
  '620': 'PRT', '634': 'QAT', '642': 'ROU', '643': 'RUS', '646': 'RWA',
  '659': 'KNA', '662': 'LCA', '670': 'VCT', '882': 'WSM', '674': 'SMR',
  '678': 'STP', '682': 'SAU', '686': 'SEN', '688': 'SRB', '690': 'SYC',
  '694': 'SLE', '702': 'SGP', '703': 'SVK', '705': 'SVN', '90': 'SLB',
  '706': 'SOM', '710': 'ZAF', '410': 'KOR', '728': 'SSD', '724': 'ESP',
  '144': 'LKA', '729': 'SDN', '740': 'SUR', '752': 'SWE', '756': 'CHE',
  '760': 'SYR', '158': 'TWN', '762': 'TJK', '834': 'TZA', '764': 'THA',
  '626': 'TLS', '768': 'TGO', '776': 'TON', '780': 'TTO', '788': 'TUN',
  '792': 'TUR', '795': 'TKM', '798': 'TUV', '800': 'UGA', '804': 'UKR',
  '784': 'ARE', '826': 'GBR', '840': 'USA', '858': 'URY', '860': 'UZB',
  '548': 'VUT', '336': 'VAT', '862': 'VEN', '704': 'VNM', '887': 'YEM',
  '894': 'ZMB', '716': 'ZWE', '732': 'ESH', '16': 'ASM', '530': 'ANT',
  '60': 'BMU', '136': 'CYM', '184': 'COK', '238': 'FLK', '234': 'FRO',
  '254': 'GUF', '304': 'GRL', '312': 'GLP', '316': 'GUM', '344': 'HKG',
  '474': 'MTQ', '540': 'NCL', '570': 'NIU', '574': 'NFK', '580': 'MNP',
  '612': 'PCN', '630': 'PRI', '638': 'REU', '666': 'SPM', '744': 'SJM',
  '772': 'TKL', '796': 'TCA', '850': 'VIR', '876': 'WLF', '446': 'MAC',
};

const DEFAULT_SETTINGS: TravelMapSettings = {
  showCountries: true,
  showFlights: true,
  showAirports: true,
};

function TravelMap() {
  // Data queries
  const { data: visits = [] } = useGetVisitsQuery();
  const { data: countries = [] } = useGetCountriesQuery();
  const { data: flights = [] } = useGetFlightsQuery();

  // Mutations
  const [setHomeCountry] = useSetHomeCountryMutation();
  const { addVisitForCountry, removeVisitWithUndo } = useVisitActions();
  const { showToast } = useToast();

  // State
  const [settings, setSettings] = useState<TravelMapSettings>(DEFAULT_SETTINGS);
  const [filters, setFilters] = useState<FlightFilters>(DEFAULT_FILTERS);
  const [hoveredRoute, setHoveredRoute] = useState<AggregatedRoute | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // On touch devices the map starts inert so a thumb-drag scrolls the page
  // instead of panning the map. Tapping the scrim arms it.
  const { scale, width, height, isCoarsePointer } = useMapViewport();
  const [isTouchActivated, setIsTouchActivated] = useState(false);

  // Build country display map from visits
  const countryDisplayMap = useMemo(() => buildCountryDisplayMap(visits), [visits]);

  // Find home country
  const homeVisit = useMemo(
    () => visits.find((v) => v.visitType === 'home'),
    [visits]
  );

  // Build lookup maps
  const countryByIsoCode = useMemo(() => {
    const map = new Map<string, number>();
    countries.forEach((c) => {
      map.set(c.isoCode, c.id);
    });
    return map;
  }, [countries]);

  // Keyed by country so a removal can be undone with the full record — the
  // date, notes and visit type would otherwise be lost on a single mis-tap.
  const visitByCountryId = useMemo(() => {
    const map = new Map<number, Visit>();
    visits.forEach((v) => {
      map.set(v.countryId, v);
    });
    return map;
  }, [visits]);

  // Flight data with filters
  const filterOptions = useMemo(() => extractFilterOptions(flights), [flights]);
  const filteredFlights = useMemo(
    () => applyFilters(flights, filters),
    [flights, filters]
  );
  const routes = useMemo(() => aggregateRoutes(filteredFlights), [filteredFlights]);
  const airports = useMemo(
    () => extractUniqueAirports(filteredFlights),
    [filteredFlights]
  );
  const airportVisitCounts = useMemo(
    () => countAirportVisits(filteredFlights),
    [filteredFlights]
  );
  const maxRouteCount = Math.max(...routes.map((r) => r.count), 1);

  // Stats
  const stats = useMemo(() => {
    const visitedCount = visits.filter((v) => {
      // Default to 'trip' for existing records without visitType
      const type = v.visitType || 'trip';
      return type === 'trip' || type === 'home';
    }).length;
    const transitCount = visits.filter((v) => v.visitType === 'transit').length;
    return {
      visitedCount,
      transitCount,
      totalCountries: countries.length,
      flightRoutes: routes.length,
      airports: airports.length,
    };
  }, [visits, countries, routes, airports]);

  // Handlers
  const handleCountryClick = useCallback(
    async (isoCode: string) => {
      const countryId = countryByIsoCode.get(isoCode);
      if (!countryId) return;

      const existingVisit = visitByCountryId.get(countryId);
      if (existingVisit) {
        await removeVisitWithUndo(existingVisit);
      } else {
        await addVisitForCountry(countryId);
      }
    },
    [countryByIsoCode, visitByCountryId, addVisitForCountry, removeVisitWithUndo]
  );

  const handleSetHomeCountry = useCallback(
    async (countryId: number) => {
      try {
        await setHomeCountry(countryId).unwrap();
      } catch {
        showToast('Could not set your home country', { tone: 'error' });
      }
    },
    [setHomeCountry, showToast]
  );

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

  // Highlighted airports when hovering a route
  const highlightedAirports = hoveredRoute
    ? [hoveredRoute.departure.iataCode, hoveredRoute.arrival.iataCode]
    : [];

  return (
    <div
      className="bg-white rounded-lg shadow-md overflow-hidden relative"
      onMouseMove={handleMouseMove}
    >
      {/* Layers, filters and legend, collapsed into one panel */}
      <MapControlPanel
        settings={settings}
        onSettingsChange={setSettings}
        countries={countries}
        homeCountryId={homeVisit?.countryId || null}
        onSetHomeCountry={handleSetHomeCountry}
        filters={filters}
        onFiltersChange={setFilters}
        airports={filterOptions.airports}
        years={filterOptions.years}
        stats={stats}
      />

      {/* Map */}
      <div className="relative">
        {/* Aspect ratios here must stay in step with MOBILE/DESKTOP in
            useMapViewport, or preserveAspectRatio letterboxes the map. */}
        <ComposableMap
          width={width}
          height={height}
          projectionConfig={{
            rotate: [-10, 0, 0],
            scale,
          }}
          // h-auto is required: the svg carries a height attribute from the
          // width/height props, and CSS aspect-ratio is ignored unless the
          // used height is auto.
          className="w-full h-auto aspect-[4/3] md:aspect-[2/1]"
        >
        <ZoomableGroup>
          {/*
            Explicit ocean. Without it the sea shows the white card through,
            so page, sea and unvisited land were three near-identical greys
            and the map had no ground to sit on.
          */}
          <rect
            x={-width * 2}
            y={-height * 2}
            width={width * 5}
            height={height * 5}
            fill={MAP.ocean}
          />

          {/* Countries */}
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const numericCode = String(parseInt(geo.id, 10));
                const isoCode = numericToAlpha3[numericCode];
                const displayInfo = isoCode
                  ? countryDisplayMap.get(isoCode)
                  : undefined;
                const visitType = displayInfo?.visitType || 'none';
                const isHome = displayInfo?.isHome || false;

                // Determine colors based on settings
                const showVisitColors = settings.showCountries;
                const fillColor = showVisitColors
                  ? getCountryColor(visitType, isHome)
                  : MAP.land;
                const hoverColor = showVisitColors
                  ? getCountryHoverColor(visitType, isHome)
                  : MAP_HOVER.land;
                const pressedColor = showVisitColors
                  ? getCountryPressedColor(visitType, isHome)
                  : MAP_PRESSED.land;

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onClick={() => {
                      if (isoCode && settings.showCountries) {
                        handleCountryClick(isoCode);
                      }
                    }}
                    style={{
                      default: {
                        fill: fillColor,
                        stroke: MAP.countryBorder,
                        strokeWidth: 0.5,
                        outline: 'none',
                      },
                      hover: {
                        fill: hoverColor,
                        stroke: MAP.countryBorder,
                        strokeWidth: 0.5,
                        outline: 'none',
                        cursor: isoCode && settings.showCountries ? 'pointer' : 'default',
                      },
                      pressed: {
                        fill: pressedColor,
                        stroke: MAP.countryBorder,
                        strokeWidth: 0.5,
                        outline: 'none',
                      },
                    }}
                  />
                );
              })
            }
          </Geographies>

          {/* Flight Routes */}
          {settings.showFlights && (
            <FlightRoutes
              routes={routes}
              maxCount={maxRouteCount}
              hoveredRouteKey={hoveredRoute?.key || null}
              onHover={handleRouteHover}
            />
          )}

          {/* Airport Markers */}
          {settings.showAirports && settings.showFlights && (
            <AirportMarkers
              airports={airports}
              visitCounts={airportVisitCounts}
              highlightedAirports={highlightedAirports}
            />
          )}
        </ZoomableGroup>
        </ComposableMap>

        {/*
          Touch scroll-trap guard. d3-zoom inside ZoomableGroup swallows touch
          drags, so a full-width map mid-page becomes impossible to scroll past.
          The scrim intercepts the first touch and hands control over only once
          the user has asked for it.
        */}
        {isCoarsePointer && !isTouchActivated && (
          <button
            type="button"
            onClick={() => setIsTouchActivated(true)}
            className="absolute inset-0 z-10 flex items-end justify-center pb-6 bg-transparent"
            aria-label="Activate map interaction"
          >
            <span className="px-3 py-2 rounded-full bg-gray-900/75 text-white text-xs font-medium shadow-lg">
              Tap to interact with map
            </span>
          </button>
        )}
      </div>

      {/* Route Tooltip */}
      <RouteTooltip route={hoveredRoute} position={tooltipPosition} />
    </div>
  );
}

export default memo(TravelMap);
