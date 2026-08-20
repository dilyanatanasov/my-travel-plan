import { describe, it, expect } from 'vitest';
import { clusterByScreenDistance, STOP_CLUSTER_PX } from './routeUtils';

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
