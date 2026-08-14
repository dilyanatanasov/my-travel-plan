import { useEffect, useMemo, useRef, useState } from 'react';
import type { Alpha3 } from '../../types';
import {
  aggregateRoutes,
  extractUniqueAirports,
  type AggregatedRoute,
} from '../FlightMap/routeUtils';
import type { CountryDisplayInfo } from './countryColors';
import {
  legFlightSeconds,
  STOP_PAUSE_SECONDS,
  type ReplayState,
} from './useJourneyReplay';
import { formatJourneyDate } from '../../utils/journeyDate';

/** Everything the postcard needs to render at the arrival city. */
export interface ReplayPostcard {
  legId: number;
  key: number;
  lon: number;
  lat: number;
  /** Caption: city (or IATA) plus the journey's precision-aware date. */
  caption: string;
}

/**
 * Everything the replay narrates on top of the base map: countries revealed
 * so far, the landing flash, the airport pop, the year chapter chip, and the
 * played-so-far routes/airports the layers draw instead of the full history.
 *
 * Extracted from TravelMap (2026-08-13 consolidation) purely as a move — the
 * timers, guards and comments are the originals. Both map modes consume it:
 * the flat map directly, the globe through the same props TravelMap passes.
 */

export interface ReplayOrchestration {
  /** Alpha-3 of the country flashing because the plane just landed. */
  landedIsoCode: string | null;
  /** Airport whose own marker pops as the replay plane reaches it. */
  popAirport: { iata: string; key: number } | null;
  /** Year chapter: flashes when the replay crosses into a new year. */
  yearChip: string | null;
  /** The stop whose postcard is showing (trip photos, 2026-08-14). */
  postcard: ReplayPostcard | null;
  /** Display map holding only the countries revealed so far this replay. */
  replayCountryDisplayMap: Map<string, CountryDisplayInfo>;
  replayRoutes: AggregatedRoute[];
  replayMaxRouteCount: number;
  replayAirports: ReturnType<typeof extractUniqueAirports>;
}

export function useReplayOrchestration(
  replay: ReplayState,
  countries: { isoCode: string; isoCode2: string }[],
  /** Legs that have photos — arrivals there show a postcard. */
  photoLegIds?: Set<number>,
): ReplayOrchestration {
  /*
    Countries revealed so far in this replay.

    The map starts blank: no visited fills at all, so the colour spreading is
    the story. A departure country appears as its journey begins — you were
    already there — and an arrival appears the moment the plane lands, which
    is when the flash fires. Flashing a country that was already orange was
    invisible, which is why this had to change rather than just get brighter.
  */
  const [revealedIsos, setRevealedIsos] = useState<Set<string>>(new Set());

  /*
    Light up the destination as the plane arrives.

    Timed off the flight duration rather than an animation event: SMIL's
    endEvent is awkward to hang React state off, and the duration is already
    known exactly. The country's alpha-3 comes from the countries list, since
    airports store alpha-2 and the map keys on alpha-3.
  */
  const [landedIsoCode, setLandedIsoCode] = useState<string | null>(null);
  const [popAirport, setPopAirport] = useState<{
    iata: string;
    key: number;
  } | null>(null);
  const [yearChip, setYearChip] = useState<string | null>(null);
  const [postcard, setPostcard] = useState<ReplayPostcard | null>(null);
  const lastYearRef = useRef<string | null>(null);
  /*
    Countries already lit during this replay.

    The glow marks a discovery — the first time a flight puts you somewhere.
    Firing it on every landing means a home airport flashes on most steps,
    which turns a moment into a tic.
  */
  const landedBeforeRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!replay.isActive) {
      landedBeforeRef.current.clear();
      lastYearRef.current = null;
      setRevealedIsos(new Set());
      setPopAirport(null);
      setYearChip(null);
      setPostcard(null);
    }
  }, [replay.isActive]);

  const alpha2ToAlpha3 = useMemo(() => {
    const map = new Map<string, string>();
    for (const country of countries) map.set(country.isoCode2, country.isoCode);
    return map;
  }, [countries]);

  useEffect(() => {
    setLandedIsoCode(null);
    setPopAirport(null);
    // Cleared here, not only by its own timer: that timer dies with this
    // journey's cleanup, so a card shown near a step's end would otherwise
    // survive into the next journey (the "doesn't disappear" report).
    setPostcard(null);
    if (!replay.isActive || !replay.current) return;

    const legs = [...replay.current.legs].sort((a, b) => a.legOrder - b.legOrder);
    if (legs.length === 0) return;

    /*
      Same clock the plane flies on: each leg's own sqrt-distance seconds
      plus the ground stop before it — so every flash and pop fires at the
      moment of touchdown, not at an equal-split guess.
    */
    const legSecs = legs.map((leg) =>
      legFlightSeconds(Number(leg.distanceKm) || 0),
    );
    const arrivalMsAt = (index: number) =>
      (legSecs.slice(0, index + 1).reduce((a, b) => a + b, 0) +
        STOP_PAUSE_SECONDS * index) *
      1000;

    const timers: number[] = [];

    // Year chapter beat, at the step's start — only when the year changes,
    // so a busy year reads as one chapter, not a strobe. Undated journeys
    // (sequenced last) simply have no chapter.
    const year = replay.current.journeyDate?.slice(0, 4) ?? null;
    if (year && year !== lastYearRef.current) {
      lastYearRef.current = year;
      setYearChip(year);
      timers.push(window.setTimeout(() => setYearChip(null), 1900));
    }

    /*
      Each stop's own marker pops as the plane reaches it — sequentially,
      matching the country reveals' timing, so a three-leg journey greets
      you at every connection, not just the destination.
    */
    legs.forEach((leg, index) => {
      const airport = leg.arrivalAirport;
      if (!airport) return;
      const at = arrivalMsAt(index);
      timers.push(
        window.setTimeout(() => {
          setPopAirport({ iata: airport.iataCode, key: Date.now() });
        }, at),
      );
      /*
        The postcard (trip photos): where a stop has a photo, it pops at
        the arrival city as the plane lands and holds through the ground
        pause — a memory at the moment of arrival.
      */
      const lon = Number(airport.longitude);
      const lat = Number(airport.latitude);
      if (
        leg.id &&
        photoLegIds?.has(leg.id) &&
        Number.isFinite(lon) &&
        Number.isFinite(lat)
      ) {
        /*
          The journey's own note captions the postcard when there is one —
          "Honeymoon, day 3" beats "Barcelona · May 2023" (user call,
          2026-08-14); the place · date remains the fallback. One line,
          ellipsized to what the band can hold.
        */
        const date = replay.current ? formatJourneyDate(replay.current) : null;
        const place = airport.city || airport.iataCode;
        const note = replay.current?.notes?.trim();
        const fallback = date ? `${place} · ${date}` : place;
        const raw = note || fallback;
        const caption = raw.length > 28 ? `${raw.slice(0, 27)}…` : raw;
        timers.push(
          window.setTimeout(() => {
            setPostcard({ legId: leg.id, key: Date.now(), lon, lat, caption });
          }, at),
        );
        timers.push(window.setTimeout(() => setPostcard(null), at + 3200));
      }
    });

    /**
     * Put a country on the map, flashing it the first time it is touched.
     *
     * "First time" is per replay, not per journey, so a home airport does not
     * strobe on every step — but every country still lights up once, whether
     * it is an origin, a connection or a destination.
     */
    const reveal = (iso3: string) => {
      setRevealedIsos((current) =>
        current.has(iso3) ? current : new Set(current).add(iso3)
      );
      if (landedBeforeRef.current.has(iso3)) return;
      landedBeforeRef.current.add(iso3);
      setLandedIsoCode(iso3);
      // Release it so the fill transitions back and reads as a flash rather
      // than a permanent state change.
      timers.push(
        window.setTimeout(() => setLandedIsoCode(null), 1400)
      );
    };

    const isoOf = (code: string | null) =>
      code ? alpha2ToAlpha3.get(code) : undefined;

    // You are already standing in the origin when the journey begins.
    const origin = isoOf(legs[0].departureAirport.countryIso);
    if (origin) reveal(origin);

    /*
      Every stop, in order, spread across the flight window — a connection is
      somewhere you were, and skipping it meant a two-leg journey lit up its
      origin and destination while the country in the middle stayed dark.
    */
    legs.forEach((leg, index) => {
      const iso3 = isoOf(leg.arrivalAirport.countryIso);
      if (!iso3) return;
      const at = arrivalMsAt(index);
      timers.push(window.setTimeout(() => reveal(iso3), at));
    });

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [replay.isActive, replay.current, alpha2ToAlpha3, photoLegIds]);

  const replayCountryDisplayMap = useMemo(() => {
    const map = new Map<string, CountryDisplayInfo>();
    for (const iso of revealedIsos) {
      map.set(iso, {
        isoCode: iso as Alpha3,
        visitType: 'trip',
        isHome: false,
        hasFlights: true,
        visit: null,
      });
    }
    return map;
  }, [revealedIsos]);

  /*
    During replay the map draws only what has been flown so far, so the trail
    accumulates instead of being fully present and merely dimmed. Recomputed
    per step, which is cheap: aggregateRoutes runs over a growing slice, not
    the whole history each time.
  */
  const replayRoutes = useMemo(
    () => (replay.isActive ? aggregateRoutes(replay.played) : []),
    [replay.isActive, replay.played]
  );
  const replayMaxRouteCount = Math.max(
    ...replayRoutes.map((route) => route.count),
    1
  );
  const replayAirports = useMemo(
    () => (replay.isActive ? extractUniqueAirports(replay.played) : []),
    [replay.isActive, replay.played]
  );

  return {
    landedIsoCode,
    popAirport,
    yearChip,
    postcard,
    replayCountryDisplayMap,
    replayRoutes,
    replayMaxRouteCount,
    replayAirports,
  };
}
