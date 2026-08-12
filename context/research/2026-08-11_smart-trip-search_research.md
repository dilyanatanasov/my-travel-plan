# Smart Trip Search — Research

**Date:** 2026-08-11
**Feature:** "Dream search" — natural queries like *"I want to travel in May from X to Y, cheapest and shortest, stay at least 5 nights"* answered fast, with the judgement (ranking, trade-offs, recommendations) done on our side.

---

## 1. What already exists in the codebase

The `flights` module is a substantial head start — roughly half the dream is already built:

| Piece | File | What it does today |
|---|---|---|
| Flexible search DTO | `backend/src/modules/flights/dto/flexible-search.dto.ts` | Already models `dateType` (SPECIFIC / MONTH / RANGE / WEEKENDS), `minNights`/`maxNights`, passengers, cabin, hub preferences. **The "May, ≥5 nights" query maps 1:1 onto this DTO.** |
| Date sampling | `services/date-sampling.service.ts` | Turns a month/range into ~8–16 concrete (departure, return) pairs with representative durations. Sampling is **blind** — evenly spread, no price knowledge. |
| Live search | `services/flight-search.service.ts` | One-shot Kiwi round-trip/one-way search via RapidAPI, transforms itineraries, sorts by price. |
| Exploration | `services/flight-exploration.service.ts` | Fan-out: 4 date samples × 5 hubs × 4 one-way legs = **up to ~80 live API calls per search**, self-connect combination logic, scoring (price 40% / duration 35% / convenience 25%), highlights (recommended/cheapest/fastest), insights, price trend. |
| Key rotation | `services/api-key-manager.service.ts` | Multiple RapidAPI keys, rotate on 429/quota, 1h cooldown. This is a free-tier workaround, not a budget system. |
| Safety, hubs, filters | `safety.service.ts`, `hub.service.ts`, `filter.service.ts`, `data/hubs.ts` | Airline ban/caution list, curated hub graph, post-search filtering. |
| Endpoints | `flights.controller.ts` | `POST /flights/search` (specific dates), `POST /flights/explore` (flexible). Both synchronous request/response. |

Also relevant: current branch is `feat/user-accounts-auth` (guest accounts created lazily) — a prerequisite for saved searches / price watches. Airports + haversine utils exist for distance-aware logic.

### Gaps vs the dream

1. **No price memory.** Every search pays full API cost and starts from zero. Nothing is persisted, so nothing gets faster or smarter over time.
2. **Blind date sampling.** We sample 4–8 date pairs evenly across May and hope. The cheapest May date pair is likely *not* sampled. To truly answer "cheapest in May with ≥5 nights" you need the full ~27×(31−5)/2 date-pair surface — infeasible with live calls, trivial with a cached price surface.
3. **Synchronous UX.** The user stares at a spinner while up to 80 upstream calls run serially-ish (300ms delays). No progressive results.
4. **No natural-language entry.** The user must fill a form; the dream is to *say* it.
5. **No budget model.** Key rotation dodges free-tier quotas; there is no notion of "this search may spend N calls / $X" or a monthly cap.
6. **No proactivity.** Nothing watches a route, refreshes prices overnight, or alerts on drops.
7. **Scoring gaps.** `scoreAndRank` uses outbound duration only (ignores return), and min-max normalization within a single result set makes scores incomparable across searches.

---

## 2. Provider landscape (verified Aug 2026)

| Provider | Access | Cost | Fit |
|---|---|---|---|
| **Kiwi via RapidAPI** (`kiwi-com-cheap-flights.p.rapidapi.com`) — current | Self-serve, paid tiers on RapidAPI | Tier-based (e.g. ~$10–50/mo for thousands of requests) | Already integrated. Good itinerary detail + booking deep links + self-transfer routing. Unofficial wrapper → stability risk. |
| **Kiwi Tequila (official)** | **Invite-only partner program; no self-serve signups** | — | The official API had native `nights_in_dst_from/to` + date ranges (exactly our query shape), but we can't get keys. |
| **Amadeus Self-Service** | **Closed to new signups since 2026-07-17; Enterprise only** | — | Not viable for us. |
| **SerpApi Google Flights** | Self-serve | **~$50 / 1,000 searches** (plan-based) | Google Flights quality data; supports **date-range departure/return windows + `trip_length`**, price insights ("prices are low/typical/high"), calendar-style data. Best "judgement-grade" data per call. No booking links to airlines resolved. |
| **Travelpayouts / Aviasales Data API** | Free with affiliate signup | **~Free** (affiliate model) | **`/v2/prices/month-matrix`** returns cheapest price per day of a month from a 48h–7d cache of real user searches. Perfect cheap "price surface" seed. Weakness: cached/stale, patchy coverage on thin routes, price-only (no full itinerary). |
| **Duffel** | Self-serve | $3/confirmed order + excess search fee after 1,500:1 search:book ratio | Built for *booking* flows, punishes metasearch-style fan-out. Wrong shape for us now; interesting only if we ever sell tickets. |

Sources: [Thunderbit flight API comparison 2026](https://thunderbit.com/blog/best-flight-api-with-free-tiers), [ScrapingBee top flight APIs](https://www.scrapingbee.com/blog/top-flights-apis-for-travel-apps/), [Duffel pricing comparison](https://duffel.com/why-duffel/tequila-by-kiwi-vs-duffel), [SerpApi Google Flights API](https://serpapi.com/google-flights-api), [SerpApi pricing](https://serpapi.com/pricing), [Travelpayouts month-matrix](https://support.travelpayouts.com/hc/en-us/articles/203956163-Aviasales-Data-API), [Amadeus cheapest-date API (enterprise)](https://developers.amadeus.com/self-service/category/flights/api-doc/flight-cheapest-date-search).

**Key insight:** no affordable provider answers "cheapest + shortest in May with ≥5 nights" in one call. The differentiation *is* the orchestration: a cheap wide layer to find *where* to look, and an expensive narrow layer to look *precisely there*.

---

## 3. Proposed architecture — the funnel

```
"travel in May, SOF→NRT, ≥5 nights, cheap & short"
        │
        ▼
┌──────────────────────────────────────────────────┐
│ L0 · INTENT   LLM parse → FlexibleSearchDto      │  <1s, ~$0.001
│               ("May" → 2027-05, minNights=5)     │
├──────────────────────────────────────────────────┤
│ L1 · SURFACE  price-per-day for whole month      │  instant if cached
│               (month-matrix / calendar / stored  │  1–3 cheap calls if not
│               observations in Postgres)          │
│               → pick top-K candidate date pairs  │
│                 that satisfy nights ≥ 5          │
├──────────────────────────────────────────────────┤
│ L2 · PRECISE  live Kiwi round-trip on K≈6–10     │  5–15s, streamed
│               date pairs (+ hub exploration      │
│               only where L1 says it's worth it)  │
├──────────────────────────────────────────────────┤
│ L3 · JUDGE    Pareto front (price × total time), │  local, instant
│               normalized scoring, top-3 picks    │
│               with plain-language "why"          │
└──────────────────────────────────────────────────┘
        │ every result observed at L1/L2 is written back to
        ▼ price_observations → the system gets smarter/cheaper over time
```

### New backend pieces

- **`price_observations` table** (route, dep_date, ret_date/nights, price, provider, observed_at, trip fingerprint). Every API response — surface or precise — is recorded. Powers: instant cached answers, price history charts, "is this a good price?" judgement, alert diffing.
- **`SearchOrchestratorService`** — owns the funnel, the call budget for a search (e.g. "max 12 upstream calls"), and candidate selection (top-K by surface price, deduped, constraint-checked).
- **`BudgetManagerService`** — evolution of `ApiKeyManagerService`: per-provider monthly spend caps, per-search call caps, spend ledger in Postgres, graceful degradation to cache-only when exhausted.
- **`IntentParserService`** — Claude Haiku 4.5 with a JSON-schema tool → `FlexibleSearchDto` + optimization weights; deterministic fallback to the existing form. Resolves relative dates ("May" → next future May = 2027-05).
- **Progressive delivery** — search becomes a two-phase API: instant response from L1 (`surface` block: calendar heatmap + candidates), then L2 results streamed via SSE (or polled job status) as each live search lands.
- **Trip watches (proactive)** — `trip_watches` table tied to user accounts; nightly cron refreshes the L1 surface for watched routes (cheap calls only), records history, fires alert when price drops below user threshold or 7-day trailing min.

### Scoring/judgement fixes (L3)

- Use **total** round-trip duration (current code ignores return leg).
- Pareto-front first (never recommend an option that is worse on both price and time than another), then score within the front.
- Anchor "is this cheap?" against the route's own observation history (median May price for this route), not just within-result-set min/max.
- Every recommendation carries a one-line reason computed from real deltas ("$85 under the May median, 1h10 slower than fastest").

---

## 4. Cost model (example: one cold "May, SOF→NRT" search)

| Layer | Calls | Cost est. |
|---|---|---|
| L0 intent (Haiku) | 1 LLM call | ~$0.001 |
| L1 surface (Travelpayouts month-matrix ×2 directions) | 2 | ~$0 |
| L1 fallback/upgrade (SerpApi calendar range) | 0–2 | $0–0.10 |
| L2 precise (Kiwi round-trip × 8 candidates) | 8 | within RapidAPI paid tier |
| L2 hub exploration (only if L1 shows bad directs) | 0–20 | tier |
| **Total** | **~11–33 calls** | **≈ $0.05–0.30** |

Warm search (surface cached from a prior user/cron): L2 only, ~8 calls, first paint <1s.
Compare: today's `/flights/explore` fires up to 80 live calls with blind dates and no reuse.

### Monthly cost scenarios

Subscription prices verified Aug 2026. **RapidAPI Kiwi tiers verified live on the pricing page** (`rapidapi.com/emir12/api/kiwi-com-cheap-flights/pricing`, checked 2026-08-11 via browser):

| Tier | Price | Requests/mo | Overage |
|---|---|---|---|
| Basic | $0 | 300 (hard limit, 1000/hr rate limit) | — |
| **Pro** | **$5/mo** | **20,000** | $0.005/req |
| Ultra | $12/mo | 100,000 | $0.0004/req |
| Mega | $27/mo | 1,400,000 | $0.00003/req |

(All tiers: 10 GB/mo bandwidth included, then $0.001/MB.)

SerpApi: Free 250 searches/mo, **Starter $25/mo (1k)**, **Developer $75/mo (5k)**. Travelpayouts: **$0** (affiliate). Claude Haiku intent parsing ≈ $0.001/search.

| Scenario | Volume | Kiwi (RapidAPI) | SerpApi | Travelpayouts | LLM | **Total/mo** |
|---|---|---|---|---|---|---|
| **Personal** (you + friends) | ~100 searches, 20 watched routes | ~1.5–3k calls → **Pro $5** | free tier **$0** | $0 | <$1 | **≈ $5–6** |
| **Growth** | ~1,000 searches, 200 watches | ~15–30k calls → **Ultra $12** | Starter **$25** (optional cross-check) | $0 | ~$5 | **≈ $17–42** |
| Marginal per search | — | Kiwi <$0.01 even cold; SerpApi $0.025/call when used | | | | cold ≈ $0.01–0.06, warm ≈ $0 |

The only meaningful marginal cost is SerpApi; Kiwi at Pro/Ultra tier is effectively free per search. Structural levers: (1) wide/recurring work (month surfaces, nightly watch refreshes) rides the **free** Travelpayouts cache, and (2) every paid response is written to `price_observations`, so repeat searches on popular routes trend to $0.

---

## 7. Monetization — covering (and beating) the cost

Costs above are so low that modest revenue covers them. Options, in order of practicality:

**A. Affiliate commissions on bookings (zero-friction, do first).**
The Kiwi booking deep links we already return can carry an affiliate marker. Kiwi.com's program (joined via Travelpayouts — the same signup that unlocks the free Data API) pays **3% of ticket price, avg ≈ €11 per booking**; other Travelpayouts flight programs pay 1–6%, Aviasales ≈ 1.1–1.3% effective. Math: at a conservative 1 booking per 100 smart searches, revenue ≈ **€0.11/search** vs marginal cost ≈ $0.01–0.06/search → **profitable from the first booking**; one booking pays for ~200+ cold searches. No user-facing change, no payment infra.

**B. Freemium subscription (when strangers start using it).**
Free: N smart searches/mo + a few watches. Pro ($3–5/mo): unlimited searches, unlimited watches, instant alerts, SerpApi-grade cross-checks. Watches/alerts are the natural premium — recurring value, near-zero marginal cost (free surface calls). Gate the expensive SerpApi calls to paid users if margins ever pinch.

**C. Direct airline partnerships (the user's instinct — parked, with reasons).**
Airlines do not strike bespoke deals with small metasearch sites; their distribution runs through GDS/NDC pipes and affiliate networks, and even airline-direct affiliate rates are only 1–2%. The *practical* form of "partnering with airlines" today **is** the affiliate network — Travelpayouts aggregates 100+ airline/OTA programs behind one contract. The genuine direct-partnership play is becoming a seller of record via NDC (e.g. Duffel at $3/confirmed order) and earning a markup — but that brings payments, refunds, schedule-change support and liability. Revisit only at real volume.

Sources: [Kiwi.com affiliate program](https://www.travelpayouts.com/en/offers/kiwi-affiliate-program), [Kiwi commission details](https://getlasso.co/affiliate/kiwi/), [Travelpayouts flight programs](https://www.travelpayouts.com/blog/best-flights-affiliate-programs/), [Aviasales program](https://www.affiliates-directory.com/websites/aviasales).

---

## 5. Challenges & constraints

- **RapidAPI Kiwi wrapper stability** — unofficial; endpoints/params can change. Mitigate: provider interface (`FlightProvider`) so Kiwi/SerpApi are swappable adapters; record raw responses for replay.
- **Date-range params on the RapidAPI wrapper** — the official Kiwi API supports departure ranges + nights-at-destination natively; whether this wrapper exposes them needs a probe. If yes, L2 gets dramatically cheaper (one ranged call replaces K dated calls).
- **Cache staleness → price surprises** — surface prices are 48h–7d old; always label cached prices as estimates and re-verify the winner live before showing the booking link.
- **Thin routes** — month-matrix may be empty for SOF→NRT-class routes; fallback chain: Travelpayouts → SerpApi calendar → sparse live probing (current blind sampling as last resort).
- **Budget runaway** — hub exploration multiplies calls; hard per-search cap enforced by orchestrator, not by hope.
- **Auth dependency** — watches/alerts need accounts; `feat/user-accounts-auth` branch provides them (guest accounts lazily created on first write — a watch is a write).

---

## 6. Decisions needed before planning (Phase 2)

1. **Provider mix** — Travelpayouts (free surface) + Kiwi paid (precision)? Add SerpApi now or later?
2. **Natural-language input** — Claude-powered chat-style entry from day one, or structured "smart form" first with NL added after?
3. **Delivery mechanism** — SSE streaming vs. job + polling for progressive results.
4. **Proactive scope v1** — surface caching + price history only, or full watches with alerts (email/push) in the first cut?
