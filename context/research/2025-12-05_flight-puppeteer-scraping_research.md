# Flight Scraping with Puppeteer/Playwright - Research

**Date**: 2025-12-05
**Approach**: Headless browser scraping for flight search results

---

## Technology Choice: Playwright vs Puppeteer

| Feature | Puppeteer | Playwright |
|---------|-----------|------------|
| Browser Support | Chrome only | Chrome, Firefox, Safari |
| Auto-wait | Manual | Built-in |
| API Design | Older | Modern, cleaner |
| Maintenance | Google | Microsoft |
| Docker Support | Good | Excellent |
| Anti-detection | Requires plugins | Better stealth built-in |

**Recommendation**: **Playwright** - better anti-detection, cleaner API, multi-browser support

---

## Target Site Analysis

### Google Flights
- **URL**: `https://www.google.com/travel/flights`
- **Difficulty**: Hard
- **Anti-bot**: Strong (reCAPTCHA, fingerprinting)
- **Data quality**: Excellent
- **Verdict**: Avoid - too aggressive anti-bot

### Skyscanner
- **URL**: `https://www.skyscanner.com`
- **Difficulty**: Medium
- **Anti-bot**: Medium (Cloudflare, behavior analysis)
- **Data quality**: Excellent
- **Verdict**: Possible with stealth techniques

### Kayak
- **URL**: `https://www.kayak.com`
- **Difficulty**: Medium
- **Anti-bot**: Medium
- **Data quality**: Good
- **Verdict**: Decent option

### Kiwi.com
- **URL**: `https://www.kiwi.com`
- **Difficulty**: Easy
- **Anti-bot**: Light
- **Data quality**: Good
- **Verdict**: **Best for scraping** - lenient, good data

### Momondo
- **URL**: `https://www.momondo.com`
- **Difficulty**: Easy
- **Anti-bot**: Light (owned by Kayak)
- **Data quality**: Good
- **Verdict**: Good backup option

---

## Recommended Target: Kiwi.com

**Why Kiwi.com:**
1. Minimal anti-bot measures
2. Clean URL structure for searches
3. Good flight coverage worldwide
4. Prices include all fees
5. Unique "virtual interlining" (mixing airlines)

**Search URL Pattern:**
```
https://www.kiwi.com/en/search/results/{origin}/{destination}/{date}
```

**Example:**
```
https://www.kiwi.com/en/search/results/new-york-city-new-york-united-states/london-united-kingdom/2025-01-15
```

---

## Playwright Implementation Approach

### 1. Dependencies

```json
{
  "dependencies": {
    "playwright": "^1.40.0",
    "playwright-extra": "^4.3.6",
    "puppeteer-extra-plugin-stealth": "^2.11.2"
  }
}
```

### 2. Basic Scraping Flow

```typescript
import { chromium } from 'playwright';

async function scrapeFlights(origin: string, destination: string, date: string) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();

  // Navigate to search results
  const url = `https://www.kiwi.com/en/search/results/${origin}/${destination}/${date}`;
  await page.goto(url, { waitUntil: 'networkidle' });

  // Wait for flight cards to load
  await page.waitForSelector('[data-test="ResultCardWrapper"]', { timeout: 30000 });

  // Extract flight data
  const flights = await page.evaluate(() => {
    const cards = document.querySelectorAll('[data-test="ResultCardWrapper"]');
    return Array.from(cards).map(card => {
      // Extract data from each card
      return {
        price: card.querySelector('[data-test="ResultCardPrice"]')?.textContent,
        duration: card.querySelector('[data-test="TripDuration"]')?.textContent,
        // ... more fields
      };
    });
  });

  await browser.close();
  return flights;
}
```

### 3. Docker Considerations

Playwright requires browser binaries. Options:

**Option A: Install in Dockerfile**
```dockerfile
FROM node:20-slim

# Install Playwright dependencies
RUN npx playwright install-deps chromium
RUN npx playwright install chromium

COPY . .
RUN npm install
```

**Option B: Use Playwright Docker image**
```dockerfile
FROM mcr.microsoft.com/playwright:v1.40.0-jammy

WORKDIR /app
COPY . .
RUN npm install
```

---

## Anti-Detection Techniques

### 1. Stealth Plugin
```typescript
import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';

chromium.use(stealth());
```

### 2. Random Delays
```typescript
// Human-like delays between actions
await page.waitForTimeout(Math.random() * 2000 + 1000);
```

### 3. Realistic Browser Context
```typescript
const context = await browser.newContext({
  userAgent: getRandomUserAgent(),
  viewport: { width: 1920, height: 1080 },
  locale: 'en-US',
  timezoneId: 'America/New_York',
  geolocation: { latitude: 40.7128, longitude: -74.0060 },
  permissions: ['geolocation'],
});
```

### 4. Proxy Rotation (if needed)
```typescript
const browser = await chromium.launch({
  proxy: {
    server: 'http://proxy-server:8080',
    username: 'user',
    password: 'pass',
  }
});
```

---

## Data Extraction Strategy

### Kiwi.com DOM Structure (as of Dec 2024)

```
ResultCardWrapper
├── Airline logos
├── Departure time + Airport
├── Duration + Stops indicator
├── Arrival time + Airport
├── Price
└── Book button (contains deep link)
```

### Fields to Extract

| Field | Selector (approximate) | Type |
|-------|----------------------|------|
| Price | `[data-test="ResultCardPrice"]` | string |
| Departure time | `.departure-time` | string |
| Arrival time | `.arrival-time` | string |
| Duration | `[data-test="TripDuration"]` | string |
| Stops | `.stops-count` | number |
| Airlines | `.carrier-logo img[alt]` | string[] |
| Booking link | `a[data-test="BookingButton"]` | URL |

**Note**: Selectors may change. Need to verify during implementation.

---

## Caching Strategy

Scraping is slow (5-15 seconds per search). Implement caching:

```typescript
// Cache key: origin-destination-date
const cacheKey = `${origin}-${destination}-${date}`;
const cacheTTL = 15 * 60 * 1000; // 15 minutes

// Check cache before scraping
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

// Scrape and cache
const results = await scrapeFlights(origin, destination, date);
await redis.setex(cacheKey, cacheTTL, JSON.stringify(results));
```

---

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| Timeout | Slow load / blocked | Retry with different user agent |
| No results | Bad selectors / site change | Log page HTML, alert for review |
| CAPTCHA | Detection | Use stealth plugin, slow down |
| IP blocked | Too many requests | Add delays, use proxy |

---

## Performance Considerations

| Metric | Expected Value |
|--------|----------------|
| Cold start | 3-5 seconds (browser launch) |
| Page load | 5-10 seconds |
| Data extraction | 1-2 seconds |
| **Total per search** | **10-15 seconds** |

**Mitigation:**
- Keep browser instance alive (reuse between requests)
- Aggressive caching (15-30 min TTL)
- Show loading state with progress to user

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Frontend (React)                       │
│  Search Form → Loading Spinner (10-15s) → Results List   │
└────────────────────────┬─────────────────────────────────┘
                         │ POST /api/flights/search
                         ▼
┌──────────────────────────────────────────────────────────┐
│                   Backend (NestJS)                        │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────┐ │
│  │   Cache     │───▶│ ScraperSvc   │───▶│  Playwright │ │
│  │  (Redis)    │    │              │    │  (Browser)  │ │
│  └─────────────┘    └──────────────┘    └─────────────┘ │
└──────────────────────────────────────────────────────────┘
                                                 │
                                                 ▼
                                          ┌─────────────┐
                                          │  Kiwi.com   │
                                          └─────────────┘
```

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Site blocks scraping | Feature breaks | Have backup site (Momondo) |
| Selectors change | Data extraction fails | Monitor & alert, easy selector config |
| Slow performance | Bad UX | Aggressive caching, loading states |
| Legal issues | N/A for personal use | Don't commercialize without API |

---

## Questions Resolved

1. **Which library?** → Playwright (better stealth, cleaner API)
2. **Which site?** → Kiwi.com (easiest to scrape, good data)
3. **How to handle Docker?** → Use Playwright official Docker image
4. **How to handle speed?** → Caching + loading states

---

## Next Steps

1. Create implementation plan based on this research
2. Set up Playwright in backend
3. Build scraper service for Kiwi.com
4. Add caching layer
5. Build frontend search UI
