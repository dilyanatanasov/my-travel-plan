import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ComposableMap, ZoomableGroup } from 'react-simple-maps';
import {
  useGetDuelQuery,
  useGetPublicMapQuery,
  useGetShareStatusQuery,
  useSaveDuelMutation,
  type PublicMap,
} from '../features/share/shareApi';
import { useAuth } from '../features/auth/authApi';
import SatelliteShell from '../components/Layout/SatelliteShell';
import CountriesLayer from '../components/TravelMap/CountriesLayer';
import { useMapViewport } from '../components/TravelMap/useMapViewport';
import { useMapColors } from '../theme/mapColors';
import { useToast } from '../components/Toast/ToastProvider';
import type { CountryDisplayInfo } from '../components/TravelMap/countryColors';
import CountryFlag from '../components/ui/CountryFlag';
import type { Alpha2, Alpha3 } from '../types';

/*
  The duel: two public maps on one canvas, a scoreline, and - behind a
  sign-in gate - the two lists that actually fuel rivalry. The gate is a
  conversion surface, not security: both maps are public via their own
  share links, so the composite cannot be more secret than its parts
  (decision 2026-08-13: tease publicly, gate the depth).

  Color language reuses the map's own visit palette rather than inventing
  one: YOU paint as visited-terracotta, THEY paint as transit-green, BOTH
  as the high-contrast home tone. The legend relabels them honestly.
*/

function ScoreTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-surface rounded-lg px-4 py-3 border border-line text-center">
      <div className="text-xl sm:text-2xl font-bold text-ink tabular-nums">
        {value}
      </div>
      <div className="text-xs sm:text-sm text-ink-muted">{label}</div>
    </div>
  );
}

/** /duel/:tokenA - the challenge landing: their map, your move. */
function ChallengeLanding({ token }: { token: string }) {
  const navigate = useNavigate();
  const { user, isGuest } = useAuth();
  const { data: map, isLoading, isError } = useGetPublicMapQuery(token);
  const { data: shareStatus } = useGetShareStatusQuery(undefined, {
    skip: !user || isGuest,
  });

  if (isLoading) return <PageShell>Loading the challenge…</PageShell>;
  if (isError || !map)
    return <PageShell>This challenge link is no longer available.</PageShell>;

  const myToken = shareStatus?.shareToken;
  const name = map.displayName;

  return (
    <PageShell>
      <div className="max-w-xl mx-auto text-center space-y-4">
        <h1 className="font-display text-3xl text-ink">
          {name} challenges you to a map duel
        </h1>
        <p className="text-5xl font-bold text-ink tabular-nums">
          {map.stats.countriesVisited} <span className="text-ink-subtle">–</span>{' '}
          <span className="text-ink-subtle">?</span>
        </p>
        <p className="text-sm text-ink-muted">
          {map.stats.countriesVisited} countries ·{' '}
          {Math.round(map.stats.distanceKm).toLocaleString()} km flown ·{' '}
          {map.stats.worldPercent}% of the world
        </p>
        {myToken ? (
          <button
            type="button"
            onClick={() => navigate(`/duel/${token}/${myToken}`)}
            className="inline-flex items-center justify-center min-h-11 px-6 rounded-xl bg-brand-600 text-white font-medium hover:bg-brand-700"
          >
            Add my map - let's duel
          </button>
        ) : user && !isGuest ? (
          <p className="text-sm text-ink-muted">
            Turn on sharing (Share panel → Public link) to join the duel with
            your own map.
          </p>
        ) : (
          <Link
            to="/register?ref=duel"
            className="inline-flex items-center justify-center min-h-11 px-6 rounded-xl bg-brand-600 text-white font-medium hover:bg-brand-700"
          >
            Make your map to fight back
          </Link>
        )}
        <p>
          <Link
            to={`/s/${token}`}
            className="text-sm text-brand-text hover:text-brand-700 font-medium"
          >
            Just look at {name}'s map instead
          </Link>
        </p>
      </div>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    /* SatelliteShell (2026-08-14 coherence pass): a session gets the real
       app header, strangers the shared slim one - this page's hand-rolled
       mini-header retired with it. Scrolling stays owned here via the
       shell (the app body is overflow:hidden). */
    <SatelliteShell
      anonymousAction={
        <Link
          to="/register?ref=duel"
          className="inline-flex items-center min-h-11 px-3 sm:px-4 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700"
        >
          Make your own map
        </Link>
      }
    >
      <main className="p-4 sm:p-6">{children}</main>
    </SatelliteShell>
  );
}

function DuelPage() {
  const { tokenA = '', tokenB } = useParams();
  const { user, isGuest } = useAuth();
  const { showToast } = useToast();
  const isSignedIn = Boolean(user) && !isGuest;

  const {
    data: duel,
    isLoading,
    isError,
  } = useGetDuelQuery(
    { a: tokenA, b: tokenB ?? '' },
    { skip: !tokenA || !tokenB },
  );
  const { data: shareStatus } = useGetShareStatusQuery(undefined, {
    skip: !isSignedIn,
  });
  const [saveDuel] = useSaveDuelMutation();

  const { map: colors } = useMapColors();
  const { ref: mapBoxRef, viewport } = useMapViewport<HTMLDivElement>();
  const { width, height, scale } = viewport;

  const isVisitedType = (t: string) =>
    t === 'trip' || t === 'home' || t === 'lived';

  const merged = useMemo(() => {
    const display = new Map<string, CountryDisplayInfo>();
    const empty = {
      display,
      listA: [] as { name: string; iso2: Alpha2; shared: boolean }[],
      listB: [] as { name: string; iso2: Alpha2; shared: boolean }[],
      onlyACount: 0,
      onlyBCount: 0,
    };
    if (!duel) return empty;
    const paint = (iso: Alpha3, bucket: 'trip' | 'transit' | 'home') =>
      display.set(iso, {
        isoCode: iso,
        visitType: bucket,
        isHome: bucket === 'home',
        hasFlights: false,
        visit: null,
      });
    const aSet = new Map(
      duel.a.countries.filter((c) => isVisitedType(c.visitType)).map((c) => [c.isoCode, c]),
    );
    const bSet = new Map(
      duel.b.countries.filter((c) => isVisitedType(c.visitType)).map((c) => [c.isoCode, c]),
    );
    /*
      Full roster per side, exclusives first (the rivalry), shared after
      (the common ground). A country both have paints as 'home' - the map's
      highest-contrast tone - and repeats in both columns marked shared.
    */
    const listA: { name: string; iso2: Alpha2; shared: boolean }[] = [];
    const listB: { name: string; iso2: Alpha2; shared: boolean }[] = [];
    for (const [iso, c] of aSet) {
      const shared = bSet.has(iso);
      paint(iso, shared ? 'home' : 'trip');
      listA.push({ name: c.name, iso2: c.isoCode2, shared });
    }
    for (const [iso, c] of bSet) {
      const shared = aSet.has(iso);
      if (!shared) paint(iso, 'transit');
      listB.push({ name: c.name, iso2: c.isoCode2, shared });
    }
    const order = (
      x: { name: string; shared: boolean },
      y: { name: string; shared: boolean },
    ) => Number(x.shared) - Number(y.shared) || x.name.localeCompare(y.name);
    listA.sort(order);
    listB.sort(order);
    return {
      display,
      listA,
      listB,
      onlyACount: listA.filter((c) => !c.shared).length,
      onlyBCount: listB.filter((c) => !c.shared).length,
    };
  }, [duel]);

  if (!tokenB) return <ChallengeLanding token={tokenA} />;
  if (isLoading) return <PageShell>Setting up the duel…</PageShell>;
  if (isError || !duel)
    return (
      <PageShell>
        One of these maps is no longer shared - the duel is off.
      </PageShell>
    );

  const { a, b } = duel;
  const countScore = (m: PublicMap) => m.stats.countriesVisited;
  const myToken = shareStatus?.shareToken ?? null;
  const opponentToken =
    myToken === a.token ? b.token : myToken === b.token ? a.token : null;

  const handleSave = async () => {
    if (!opponentToken) return;
    try {
      await saveDuel(opponentToken).unwrap();
      showToast('Duel saved - find it in your Share panel', {
        tone: 'success',
      });
    } catch {
      showToast('Could not save this duel', { tone: 'error' });
    }
  };

  return (
    <PageShell>
      <div className="max-w-4xl mx-auto space-y-4">
        {/* The scoreline */}
        <div className="text-center">
          <h1 className="font-display text-2xl sm:text-3xl text-ink">
            {a.displayName}{' '}
            <span className="tabular-nums font-bold">
              {countScore(a)} – {countScore(b)}
            </span>{' '}
            {b.displayName}
          </h1>
          <p className="text-xs text-ink-muted mt-1">
            countries visited · myContrail duel
          </p>
        </div>

        {/* Both maps, one canvas */}
        <div
          ref={mapBoxRef}
          className="aspect-[16/10] bg-surface rounded-2xl border border-line overflow-hidden"
        >
          {width > 0 && (
            <ComposableMap
              width={width}
              height={height}
              projectionConfig={{ scale }}
              style={{ width: '100%', height: '100%', background: colors.ocean }}
            >
              <ZoomableGroup minZoom={1} maxZoom={8}>
                <CountriesLayer
                  countryDisplayMap={merged.display}
                  showVisitColors
                />
              </ZoomableGroup>
            </ComposableMap>
          )}
        </div>

        {/* Legend, relabeled for the duel */}
        <div className="flex justify-center gap-4 text-xs text-ink-muted">
          {[
            { label: `Only ${a.displayName}`, color: colors.visited },
            { label: `Only ${b.displayName}`, color: colors.transit },
            { label: 'Both', color: colors.home },
          ].map(({ label, color }) => (
            <span key={label} className="flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-sm inline-block"
                style={{ background: color }}
              />
              {label}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <ScoreTile value={String(countScore(a))} label={`${a.displayName} · countries`} />
          <ScoreTile value={String(countScore(b))} label={`${b.displayName} · countries`} />
          <ScoreTile
            value={`${Math.round(a.stats.distanceKm).toLocaleString()} km`}
            label={`${a.displayName} · flown`}
          />
          <ScoreTile
            value={`${Math.round(b.stats.distanceKm).toLocaleString()} km`}
            label={`${b.displayName} · flown`}
          />
        </div>

        {/* The rivalry fuel - signed-in only (the catchy part is the carrot).
            Two full rosters, exclusives first and bold, shared muted with a
            "both" dot: repeats across players are common ground, not noise. */}
        {isSignedIn ? (
          <div className="grid sm:grid-cols-2 gap-3">
            {(
              [
                {
                  name: a.displayName,
                  list: merged.listA,
                  only: merged.onlyACount,
                  color: colors.visited,
                },
                {
                  name: b.displayName,
                  list: merged.listB,
                  only: merged.onlyBCount,
                  color: colors.transit,
                },
              ] as const
            ).map(({ name, list, only, color }) => (
              <div
                key={name}
                className="bg-surface rounded-xl border border-line p-4"
              >
                <p className="text-sm font-semibold text-ink mb-2">
                  {name}'s {list.length}{' '}
                  {list.length === 1 ? 'country' : 'countries'}
                  <span className="text-ink-subtle font-normal">
                    {' '}
                    · {only} exclusive
                  </span>
                </p>
                <ul className="text-xs leading-relaxed columns-2 gap-4">
                  {list.map((country) => (
                    <li
                      key={country.name}
                      className={
                        country.shared
                          ? 'text-ink-subtle'
                          : 'text-ink font-medium'
                      }
                    >
                      <span
                        className="inline-block w-2 h-2 rounded-sm mr-1.5 align-baseline"
                        style={{
                          background: country.shared ? colors.home : color,
                        }}
                      />
                      <CountryFlag iso2={country.iso2} className="mr-1 align-baseline" />
                      {country.name}
                    </li>
                  ))}
                  {list.length === 0 && <li className="text-ink-subtle">—</li>}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-surface rounded-xl border border-line p-5 text-center space-y-2">
            <p className="text-sm font-semibold text-ink">
              Who has what the other doesn't?
            </p>
            <p className="text-xs text-ink-muted">
              Sign in to see the {merged.onlyACount + merged.onlyBCount}{' '}
              countries separating these two maps.
            </p>
            <Link
              to="/register?ref=duel"
              className="inline-flex items-center justify-center min-h-10 px-5 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700"
            >
              Make your own map
            </Link>
          </div>
        )}

        {opponentToken && (
          <div className="text-center">
            <button
              type="button"
              onClick={handleSave}
              className="min-h-10 px-4 rounded-lg text-sm font-medium text-brand-text hover:text-brand-700 underline"
            >
              Save this duel
            </button>
          </div>
        )}
      </div>
    </PageShell>
  );
}

export default DuelPage;
