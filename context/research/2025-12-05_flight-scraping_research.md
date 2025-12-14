# Flight Data Scraping - Research

**Date**: 2025-12-05
**Goal**: Scrape flight search results instead of using paid APIs

---

## Why Scraping Instead of API?

- Skyscanner RapidAPI has been **discontinued**
- Alternative APIs are unreliable or paid
- Scraping gives full control over data extraction
- No API rate limits or costs

---

## Scraping Options

### Option A: Puppeteer/Playwright (Headless Browser)

**How it works:**
- Launch headless Chrome/Firefox
- Navigate to Google Flights or Skyscanner
- Fill search form programmatically
- Wait for results to load
- Extract flight data from DOM

**Pros:**
- Handles JavaScript-rendered content
- Can bypass some anti-bot measures
- Full browser capabilities

**Cons:**
- Heavy resource usage (memory/CPU)
- Slower than direct HTTP requests
- Requires browser binary in Docker
- Sites actively detect headless browsers

**Libraries:**
- `puppeteer` (Node.js) - Chrome DevTools Protocol
- `playwright` (Node.js) - Multi-browser support

---

### Option B: Direct HTTP + Reverse Engineering

**How it works:**
- Analyze network requests in browser DevTools
- Identify the actual API calls sites make internally
- Replicate those calls with proper headers/cookies
- Parse JSON responses directly

**Pros:**
- Much faster than headless browser
- Lower resource usage
- Direct JSON data (no DOM parsing)

**Cons:**
- Requires reverse-engineering each site
- Headers/tokens may expire or rotate
- Sites can change internal APIs anytime
- May require session/cookie management

---

### Option C: Third-Party Scraping Services

**Services:**
- **ScraperAPI** - Handles proxies and CAPTCHAs
- **Bright Data** - Residential proxies + scraping
- **Apify** - Pre-built scrapers marketplace

**Pros:**
- Handle anti-bot measures
- Proxy rotation included
- Often have pre-built flight scrapers

**Cons:**
- Monthly costs ($30-500+)
- Still dependent on external service

---

### Option D: Mock Data for Development

**How it works:**
- Create realistic mock flight data
- Store in JSON files or database
- Build full UI/UX without real API dependency
- Add real scraping later as enhancement

**Pros:**
- Zero external dependencies
- Fast development cycle
- Predictable test data
- Can demo full feature immediately

**Cons:**
- Not real data
- Need to implement real scraping eventually

---

## Target Sites for Scraping

| Site | Difficulty | Data Quality | Anti-Bot |
|------|------------|--------------|----------|
| Google Flights | Hard | Excellent | Strong |
| Skyscanner | Medium | Excellent | Medium |
| Kayak | Medium | Good | Medium |
| Momondo | Easy | Good | Light |
| Kiwi.com | Easy | Good | Light |

---

## Recommended Approach

### For MVP: **Option D (Mock Data)**

1. Create realistic flight dataset with varied prices, airlines, stops
2. Build complete frontend search/filter experience
3. Backend returns mock data based on search params
4. User can test full UI workflow

### For Production: **Option B (Reverse Engineering) or Option C**

- Once UI is stable, add real scraping
- Start with easier targets (Kiwi.com, Momondo)
- Consider third-party service if anti-bot becomes issue

---

## Mock Data Structure

```typescript
// Example mock flight data
const mockFlights = [
  {
    id: "mock-1",
    airline: "United Airlines",
    airlineCode: "UA",
    flightNumber: "UA 123",
    departure: {
      airport: "JFK",
      city: "New York",
      time: "2025-01-15T08:00:00",
    },
    arrival: {
      airport: "LAX",
      city: "Los Angeles",
      time: "2025-01-15T11:30:00",
    },
    duration: 330, // minutes
    stops: 0,
    price: 299,
    currency: "USD",
    cabinClass: "economy",
    bookingUrl: "https://example.com/book",
  },
  // ... more flights
];
```

---

## Questions for Decision

1. **Do you want mock data first** to build the full UI, then add real scraping later?

2. **Or do you want real scraping now** using Puppeteer/Playwright (slower but real data)?

3. **Which sites to target** if going with scraping? (Kiwi.com is easiest)

---

## Legal Considerations

- Most sites' ToS prohibit scraping
- For personal/educational use: generally tolerated
- For commercial use: may need to use official APIs or partnerships
- Respect rate limits to avoid IP bans
