import { describe, it, expect } from 'vitest';
import {
  clusterByScreenDistance,
  stopClusterAnchor,
  STOP_CLUSTER_PX,
} from './routeUtils';
import type { Airport } from '../../types';

const stop = (
  id: number,
  iataCode: string,
  city: string | null = null,
): Airport => ({
  id,
  iataCode,
  icaoCode: null,
  name: iataCode,
  city,
  country: null,
  countryIso: 'BG',
  latitude: 0,
  longitude: 0,
  createdAt: '',
});

/* Cities pose as airports with a NEGATIVE id and their name in the
   iataCode slot - the map's one vocabulary. */
const VAR_AIRPORT = stop(4325, 'VAR', 'Varna');
const VARNA_CITY = stop(-11756, 'Varna');
const BURGAS_CITY = stop(-11995, 'Burgas');

/*
  Distances MEASURED off the live flat map (2026-08-20), in its own
  projected units - guessing them wrong is what these tests exist to
  catch. Screen pixels = map units x zoom.

    Sofia Airport <-> Sofia city   0.31 units  (~7 km, the pair to merge)
    Varna <-> Burgas               3.30 units  (~110 km)
    Varna <-> Sofia               14.75 units  (~370 km)
*/
const SOF = { item: 'SOF', x: 0, y: 0 };
const SOFIA_CITY = { item: 'Sofia', x: 0.31, y: 0 };
const VARNA = { item: 'VAR', x: 14.75, y: 0 };
const BURGAS = { item: 'Burgas', x: 11.45, y: 0 };

describe('clusterByScreenDistance', () => {
  it('merges a city and its airport at world zoom, where they overlap', () => {
    const clusters = clusterByScreenDistance([SOF, SOFIA_CITY], 1);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].items).toEqual(['SOF', 'Sofia']);
  });

  it('splits that same pair once zoomed right in on them', () => {
    // 0.31 units x 64 = ~20px apart: two dots you can tell apart.
    const clusters = clusterByScreenDistance([SOF, SOFIA_CITY], 64);
    expect(clusters).toHaveLength(2);
  });

  it('never merges cities that are genuinely different places', () => {
    for (const zoom of [1, 8, 64]) {
      expect(clusterByScreenDistance([SOF, VARNA], zoom)).toHaveLength(2);
    }
  });

  it('merges neighbours only while they truly overlap', () => {
    // Varna and Burgas are one blob on the world view, two dots by zoom 8.
    expect(clusterByScreenDistance([VARNA, BURGAS], 1)).toHaveLength(1);
    expect(clusterByScreenDistance([VARNA, BURGAS], 8)).toHaveLength(2);
  });

  it('anchors a cluster on its first member, so the dot sits on a real stop', () => {
    const clusters = clusterByScreenDistance([SOF, SOFIA_CITY], 1);
    expect(clusters[0].x).toBe(SOF.x);
    expect(clusters[0].y).toBe(SOF.y);
  });

  it('keeps the caller order, so renders do not shuffle', () => {
    const clusters = clusterByScreenDistance([VARNA, SOF, SOFIA_CITY], 64);
    expect(clusters.map((cluster) => cluster.items[0])).toEqual([
      'VAR',
      'SOF',
      'Sofia',
    ]);
  });

  it('exports the threshold it was tuned against', () => {
    expect(STOP_CLUSTER_PX).toBe(14);
  });
});

/*
  The naming rule has ONE definition because the marker and its card
  both call it - the map labelling a dot "Varna" while its card said
  "Burgas" is the bug this replaced.
*/
describe('stopClusterAnchor', () => {
  const counts = new Map([
    ['VAR', 4],
    ['Varna', 1],
    ['Burgas', 1],
  ]);

  it('lets a city rename its OWN airport, so the pair reads as the city', () => {
    const { namer } = stopClusterAnchor([VAR_AIRPORT, VARNA_CITY], counts);
    expect(namer.iataCode).toBe('Varna');
  });

  it('keeps the busiest name when the merged stops are unrelated', () => {
    // Varna airport and Burgas only overlap at world zoom; the dot sits
    // at Varna, so calling it "Burgas" would point at the wrong place.
    const { namer } = stopClusterAnchor([VAR_AIRPORT, BURGAS_CITY], counts);
    expect(namer.iataCode).toBe('VAR');
  });

  it('anchors on the busiest member regardless of input order', () => {
    for (const order of [
      [BURGAS_CITY, VAR_AIRPORT],
      [VAR_AIRPORT, BURGAS_CITY],
    ]) {
      expect(stopClusterAnchor(order, counts).anchor.iataCode).toBe('VAR');
    }
  });

  it('names a lone stop after itself', () => {
    expect(stopClusterAnchor([VAR_AIRPORT], counts).namer.iataCode).toBe('VAR');
    expect(stopClusterAnchor([VARNA_CITY], counts).namer.iataCode).toBe(
      'Varna',
    );
  });
});
