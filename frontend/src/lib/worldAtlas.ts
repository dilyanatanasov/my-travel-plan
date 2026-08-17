/**
 * The one world geography, shared by the travel map and the daily puzzle.
 *
 * 50m resolution for both (2026-08-17): the map used the 110m tier, which
 * silently drops microstates and territories - Malta, the Faroes, N. Mariana
 * Is. - so the daily puzzle could name a place the map could not draw, and
 * "mark it on your map" pointed at open ocean. One file also means one
 * fetch: the daily and the map used to download two different worlds.
 *
 * Self-hosted (vendored from world-atlas@2 into public/geo): the most
 * important pixel on the site must not depend on a third-party CDN.
 */
export const WORLD_ATLAS_URL = '/geo/countries-50m.json';

/*
  Fetch the world once per page, not once per mount.

  <Geographies geography={url}> refetches whenever it mounts, and the shell
  unmounts the map to show a full-screen section - so opening Share threw the
  world away and asked for it again. A module-level promise means concurrent
  mounts share one request, and a failure is not cached so the next mount
  can retry.
*/
let atlasPromise: Promise<unknown> | null = null;

export function loadWorldAtlas(): Promise<unknown> {
  atlasPromise ??= fetch(WORLD_ATLAS_URL)
    .then((response) => {
      if (!response.ok)
        throw new Error(`Geography fetch failed: ${response.status}`);
      return response.json();
    })
    .catch((error) => {
      atlasPromise = null;
      throw error;
    });
  return atlasPromise;
}
