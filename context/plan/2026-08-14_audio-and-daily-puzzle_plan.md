# Replay audio + daily country guesser — plan (confirmed 2026-08-14)

**Decisions (user-confirmed):** replay sound ON by default, quiet, mute in
the replay bar, choice remembered; the daily puzzle is playable by ANYONE
(no account — top-of-funnel per the D6 research, streaks in localStorage);
shareable emoji-grid result included.

## A. Cockpit audio (small)

WebAudio, fully synthesized — no assets, no licensing, no bundle weight:
- Engine hum: looped noise buffer → lowpass (~110Hz) → gain (~0.04),
  running while the replay is active and unmuted. Starts inside the Play
  click's gesture window, so autoplay policy is satisfied.
- Seatbelt chime: hi–lo two-tone sine with a soft envelope, fired on each
  arrival (piggybacks the existing popAirport beat, so flat and globe get
  it for free from TravelMap).
- `useReplayAudio` hook owns the AudioContext lifecycle; mute toggle in
  the replay bar (both modes, existing surface — density budget respected);
  preference in localStorage `contrail:replay-muted`.

## B. Daily country guesser (/daily, public)

Zero backend for v1 — everything the game needs is already client-side:
- Shape: the map's TopoJSON (module-cached loader) rendered as a lone
  silhouette via d3 fitSize. Name list for autocomplete from the same
  geographies; distance (geoDistance → km) and 8-way compass direction
  from centroids.
- Daily pick: deterministic from the UTC date — everyone worldwide gets
  the same country; puzzle #N counts days since launch (2026-08-13).
- Six guesses, Worldle-style hints per miss (distance + direction +
  proximity squares); win/lose → countdown to next UTC midnight.
- localStorage: per-day guess state + streak stats. No accounts touched.
- Share: "myContrail daily #N — n/6" + emoji rows + link with ?ref=daily
  (Umami attribution), via native share/clipboard.
- Signup nudge under the finished puzzle → /register?ref=daily.
- Analytics: daily_play {result, tries} — kinds and counts only.
- Entry: icon link in the header next to "Where to next?" (icon-only on
  mobile, same pattern); the shared link is the main door.

## Out of scope

Server-side streaks/leaderboards, per-user puzzle history, difficulty
filtering of tiny countries (v2 candidates).
