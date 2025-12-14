# Hub Exploration Implementation Status

## Date: 2025-12-06

## Summary
Implemented Phase 3 (Hub Exploration) from the Intelligent Flight Exploration plan. This feature searches for flights through connection hubs when direct routes aren't available.

## What Was Implemented

### Backend Files Created/Modified

1. **`backend/src/modules/flights/data/hubs.ts`** - NEW
   - Defines 16 known connection hubs (IST, DXB, DOH, FRA, LHR, etc.)
   - Each hub has: code, name, city, region, strongForRegions, minConnectionMinutes, priority
   - Functions: `getHubsForDestination()`, `getDefaultHubs()`, `getDestinationRegion()`

2. **`backend/src/modules/flights/services/hub.service.ts`** - NEW
   - `getRelevantHubs()` - Selects best hubs for origin-destination pair (max 5)
   - `isConnectionFeasible()` - Validates connection times (min per hub, max 12h)
   - `scoreConnection()` - Rates connection quality (0-100)

3. **`backend/src/modules/flights/services/flight-exploration.service.ts`** - REWRITTEN
   - `explore()` now searches through hubs instead of direct routes
   - `searchViaHub()` - Searches 4 legs in parallel (origin→hub, hub→dest, dest→hub, hub→origin)
   - `searchOneWay()` - Makes one-way API calls
   - `combineHubFlights()` - Finds valid flight combinations with proper connection times

4. **`backend/src/modules/flights/flights.module.ts`** - MODIFIED
   - Added HubService to providers and exports

### Key Features
- Searches through 5 most relevant hubs per route
- 4 API calls per hub (outbound leg 1, outbound leg 2, return leg 1, return leg 2)
- Connection time validation: minimum per hub (90min IST, 60min DOH, etc.), max 24 hours
- Combines flights only when:
  - Hub connection times are valid
  - Trip duration matches requested min/max nights
  - Return departs after arrival at destination

## Testing Results

### Issue Discovered
The Kiwi RapidAPI one-way endpoint returns flights for **multiple dates**, not the specific date requested. Flights are sorted by price regardless of date.

**Example:**
- Searched for: `2026-02-01`
- VAR→IST returned flights for `2026-01-05`, `2026-02-16`, `2026-03-16`, etc.
- IST→HKT returned flights for `2026-03-08`, `2026-01-18`, etc.

### Solution Implemented
Changed combination logic to:
1. Get all flights (don't filter by date)
2. Find pairs where hub connection time is valid (min-24h)
3. Combine outbound+return only if trip duration matches requirements

### Progress Before Rate Limit
Last successful test showed:
- IST: 15 flights VAR→IST, 15 flights IST→HKT (before date issues fixed)
- DXB: 2 valid outbound pairs, 0 valid return pairs
- DOH: 2 valid outbound pairs, 1 valid return pair, 0 complete (stay duration mismatch)
- LHR: 1 valid outbound pair, 6 valid return pairs, 0 complete (chronology issue)

## API Key Rotation Implemented

### New Service: `api-key-manager.service.ts`
- Manages multiple RapidAPI keys for automatic rotation
- Supports `RAPIDAPI_KEYS` environment variable (comma-separated)
- Falls back to legacy `RAPIDAPI_KEY` single key
- Auto-rotates when 429 quota error detected
- Keys reset after 1 hour cooldown

### Configuration
```env
# .env - Multiple keys for rotation
RAPIDAPI_KEYS=key1,key2,key3
```

### Rotation Logic
1. Start with first available key
2. On 429 error → mark current key as exhausted
3. Rotate to next non-exhausted key
4. After 1 hour → reset exhausted keys
5. If all keys exhausted → throw error

### Logs from Successful Rotation Test
```
[ApiKeyManagerService] Initialized 2 API key(s) for rotation
[ApiKeyManagerService] Quota error on key 1: {"message":"You have exceeded the MONTHLY quota..."}
[ApiKeyManagerService] API key 1/2 exhausted after 0 requests
[ApiKeyManagerService] Rotated to API key 2/2
```

## Date Filtering Implemented

### Changes Made
1. Added date tolerance filtering (7 days) in `transformToOneWayFlights()`
2. Increased API limit from 15 to 30 results per query
3. Now uses actual flight dates instead of sample dates

### Test Results (Before Keys Exhausted)
```
IST->DBV: 1 flight within 3 days
LHR->IST: 2 flights within 3 days
IST->LHR: 3 flights within 3 days
LHR->FRA: 4 flights within 3 days
FRA->DBV: 2 flights within 3 days
FRA->LHR: 3 flights within 3 days
```

### Remaining Issues
1. **DXB**: "1 too long" - stay at destination exceeds max nights
2. **DOH**: "4 negative stay" - return flight departs before arrival
3. **DBV routes**: Very few return flights from Dubrovnik (seasonal airport)

### Suggested Next Steps
- Test with more popular routes (e.g., LHR→BCN via CDG)
- Consider searching without return date and combining post-hoc
- Add fallback to round-trip API when hub search fails

## Status Update (2025-12-13)

### Issues Fixed

1. **Date Filtering Too Strict**
   - The Kiwi API returns flights sorted by **price**, not by date
   - Previous 7-day tolerance filter was rejecting all flights if cheapest ones were outside the window
   - **Fix**: Removed date filtering in `transformToOneWayFlights()` - combination logic validates dates instead

2. **Docker Environment Variables**
   - `docker restart` doesn't reload `.env` changes
   - **Fix**: Use `docker-compose up -d` to recreate containers with new env

3. **API Key Quota**
   - Key 2 upgraded to 20,000 requests/month
   - Key 1 remains exhausted (BASIC plan)
   - Using single working key for now

### Test Results (Working!)

```
VAR → HKT (7-14 nights, Feb 2026):
- Total options found: 16
- Cheapest: $897 via IST
- Hubs with results: IST (10), DOH (4)
- Hubs without valid returns: DXB, FRA, LHR
```

Sample combination via IST:
- Outbound: VAR → IST → HKT (34h with layover)
- Return: HKT → DOH/IST → VAR (52h with layover)
- Stay: 13 nights at destination

### Known Limitations

1. **Some duplicates in results** - Different leg combinations can produce same total price/dates
2. **Long layovers** - Some hubs produce 30-50h travel times due to connection timing
3. **Hub availability varies** - Not all hubs have valid return connections for all routes

## Previous Blocker (Resolved)
~~Both RapidAPI Keys Exhausted~~ - Key 2 upgraded to 20K/month.

## Next Steps

1. **Further Testing**
   - Test with date ranges instead of specific dates
   - Verify stay duration calculations
   - Test with different hub combinations

2. **Potential Improvements**
   - Cache API responses to reduce API calls
   - Increase number of itineraries requested per leg
   - Add smarter date matching (find flights closest to requested dates)
   - Consider alternative APIs or direct Kiwi Tequila integration

3. **Frontend Integration**
   - The frontend components are already built
   - Should work once backend returns valid results

## Connection Time Settings
From `hubs.ts`:
- IST (Istanbul): 90 min minimum
- DXB (Dubai): 90 min minimum
- DOH (Doha): 60 min minimum
- FRA (Frankfurt): 60 min minimum
- LHR (London Heathrow): 90 min minimum
- CDG (Paris): 75 min minimum
- AMS (Amsterdam): 50 min minimum
- MUC (Munich): 45 min minimum
