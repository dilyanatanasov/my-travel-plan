import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  useGetShareStatusQuery,
  useEnableShareMutation,
  useDisableShareMutation,
} from './shareApi';
import { useToast } from '../../components/Toast/ToastProvider';
import { renderMapPng, downloadBlob } from '../../utils/exportMapImage';
import {
  renderMapVideo,
  isVideoExportSupported,
  videoFileExtension,
} from '../../utils/exportMapVideo';
import MapExportCanvas, {
  EXPORT_SVG_ID,
} from '../../components/TravelMap/MapExportCanvas';
import { useGetVisitsQuery } from '../visits/visitsApi';
import { useGetFlightStatsQuery } from '../flights/flightsApi';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/authApi';

function ShareMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [videoProgress, setVideoProgress] = useState<number | null>(null);
  // Hidden only where MediaRecorder truly can't produce anything: with MP4
  // preferred, Safari and iOS now record too.
  const canExportVideo = useMemo(() => isVideoExportSupported(), []);
  const containerRef = useRef<HTMLDivElement>(null);

  const { user, isGuest } = useAuth();
  // A guest has no share token and never will until they sign up, so asking
  // for one is a request that can only ever answer "off".
  const { data: shareStatus } = useGetShareStatusQuery(undefined, {
    skip: isGuest,
  });
  const [enableShare, { isLoading: isEnabling }] = useEnableShareMutation();
  const [disableShare, { isLoading: isDisabling }] = useDisableShareMutation();
  const { data: visits = [] } = useGetVisitsQuery();
  const { data: flightStats } = useGetFlightStatsQuery();
  const { showToast } = useToast();

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  const token = shareStatus?.shareToken ?? null;
  const shareUrl = token ? `${window.location.origin}/s/${token}` : null;

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast('Share link copied', { tone: 'success' });
    } catch {
      // Clipboard access is denied in some browsers and over plain http on a
      // LAN address; show the link so it can still be copied by hand.
      showToast(shareUrl, { durationMs: 15000 });
    }
  };

  const handleToggleShare = async () => {
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

  /** Title and stat line shared by the image and the video. */
  const buildCaption = useCallback(() => {
    const visited = visits.filter((visit) => {
      const type = visit.visitType || 'trip';
      return type === 'trip' || type === 'home' || type === 'lived';
    }).length;

    const stats = [`${visited} countries`];
    if (flightStats?.totalFlights) {
      stats.push(`${flightStats.totalFlights} flights`);
      stats.push(
        `${Math.round(flightStats.totalDistanceKm).toLocaleString()} km`
      );
    }
    return {
      title: user?.displayName
        ? `${user.displayName}'s travel map`
        : 'My travel map',
      stats,
    };
  }, [visits, flightStats, user]);

  const handleDownloadVideo = async () => {
    const svg = document.getElementById(EXPORT_SVG_ID) as SVGSVGElement | null;
    if (!svg) {
      showToast('The map is not ready yet - try again in a moment', {
        tone: 'error',
      });
      return;
    }

    setIsExporting(true);
    setVideoProgress(0);
    try {
      const blob = await renderMapVideo(svg, buildCaption(), setVideoProgress);
      // MP4 where the browser can (story-friendly), WebM elsewhere.
      downloadBlob(blob, `travel-map.${videoFileExtension(blob.type)}`);
      setIsOpen(false);
      showToast('Video downloaded', { tone: 'success' });
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Could not create the video',
        { tone: 'error' }
      );
    } finally {
      setIsExporting(false);
      setVideoProgress(null);
    }
  };

  const handleDownload = async () => {
    // The off-screen export canvas, not the visible map: the visible one
    // overflows its container by design, so exporting it cropped the world.
    const svg = document.getElementById(
      EXPORT_SVG_ID
    ) as SVGSVGElement | null;
    if (!svg) {
      showToast('The map is not ready yet - try again in a moment', {
        tone: 'error',
      });
      return;
    }

    setIsExporting(true);
    try {
      const blob = await renderMapPng(svg, buildCaption());
      downloadBlob(blob, 'travel-map.png');
      setIsOpen(false);
      showToast('Image downloaded', { tone: 'success' });
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Could not create the image',
        { tone: 'error' }
      );
    } finally {
      setIsExporting(false);
    }
  };

  const isBusy = isEnabling || isDisabling;

  return (
    <div className="relative" ref={containerRef}>
      {/* Mounted while the menu is open so the geography has time to load
          before Download is pressed, and unmounted otherwise rather than
          keeping a second world map alive for the whole session. */}
      {isOpen && <MapExportCanvas />}

      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        // Square and centred while icon-only. With horizontal padding and no
        // label the 20px glyph had 2px of slack and read as clipped.
        className="flex items-center justify-center gap-2 w-11 h-11 sm:w-auto sm:px-3 rounded-lg border border-line text-ink-muted hover:bg-surface-sunken focus:outline-none focus:ring-2 focus:ring-brand-500"
      >
        {/* Upload-style share arrow: fewer strokes than the three-node glyph
            and much more legible at 20px. */}
        <svg
          className="w-5 h-5 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
            d="M12 15V3m0 0L8 7m4-4l4 4M4 13v5a2 2 0 002 2h12a2 2 0 002-2v-5"
          />
        </svg>
        <span className="hidden sm:inline text-sm font-medium">Share</span>
        <span className="sr-only sm:hidden">Share</span>
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-72 bg-surface border border-line rounded-lg shadow-lg py-1 z-50"
        >
          {canExportVideo && !isGuest && (
            <button
              type="button"
              role="menuitem"
              onClick={handleDownloadVideo}
              disabled={isExporting}
              className="w-full text-left px-3 py-3 text-sm text-ink hover:bg-surface-sunken disabled:opacity-50"
            >
              <span className="font-medium">
                {videoProgress !== null
                  ? `Recording… ${Math.round(videoProgress * 100)}%`
                  : 'Download as video'}
              </span>
              <span className="block text-xs text-ink-subtle mt-0.5">
                Planes flying your routes, ~10s
              </span>
            </button>
          )}

          <button
            type="button"
            role="menuitem"
            onClick={handleDownload}
            disabled={isExporting}
            className="w-full text-left px-3 py-3 text-sm text-ink hover:bg-surface-sunken disabled:opacity-50"
          >
            <span className="font-medium">
              {isExporting ? 'Creating image…' : 'Download as image'}
            </span>
            <span className="block text-xs text-ink-subtle mt-0.5">
              PNG of your map with your stats
            </span>
          </button>

          <div className="border-t border-line my-1" />

          {/*
            The image stays free for everyone - it is how the app spreads.
            Sharing and video are what an account buys, because both are
            things someone actively wants in the moment, which is a far
            stronger reason to sign up than an abstract warning about losing
            data later.
          */}
          {isGuest ? (
            <div className="px-3 py-3">
              <p className="text-sm font-medium text-ink">
                Share your map &amp; export video
              </p>
              <p className="text-xs text-ink-subtle mt-0.5 leading-relaxed">
                A free account gives you a public link to your map and the
                animated video export - and keeps your map if you change
                device.
              </p>
              <Link
                to="/register"
                onClick={() => setIsOpen(false)}
                className="mt-2 flex items-center justify-center w-full min-h-10 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700"
              >
                Create free account
              </Link>
            </div>
          ) : (
          <div className="px-3 py-2">
            <p className="text-sm font-medium text-ink">Public link</p>
            <p className="text-xs text-ink-subtle mt-0.5">
              {token
                ? 'Anyone with the link can see your map. Your notes are never shared.'
                : 'Off. Create a link to show your map to other people.'}
            </p>

            {shareUrl && (
              <div className="mt-2 flex items-center gap-1">
                <input
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 min-w-0 min-h-9 px-2 text-xs border border-line rounded bg-surface-sunken text-ink-muted"
                  aria-label="Public share link"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex-shrink-0 min-h-9 px-2 text-xs font-medium text-brand-700 hover:bg-brand-50 rounded focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  Copy
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleToggleShare}
              disabled={isBusy}
              className={`mt-2 w-full min-h-10 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                token
                  ? 'text-danger hover:bg-danger-soft'
                  : 'bg-brand-600 text-white hover:bg-brand-700'
              }`}
            >
              {isBusy
                ? 'Saving…'
                : token
                  ? 'Turn off sharing'
                  : 'Create share link'}
            </button>
          </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ShareMenu;
