# Smart Trip Search — Implementation Plan

**Date:** 2026-08-11
**Research:** `context/research/2026-08-11_smart-trip-search_research.md`

## Confirmed decisions

| Decision | Choice |
|---|---|
| Providers | **All three from day one**: Travelpayouts (free cached surface) + Kiwi RapidAPI paid (precision) + SerpApi Google Flights (calendar fallback + price-insight cross-check) |
| Input | **Structured form first** — funnel ships behind the existing flexible-search form; NL/chat layer deferred |
| Delivery | **SSE streaming** — surface instantly, live results pushed as they land |
| Proactive | **Full alerts in v1** — watches + nightly refresh + email notifications on price drops |

## Architecture

Funnel: **L1 surface → candidate selection → L2 precise (streamed) → L3 judgement**, with every observed price persisted. (L0 NL intent deferred.)

### 1. Provider abstraction — `backend/src/modules/flights/providers/`

```ts
interface FlightProvider {
  readonly name: 'travelpayouts' | 'kiwi' | 'serpapi';
  getPriceSurface?(q: SurfaceQuery): Promise<PricePoint[]>;   // TP month-matrix, SerpApi calendar
  searchRoundTrip?(q: PreciseQuery): Promise<FlightResultDto[]>; // Kiwi (existing), SerpApi
  costPerCall: number; // for budget ledger
}
```

- `travelpayouts.provider.ts` — `GET /v2/prices/month-matrix` both directions; maps to `PricePoint {depDate, retDate?, price, observedAt, stale: true}`. Requires `TRAVELPAYOUTS_TOKEN` (affiliate signup).
- `kiwi.provider.ts` — extract HTTP + transform out of `flight-search.service.ts` (transform logic is shared and stays). First task: **probe wrapper for date-range params**; if supported, one ranged call replaces K dated calls.
- `serpapi.provider.ts` — `google_flights` engine with departure/return ranges + `trip_length`; also surfaces `price_insights`. Requires `SERPAPI_KEY`.

### 2. Persistence — new entities

- `price_observations` (id, origin, destination, departure_date, return_date nullable, nights, total_price, currency, provider, cabin, passengers, observed_at, is_estimate). Indexes: (origin, destination, departure_date), (origin, destination, observed_at).
- `trip_watches` (id, user_id FK, origin, destination, date_type, month/range, min_nights, max_nights, passengers, cabin, threshold_price nullable, last_notified_price, active, created_at).
- `api_spend_ledger` (id, provider, calls, est_cost, period_month) — budget enforcement.

### 3. Orchestrator — `search-orchestrator.service.ts`

1. Build surface: Postgres observations (< TTL) → Travelpayouts → SerpApi calendar → sparse Kiwi probes (last resort). TTLs: departures >60 days out: 48h; 14–60 days: 12h; <14 days: 4h.
2. Select top-K candidates (default K=8): cheapest date pairs satisfying `nights >= minNights && nights <= maxNights`, deduped across weeks for spread.
3. L2: Kiwi round-trip per candidate, `MAX_CONCURRENT=3`; hub exploration (existing service) only if L1/L2 shows no direct/sane-priced options; **hard per-search call cap = 25**, enforced here.
4. L3 judgement:
   - Pareto front on (total_price, total_duration = outbound + return) — fixes current outbound-only scoring.
   - Score within front; anchor cheapness to route's observation history (median for the month) not result-set min/max.
   - Emit `whyRecommended` string from real deltas (e.g. "$85 under May median, 1h10 slower than fastest").
5. Write-back: every L1/L2 price → `price_observations`.

### 4. Budget manager (evolves `api-key-manager.service.ts`)

Keeps key rotation; adds per-provider monthly caps (`BUDGET_KIWI_CALLS`, `BUDGET_SERPAPI_CALLS` env), ledger updates per call, and a `canSpend(provider, n)` gate the orchestrator must pass. On exhaustion: degrade to cache-only with a user-visible notice, never hard-fail.

### 5. SSE endpoint

- `POST /flights/smart-search` → `202 { searchId }` (validates DTO, kicks orchestrator).
- `GET /flights/smart-search/:id/stream` → NestJS `@Sse()`, events:
  - `surface` — calendar heatmap data + chosen candidates (first paint, target <1.5s warm / <4s cold)
  - `result` — one per completed L2 search (Pareto-checked incrementally)
  - `judgement` — final highlights (recommended/cheapest/fastest + reasons)
  - `done` / `error` — includes meta (calls used, cache hits, duration)
- Frontend: RTK Query streaming-updates endpoint (`onCacheEntryAdded` + EventSource); results grid fills progressively; reuse existing explore UI components where they fit.

### 6. Watches + alerts

- CRUD `POST/GET/DELETE /watches` (auth guard; guest accounts fine — a watch is a first write).
- Nightly cron (`@nestjs/schedule`, 03:00): refresh surface for active watches via **free/cheap providers only** (Travelpayouts; SerpApi only within a small reserved budget slice), append observations.
- Trigger: price below user threshold, or below 30-day trailing min by >10%. Debounce: max 1 email per watch per 24h; record `last_notified_price`.
- Email channel: Nodemailer + SMTP env config (`SMTP_URL`, `ALERT_FROM`) — provider-agnostic (works with Resend/Mailgun/Gmail app password).
- **Dependency:** merge `feat/user-accounts-auth` before watches land (later milestone anyway).

## Milestones

1. **M1 — Foundations**: provider interfaces, Travelpayouts + SerpApi adapters, Kiwi extraction, `price_observations`, budget manager + ledger. Probe Kiwi wrapper for range params. Subscribe Kiwi RapidAPI **Pro ($5/mo)**; sign up for Travelpayouts (unlocks both the free Data API **and** the Kiwi affiliate program). Append the affiliate marker to all booking deep links.
2. **M2 — Funnel**: orchestrator (surface → candidates → precise → judgement), write-back, Pareto/scoring fixes. Wire behind existing form via non-streaming endpoint first for testability.
3. **M3 — Streaming UX**: SSE endpoint + RTK Query streaming, progressive results grid, calendar heatmap from surface data, "why" labels.
4. **M4 — Proactive**: watches CRUD + UI, nightly cron, email alerts. Requires auth merge.

Each milestone gets an implement log in `context/implement/`.

## Env additions

`TRAVELPAYOUTS_TOKEN`, `SERPAPI_KEY`, `BUDGET_KIWI_CALLS`, `BUDGET_SERPAPI_CALLS`, `SMTP_URL`, `ALERT_FROM` (+ existing `RAPIDAPI_KEY(S)`).

## Cost & revenue (verified 2026-08-11)

**Costs** — Kiwi RapidAPI tiers verified live: Basic free 300 req/mo, **Pro $5/mo → 20k req**, Ultra $12/mo → 100k, Mega $27/mo → 1.4M. Personal use ≈ **$5–6/mo total**; growth ≈ $17–42/mo (Ultra + optional SerpApi Starter). Marginal search cost: Kiwi <$0.01, SerpApi $0.025/call when used; hard-capped at 25 upstream calls/search.

**Revenue** — affiliate-first: Kiwi affiliate via Travelpayouts pays **3% ≈ €11 avg per booking**; at 1 booking per 100 searches that's ~€0.11/search vs ~$0.01–0.06 cost → covers itself from the first booking. Freemium (Pro $3–5/mo: unlimited searches/watches, instant alerts, SerpApi cross-checks) when external users arrive. Direct airline deals parked: small metasearch can't get bespoke contracts; the affiliate network *is* the airline partnership at this scale. Becoming seller-of-record via NDC/Duffel ($3/order + markup) only at real volume — brings payments/refunds/support liability.
