# Flight Search API Research
**Date**: 2025-12-05

## Executive Summary

Three viable flight search API options for your travel tracking app:

| API | Free Tier | Best For | Key Limitation |
|-----|-----------|----------|----------------|
| **Amadeus** | 2,000-10,000 req/month | MVP/Development | Limited carriers on free tier |
| **Skyscanner** | Unlimited (approved) | Production scale | 2-week approval process |
| **Kiwi/Tequila** | Restricted | Budget routes | Requires 50K+ MAU |

## Recommended: Start with Amadeus

**Why Amadeus is recommended for MVP:**
1. No approval needed - register and start immediately
2. Generous free tier (2,000 searches/month)
3. Official npm package: `npm install amadeus`
4. Full feature set: search + pricing + booking
5. CO2 emissions data included

## API Comparison

### Amadeus API
- **Free Tier**: 2,000 Flight Offers Search/month, 10,000 bookings/month
- **Rate Limits**: Quota-based (no per-minute limits)
- **npm Package**: `amadeus` (official, v11.0.0)
- **Pros**: Easy setup, comprehensive features, CO2 data
- **Cons**: Limited carrier coverage on free tier (excludes Delta, AA, BA, LCCs)

### Skyscanner API
- **Free Tier**: Unlimited (affiliate commission model)
- **Rate Limits**: 100 calls/minute
- **Access**: Requires partner approval (2-week process)
- **Pros**: Free forever, 1,200+ partners, largest coverage
- **Cons**: Approval required, redirect-only booking

### Google Flights
- **Status**: No public API (discontinued 2018)
- **Alternative**: Third-party scraping services (not recommended)

## Integration Architecture

```
backend/src/modules/flight-search/
├── flight-search.controller.ts
├── flight-search.service.ts
├── providers/
│   ├── provider.interface.ts
│   ├── amadeus.provider.ts
│   └── skyscanner.provider.ts
└── dto/
    ├── search-flight.dto.ts
    └── flight-offer.dto.ts
```

## Questions for User

Before implementing, clarify:

1. **Use Case**: Search before logging? Price comparison? Booking?
2. **Geographic Focus**: US? International? Budget travelers?
3. **Integration Depth**: Display only or allow booking?
4. **Monetization**: Affiliate revenue? Freemium model?
5. **User Scale**: Personal use? Growing community?

## Resources

- Amadeus Docs: https://developers.amadeus.com/
- Amadeus npm: https://www.npmjs.com/package/amadeus
- Skyscanner Partner Portal: https://partners.skyscanner.net/
