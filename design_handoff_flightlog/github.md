repo: dilyanatanasov/my-travel-plan
branch: main
path: frontend/src

## Last sync
date: 2026-08-11T13:05:42Z

### Updated in this project
- New mobile app prototype (Flightlog) covering map, flights, stats, smart search and share screens
- Flight/stat/search data shapes taken from the repo's TypeScript types
- World map rendered from real Natural Earth geometry with great-circle routes

## Screen map
| Project screen | Repo files |
| --- | --- |
| Map | frontend/src/components/TravelMap/*, frontend/src/components/WorldMap/WorldMap.tsx, frontend/src/pages/TravelMapPage.tsx |
| Flights | frontend/src/components/FlightList/*, frontend/src/components/FlightForm/RouteBuilder.tsx |
| Stats | frontend/src/components/FlightStats/*, frontend/src/types/index.ts (FlightStats) |
| Smart search | frontend/src/pages/FlightSearchPage.tsx, frontend/src/types/index.ts (FlexibleSearchDto, ExplorationFlightOptionDto) |
| Share | new — no repo equivalent yet |
