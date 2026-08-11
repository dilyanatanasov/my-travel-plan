import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useGetShareStatusQuery,
  useEnableShareMutation,
  useDisableShareMutation,
} from './shareApi';
import { useToast } from '../../components/Toast/ToastProvider';
import { downloadBlob } from '../../utils/exportMapImage';
import {
  renderShareCard,
  CARD_WIDTH,
  CARD_HEIGHT,
  type ShareStyle,
  type ShareContent,
} from '../../utils/shareCard';
import MapExportCanvas, {
  EXPORT_SVG_ID,
} from '../../components/TravelMap/MapExportCanvas';
import { useGetVisitsQuery } from '../visits/visitsApi';
import { useGetFlightStatsQuery } from '../flights/flightsApi';
import { useAuth } from '../auth/authApi';

const STYLES: { id: ShareStyle; label: string; hint: string }[] = [
  { id: 'warm', label: 'Warm', hint: 'Cream and terracotta' },
  { id: 'ink', label: 'Ink', hint: 'Dark, one big number' },
  { id: 'editorial', label: 'Editorial', hint: 'Full-bleed map' },
];

/** Can this browser share a file, rather than only a link? */
function canShareFiles(file: File): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })
  );
}

function SharePanel() {
  const [style, setStyle] = useState<ShareStyle>('warm');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(true);
  const [renderError, setRenderError] = useState<string | null>(null);
  // Bumped to force the render effect to run again after a failure.
  const [retryToken, setRetryToken] = useState(0);

  // Held so the buttons can act on exactly what is on screen, rather than
  // rendering a second time and risking a different result.
  const blobRef = useRef<Blob | null>(null);

  const { user, isGuest } = useAuth();
  const { showToast } = useToast();
  const { data: visits = [], isLoading: visitsLoading } = useGetVisitsQuery();
  const { data: flightStats, isLoading: statsLoading } = useGetFlightStatsQuery();
  const isLoadingData = visitsLoading || statsLoading;
  const { data: shareStatus } = useGetShareStatusQuery(undefined, {
    skip: isGuest,
  });
  const [enableShare, { isLoading: isEnabling }] = useEnableShareMutation();
  const [disableShare, { isLoading: isDisabling }] = useDisableShareMutation();

  const countriesCount = visits.filter((visit) => {
    const type = visit.visitType || 'trip';
    return type === 'trip' || type === 'home';
  }).length;
  const hasSomethingToShow =
    countriesCount > 0 || (flightStats?.totalFlights ?? 0) > 0;

  const content = useMemo<ShareContent>(() => {
    const countries = visits.filter((visit) => {
      const type = visit.visitType || 'trip';
      return type === 'trip' || type === 'home';
    }).length;

    const km = Math.round(flightStats?.totalDistanceKm ?? 0);
    const flights = flightStats?.totalFlights ?? 0;
    const airports = flightStats?.uniqueAirports ?? 0;
    const earths = flightStats?.earthCircumferences ?? 0;

    return {
      kicker: `${new Date().getFullYear()} · Contrail`,
      headline: `${countries} ${countries === 1 ? 'country' : 'countries'} and counting`,
      hero: {
        value: km.toLocaleString(),
        caption: `kilometres · ${countries} countries · ${airports} airports`,
      },
      facts: [
        { label: 'kilometres flown', value: km.toLocaleString() },
        { label: 'flights logged', value: String(flights) },
        { label: 'times around Earth', value: `${earths.toFixed(1)}×` },
        { label: 'airports touched', value: String(airports) },
      ],
    };
  }, [visits, flightStats]);

  /*
    Render the card whenever the style or the numbers change. The resulting
    PNG is both the preview and the file the buttons hand over, so what is on
    screen and what gets posted cannot drift apart.
  */
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    /*
      Poll for the off-screen canvas rather than assuming it exists after one
      frame. It mounts in this same render pass, and react-simple-maps builds
      its <svg> asynchronously, so a single rAF sometimes missed it — and the
      old code turned that miss into a permanent error with no retry, which is
      why the first visit to Share could show a card with no map.
    */
    const findExportSvg = async (): Promise<SVGSVGElement | null> => {
      const deadline = Date.now() + 6000;
      for (;;) {
        const found = document.getElementById(EXPORT_SVG_ID) as SVGSVGElement | null;
        // isConnected guards against grabbing a node mid-remount: a detached
        // SVG never loads geography, so we would wait for it until timeout.
        if ((found && found.isConnected) || Date.now() > deadline || cancelled) {
          return found;
        }
        await new Promise((resolve) => setTimeout(resolve, 80));
      }
    };

    const render = async () => {
      if (isLoadingData || !hasSomethingToShow) return;
      setIsRendering(true);
      setRenderError(null);

      const svg = await findExportSvg();
      if (cancelled) return;
      if (!svg) {
        setRenderError('The map is still loading — reopen Share in a moment.');
        setIsRendering(false);
        return;
      }

      try {
        const blob = await renderShareCard(svg, content, style);
        if (cancelled) return;
        blobRef.current = blob;
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      } catch (error) {
        if (!cancelled) {
          setRenderError(
            error instanceof Error ? error.message : 'Could not draw the card',
          );
        }
      } finally {
        if (!cancelled) setIsRendering(false);
      }
    };

    void render();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [content, style, retryToken, isLoadingData, hasSomethingToShow]);

  const filename = `contrail-${style}.png`;

  const handleDownload = useCallback(() => {
    if (!blobRef.current) return;
    downloadBlob(blobRef.current, filename);
    showToast('Image saved', { tone: 'success' });
  }, [filename, showToast]);

  const handleShare = useCallback(async () => {
    const blob = blobRef.current;
    if (!blob) return;

    const file = new File([blob], filename, { type: 'image/png' });

    /*
      The native sheet is the only route to Instagram and Stories: neither has
      a web endpoint that accepts an image, so "share to Instagram" on the web
      is always download-then-post. On a phone this opens the real sheet with
      Instagram, WhatsApp and the rest in it.
    */
    if (canShareFiles(file)) {
      try {
        await navigator.share({
          files: [file],
          title: 'My Contrail map',
          text: content.headline,
        });
        return;
      } catch (error) {
        // A cancelled sheet throws AbortError; that is not a failure.
        if ((error as Error)?.name === 'AbortError') return;
      }
    }

    handleDownload();
    showToast('Saved — post it from your gallery', { durationMs: 6000 });
  }, [content.headline, filename, handleDownload, showToast]);

  const token = shareStatus?.shareToken ?? null;
  const shareUrl = token ? `${window.location.origin}/s/${token}` : null;

  const handleToggleLink = async () => {
    try {
      if (token) {
        await disableShare().unwrap();
        showToast('Sharing turned off. Existing links no longer work.', {
          tone: 'success',
        });
      } else {
        const result = await enableShare().unwrap();
        await navigator.clipboard
          ?.writeText(`${window.location.origin}/s/${result.shareToken}`)
          .catch(() => undefined);
        showToast('Share link created and copied', { tone: 'success' });
      }
    } catch {
      showToast('Could not change your sharing setting', { tone: 'error' });
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast('Share link copied', { tone: 'success' });
    } catch {
      // Clipboard is blocked over plain http on a LAN address; show the link
      // so it can still be copied by hand.
      showToast(shareUrl, { durationMs: 15000 });
    }
  };

  if (isLoadingData) {
    return (
      <div className="max-w-md mx-auto">
        <div className="aspect-[4/5] rounded-2xl border border-line bg-surface-sunken animate-pulse" />
      </div>
    );
  }

  if (!hasSomethingToShow) {
    return (
      <div className="max-w-md mx-auto bg-surface border border-line rounded-2xl px-6 py-12 text-center shadow-sm">
        <h3 className="text-base font-semibold text-ink">Nothing to share yet</h3>
        <p className="text-sm text-ink-muted mt-1.5 leading-relaxed">
          Mark a country on the map or log a flight, and your card appears here
          ready to post.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-md mx-auto">
      {/* Off-screen source for the card. */}
      {/* Ink is a dark card, so its map has to be the dark palette. */}
      <MapExportCanvas theme={style === 'ink' ? 'dark' : 'light'} />

      <div className="flex gap-2">
        {STYLES.map((option) => {
          const isActive = style === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setStyle(option.id)}
              aria-pressed={isActive}
              className={`flex-1 min-h-11 px-2 rounded-xl text-sm font-medium border transition-colors
                focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                isActive
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-surface text-ink border-line hover:bg-surface-sunken'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-ink-subtle -mt-3">
        {STYLES.find((s) => s.id === style)?.hint} · exports at {CARD_WIDTH}×
        {CARD_HEIGHT}
      </p>

      {/*
        aspect-[4/5] reserves the space before the first render lands, so
        switching styles does not shunt the buttons up and down the page.
      */}
      <div className="relative aspect-[4/5] rounded-2xl overflow-hidden border border-line bg-surface-sunken shadow-md">
        {previewUrl && (
          <img
            src={previewUrl}
            alt={`Preview: ${content.headline}`}
            className="w-full h-full object-cover"
          />
        )}
        {((isRendering && !previewUrl) || renderError) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface-sunken/80 text-sm text-ink-muted px-6 text-center">
            <span>{renderError ?? 'Drawing your card…'}</span>
            {/* A dead end is worse than a slow render: always offer the retry. */}
            {renderError && (
              <button
                type="button"
                onClick={() => setRetryToken((n) => n + 1)}
                className="min-h-10 px-4 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700"
              >
                Try again
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleShare}
          disabled={!previewUrl}
          className="flex-1 min-h-12 rounded-xl bg-brand-600 text-white font-semibold
            hover:bg-brand-700 disabled:opacity-50
            focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          Share
        </button>
        <button
          type="button"
          onClick={handleDownload}
          disabled={!previewUrl}
          className="flex-1 min-h-12 rounded-xl border border-brand-600 text-brand-700 font-semibold
            hover:bg-brand-50 disabled:opacity-50
            focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          Save image
        </button>
      </div>

      {/*
        The image is free for everyone — it is how the app spreads. The public
        link needs an account, because it has to live at a URL that outlives
        the browser it was made in.
      */}
      <div className="bg-surface border border-line rounded-2xl p-4 shadow-sm">
        <p className="text-sm font-semibold text-ink">Public link</p>

        {isGuest ? (
          <>
            <p className="text-xs text-ink-muted mt-1 leading-relaxed">
              A free account gives your map its own web address, so people can
              open it instead of looking at a screenshot.
            </p>
            <Link
              to="/register"
              className="mt-3 flex items-center justify-center w-full min-h-11 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700"
            >
              Create free account
            </Link>
          </>
        ) : (
          <>
            <p className="text-xs text-ink-muted mt-1 leading-relaxed">
              {token
                ? 'Anyone with the link can see your map. Your notes are never shared.'
                : 'Off. Create a link to show your map to other people.'}
            </p>

            {shareUrl && (
              <div className="mt-3 flex items-center gap-1">
                <input
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 min-w-0 min-h-10 px-2 text-xs border border-line rounded-lg bg-surface-sunken text-ink-muted"
                  aria-label="Public share link"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex-shrink-0 min-h-10 px-3 text-xs font-medium text-brand-700 hover:bg-brand-50 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  Copy
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleToggleLink}
              disabled={isEnabling || isDisabling}
              className={`mt-3 w-full min-h-11 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 ${
                token
                  ? 'text-danger hover:bg-danger-soft'
                  : 'bg-brand-600 text-white hover:bg-brand-700'
              }`}
            >
              {isEnabling || isDisabling
                ? 'Saving…'
                : token
                  ? 'Turn off sharing'
                  : 'Create share link'}
            </button>
          </>
        )}
      </div>

      {user?.displayName && (
        <p className="text-xs text-ink-subtle text-center">
          Shared as {user.displayName}
        </p>
      )}
    </div>
  );
}

export default SharePanel;
