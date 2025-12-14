# Flight Search Functionality Research

**Date**: 2025-12-05
**Feature**: Personalized Flight Search with Advanced Filtering

---

## Executive Summary

This research covers flight search API options, filtering capabilities, airline safety data, and implementation approaches for a personalized flight search feature with support for:
- Layover/connection time limits
- Maximum airport changes (stops)
- Price filtering with baggage inclusion
- Upgrade pricing visibility
- Carrier safety/reliability validation

---

## 1. Flight Search API Providers

### 1.1 Amadeus Self-Service API

**Overview**: Industry-leading GDS with 400+ airlines, comprehensive flight data.

| Aspect | Details |
|--------|---------|
| **Coverage** | 400+ full-service and low-cost carriers |
| **Booking** | Requires consolidator partnership for ticketing |
| **Pricing Model** | Free tier in test env + pay-per-call in production |
| **Ancillary Data** | Baggage info, seat selection, branded fares |
| **Special Features** | Flight delay prediction (ML-based), branded fares upsell API |

**Filtering Capabilities**:
- `nonStop` parameter for direct flights only
- `maxPrice` to cap ticket price
- `maxFlightTime` (percentage-based, complex)
- Layover duration: **NOT directly supported** - must filter response client-side

**Pros**:
- Deep fare rules and predictive pricing
- Comprehensive ancillary services via NDC
- Branded Fares Upsell API for upgrade pricing
- Well-documented, mature platform

**Cons**:
- Expensive for small businesses
- Requires consolidator for actual bookings
- Some filters require post-processing

**Links**: [Amadeus for Developers](https://developers.amadeus.com/self-service)

---

### 1.2 Kiwi.com Tequila API

**Overview**: Unique virtual interlining technology combining flights from 750+ carriers.

| Aspect | Details |
|--------|---------|
| **Coverage** | 750+ carriers including 250+ low-cost carriers |
| **Booking** | Direct booking supported through Kiwi |
| **Pricing Model** | Previously free tier; now **invitation-only** partnerships |
| **Virtual Interlining** | Combines flights from non-partnered airlines |
| **Ground Transport** | Includes trains, buses, ferries in routing |

**Key APIs**:
- `/locations` - Airport/city search
- `/search` - One-way/return itineraries
- `/multicity` - Multi-city itineraries
- `/nomad` - Flexible n-city ordering

**Pros**:
- Best for finding unconventional cheap routes
- Self-connect flights (virtual interlining)
- Includes ground transport options
- Direct booking capability

**Cons**:
- **Access now invitation-only** (major barrier)
- Virtual interlining carries transfer risk
- Less control over connection logistics

**Links**: [Tequila by Kiwi.com](https://tequila.kiwi.com/)

---

### 1.3 Duffel API

**Overview**: Modern, developer-first API with direct airline connections.

| Aspect | Details |
|--------|---------|
| **Coverage** | 150+ airlines via direct connections |
| **Booking** | Full booking, management, cancellation |
| **Pricing Model** | Per-booking fee (not per-search) |
| **Ancillary Data** | Baggage, lounge access, seat selection |
| **Developer Experience** | Excellent - modern REST API, SDKs in Node.js/Python/Ruby |

**Pros**:
- **No upfront costs** - pay per booking only
- Modern, clean API design
- Real-time booking confirmation
- Direct airline connections (no GDS middleman)
- Comprehensive ancillary services

**Cons**:
- Fewer airlines than GDS providers
- Newer platform (less established)
- May lack some legacy carrier coverage

**Links**: [Duffel](https://duffel.com/)

---

### 1.4 Skyscanner API

**Overview**: Popular metasearch engine with free API access.

| Aspect | Details |
|--------|---------|
| **Coverage** | Aggregates from multiple sources |
| **Booking** | Redirects to airline/OTA (no direct booking) |
| **Pricing Model** | Free tier available on RapidAPI |
| **Search Types** | Cached (fast) and Live (real-time) |

**Pros**:
- Free tier available
- Good price comparison
- Multiple language SDKs
- Easy integration

**Cons**:
- No direct booking (redirects only)
- Region availability limitations
- Less control over booking flow

**Links**: [Skyscanner API on RapidAPI](https://rapidapi.com/skyscanner/api/skyscanner-flight-search)

---

### 1.5 SerpApi (Google Flights Scraping)

**Overview**: Scrapes Google Flights UI for comprehensive results.

| Aspect | Details |
|--------|---------|
| **Coverage** | Same as Google Flights |
| **Booking** | Redirects to airlines/OTAs |
| **Pricing Model** | 200 free requests/month, then paid tiers |
| **Deep Search** | Optional for browser-identical results |

**Filtering Parameters**:
- Layover duration: min/max in minutes (e.g., "90,330")
- Excluded connecting airports
- Maximum flight duration in minutes

**Pros**:
- Best filtering parameters for layover/duration
- Google Flights comprehensive coverage
- Browser-identical results with `deep_search: true`

**Cons**:
- Scraping (TOS concerns)
- Rate limits on free tier
- No booking capability

**Links**: [SerpApi Google Flights](https://serpapi.com/google-flights-api)

---

### 1.6 SITA Flight Connection API

**Overview**: Aviation industry standard API for flight connections.

| Aspect | Details |
|--------|---------|
| **Coverage** | Comprehensive airline schedules |
| **Focus** | Connection/routing optimization |
| **Target** | Enterprise/aviation industry |

**Filtering Parameters** (Excellent):
- `minConnectionTime` / `maxConnectionTime`
- `maxElapsedTime`
- `directFlights` / `oneStop` / `twoPlusStops`
- Via airport filtering

**Pros**:
- Best connection time controls
- Industry-standard data

**Cons**:
- Enterprise pricing
- Not consumer-focused
- Schedule data only (no pricing)

---

## 2. Filtering Capabilities Comparison

| Filter | Amadeus | Kiwi | Duffel | SerpApi | SITA |
|--------|---------|------|--------|---------|------|
| **Max Stops** | `nonStop` only | Yes | Unknown | Via airports | Yes |
| **Layover Time** | Post-filter | Yes | Unknown | Yes (range) | Yes (min/max) |
| **Max Flight Duration** | % based | Unknown | Unknown | Yes (minutes) | Yes |
| **Max Price** | Yes | Yes | Yes | Unknown | No |
| **Baggage Included** | Yes (NDC) | Partial | Yes | Display only | No |
| **Excluded Airports** | No | Yes | Unknown | Yes | Yes |

---

## 3. Baggage & Ancillary Services

### NDC (New Distribution Capability) Standard

Modern APIs using IATA NDC standard provide:
- Branded fare bundles (Basic Economy, Economy Flex, etc.)
- Baggage allowance per fare
- Seat selection pricing
- Meal options
- Lounge access

**Best for baggage data**: Amadeus, Duffel, Travelport (NDC-enabled)

### Regulatory Note (US)
As of April 30, 2025, airlines must disclose ancillary fees (baggage, changes) before ticket purchase per DOT regulations.

---

## 4. Upgrade Pricing (Economy → Business)

### Available APIs

1. **Amadeus Branded Fares Upsell API**
   - Returns airline branded fare bundles
   - Shows upgrade options with pricing
   - [API Reference](https://developers.amadeus.com/self-service/category/flights/api-doc/branded-fares-upsell)

2. **Travelport Universal API**
   - Brand tier relationships
   - Upsell between fare families

3. **Aviate Book API**
   - `FindUpsellFares` endpoint
   - Branded fare upgrades
   - Cabin upgrade options

### Implementation Note
Upgrade pricing varies significantly based on:
- Flight load factor (seat availability)
- Original fare class purchased
- Timing (check-in vs. booking time)

---

## 5. Airline Safety & Reliability

### Official Blacklists

**EU Air Safety List**
- 169 airlines currently banned from EU airspace
- Updated quarterly by European Commission
- [Official List](https://transport.ec.europa.eu/transport-themes/eu-air-safety-list_en)
- **No official API** - must scrape/parse PDF or use third-party

**UK CAA Banned List**
- Similar to EU list
- [UK CAA](https://www.caa.co.uk/data-and-analysis/safety-and-security/banned-airlines-list/)

### Safety Rating Sources

| Source | Coverage | API Available |
|--------|----------|---------------|
| AirlineRatings.com | 368+ airlines, 7-star system | No (website only) |
| AirAdvisor | 300+ airlines, safety scores | No |
| IATA IOSA | Certification registry | No public API |
| FAA | US carrier compliance | No public API |

### Implementation Approach

Since no API exists for safety data, options are:
1. **Static List**: Maintain local database of EU banned carriers (update quarterly)
2. **Scrape**: Parse EU Commission PDFs (legally gray)
3. **Third-Party**: Contact aviation data providers (OAG, Cirium) for commercial data
4. **Whitelist Approach**: Only show results from known reputable carriers

---

## 6. Metasearch & Aggregator Options

### Affiliate Programs (Alternative to APIs)

| Platform | Commission Model | API Access |
|----------|-----------------|------------|
| **KAYAK** | 50% rev share | High-traffic partners only |
| **Momondo** | $0.65 desktop / $0.45 mobile CPA | Via CJ, high-traffic direct |
| **Skyscanner** | Varies | Free API on RapidAPI |
| **Hopper** | N/A | No public API |

### Google Flights
- **QPX Express API**: Shut down April 2018
- **Current options**: SerpApi scraping or Google Travel Partner API (enterprise)

---

## 7. Architecture Approaches

### Option A: Single Provider (Simplest)

```
User → Your App → Duffel API → Airlines
```

**Pros**: Simple, modern API, pay-per-booking
**Cons**: Limited to Duffel's 150 airlines

### Option B: Aggregator + Direct APIs

```
User → Your App → [Skyscanner + Amadeus] → Multiple Sources
                ↓
           Your Filters (post-processing)
```

**Pros**: Broader coverage, price comparison
**Cons**: Complex integration, multiple costs

### Option C: Scraping-Based (Google Flights)

```
User → Your App → SerpApi → Google Flights
```

**Pros**: Best filtering, comprehensive results
**Cons**: No booking, TOS concerns, scraping costs

### Option D: Hybrid Booking Flow

```
Search: SerpApi (best filters) → Display Results
Book: Deep link to airline/OTA or Duffel API
```

**Pros**: Best search experience, booking flexibility
**Cons**: Disjointed UX, two provider costs

---

## 8. Cost Comparison

| Provider | Free Tier | Paid Pricing |
|----------|-----------|--------------|
| **Amadeus** | Test env only | Contact for pricing |
| **Duffel** | N/A | Per-booking only |
| **Skyscanner** | Yes (RapidAPI) | Free |
| **SerpApi** | 200 req/month | From $50/month |
| **Kiwi Tequila** | Was free | Invitation only |
| **FlightAPI.io** | Trial | From $49/month |

---

## 9. Decisions Required

### DECISION 1: Primary API Provider

**Options**:
- **A) Duffel** - Modern, per-booking pricing, good ancillary support
- **B) Amadeus** - Most comprehensive, enterprise-grade, complex
- **C) SerpApi + Booking Links** - Best filters, no direct booking
- **D) Skyscanner (free)** - Budget option, redirects only

**Your preferences mentioned**: layover limits, stops, baggage, upgrades, carrier safety

**Recommendation**: Duffel for booking + SerpApi for advanced search filtering

---

### DECISION 2: Booking Model

**Options**:
- **A) Direct Booking** - Full flow in your app (Duffel/Amadeus)
- **B) Affiliate/Redirect** - Link to airline/OTA (Skyscanner/KAYAK)
- **C) Hybrid** - Search in-app, book via redirect

**Trade-offs**:
| Model | Revenue | UX | Complexity |
|-------|---------|-----|------------|
| Direct | Higher margin | Seamless | High |
| Affiliate | Commission only | Disjointed | Low |
| Hybrid | Mixed | Medium | Medium |

---

### DECISION 3: Layover/Stop Filtering

**Options**:
- **A) API-Native** (SerpApi/SITA) - Filters at API level
- **B) Post-Processing** (Amadeus/Duffel) - Filter results in your backend
- **C) UI Filters Only** - Let user filter displayed results

**Recommendation**: Post-processing with B offers most flexibility with better providers

---

### DECISION 4: Airline Safety Implementation

**Options**:
- **A) Static Blacklist** - Maintain EU banned carrier list locally, update quarterly
- **B) Whitelist Only** - Only show major/vetted carriers
- **C) Warning System** - Show all but flag low-rated carriers
- **D) Skip** - Leave safety research to user

---

### DECISION 5: Upgrade Pricing Display

**Options**:
- **A) Amadeus Branded Fares API** - Best data, adds cost/complexity
- **B) Show Fare Families** - Display all classes, let user compare
- **C) External Link** - Link to airline for upgrade options
- **D) Skip** - Not include initially

---

### DECISION 6: Baggage Information

**Options**:
- **A) NDC Integration** - Full ancillary data from NDC-enabled APIs
- **B) Parse Fare Rules** - Extract baggage from fare details
- **C) Static Database** - Maintain airline baggage policies locally
- **D) Display Only** - Show what API returns, no enhancement

---

### DECISION 7: Scope & MVP

**What to include in v1?**

| Feature | Include in MVP? |
|---------|-----------------|
| Basic flight search | Yes |
| Price filtering | Yes |
| Stop/layover filters | ? |
| Baggage display | ? |
| Carrier safety warnings | ? |
| Upgrade pricing | ? |
| Direct booking | ? |

---

## 10. Sources

### Flight APIs
- [Amadeus for Developers](https://developers.amadeus.com/self-service)
- [Duffel](https://duffel.com/)
- [Kiwi Tequila](https://tequila.kiwi.com/)
- [SerpApi Google Flights](https://serpapi.com/google-flights-api)
- [Skyscanner API Guide](https://www.codebridge.tech/articles/top-5-flights-apis-for-travel-apps)

### Comparisons & Guides
- [Flight API Integration Guide 2025](https://phptravels.com/blog/comprehensive-guide-to-flights-api-integration)
- [Best Travel APIs 2025](https://www.gurutechnolabs.com/best-travel-apis-for-travel-business/)
- [Amadeus vs Duffel Comparison](https://techosolution.com/detailed-comparison-of-amadeus-and-duffel-apis-for-flight-and-hotel-integration/)
- [Google Flights API History](https://duffel.com/blog/google-flights-api)

### Safety & Regulations
- [EU Air Safety List](https://transport.ec.europa.eu/transport-themes/eu-air-safety-list_en)
- [AirlineRatings.com](https://www.airlineratings.com/)
- [DOT Ancillary Fee Transparency Rule](https://www.federalregister.gov/documents/2024/04/30/2024-08609/enhancing-transparency-of-airline-ancillary-service-fees)

### Affiliate Programs
- [Travelpayouts Flight Affiliates](https://blog.travelpayouts.com/en/best-flights-affiliate-programs/)
- [KAYAK Partner Network](https://www.flightslogic.com/how-to-add-kayak-api-to-my-website.php)
