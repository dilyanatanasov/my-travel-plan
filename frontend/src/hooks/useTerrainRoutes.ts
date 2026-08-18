import { useEffect, useState } from 'react';
import {
  ensureTerrainWaypoints,
  terrainWaypointsSync,
  terrainRequestKey,
  type TerrainRequest,
} from '../lib/terrainRoute';

/**
 * Kicks off terrain routing for the given legs and re-renders the caller
 * when answers land. The routes themselves are read synchronously from the
 * module cache during render (terrainWaypointsSync) - this hook only
 * supplies the "wake up, it's ready" signal, so a straight chord is drawn
 * for at most the few frames the router needs.
 */
export function useTerrainRoutes(requests: TerrainRequest[]): number {
  const [version, setVersion] = useState(0);
  const key = requests.map(terrainRequestKey).join(';');

  useEffect(() => {
    let alive = true;
    for (const request of requests) {
      if (
        terrainWaypointsSync(request.from, request.to, request.medium) !==
        undefined
      )
        continue;
      void ensureTerrainWaypoints(
        request.from,
        request.to,
        request.medium,
      ).then(() => {
        if (alive) setVersion((v) => v + 1);
      });
    }
    return () => {
      alive = false;
    };
    // The joined key captures everything the request array contains; the
    // array itself is rebuilt every render and would loop the effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return version;
}
