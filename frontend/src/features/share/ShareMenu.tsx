import { useState, useRef, useEffect } from 'react';
import {
  useGetShareStatusQuery,
  useEnableShareMutation,
  useDisableShareMutation,
} from './shareApi';
import { useToast } from '../../components/Toast/ToastProvider';
import { renderMapPng, downloadBlob } from '../../utils/exportMapImage';
import MapExportCanvas, {
  EXPORT_SVG_ID,
} from '../../components/TravelMap/MapExportCanvas';
import { useGetVisitsQuery } from '../visits/visitsApi';
import { useGetFlightStatsQuery } from '../flights/flightsApi';
import { useAuth } from '../auth/authApi';

function ShareMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { user } = useAuth();
  const { data: shareStatus } = useGetShareStatusQuery();
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

  const handleDownload = async () => {
    // The off-screen export canvas, not the visible map: the visible one
    // overflows its container by design, so exporting it cropped the world.
    const svg = document.getElementById(
      EXPORT_SVG_ID
    ) as SVGSVGElement | null;
    if (!svg) {
      showToast('The map is not ready yet — try again in a moment', {
        tone: 'error',
      });
      return;
    }

    setIsExporting(true);
    try {
      const visited = visits.filter((visit) => {
        const type = visit.visitType || 'trip';
        return type === 'trip' || type === 'home';
      }).length;

      const stats = [`${visited} countries`];
      if (flightStats?.totalFlights) {
        stats.push(`${flightStats.totalFlights} flights`);
        stats.push(
          `${Math.round(flightStats.totalDistanceKm).toLocaleString()} km`
        );
      }

      const blob = await renderMapPng(svg, {
        title: user?.displayName
          ? `${user.displayName}'s travel map`
          : 'My travel map',
        stats,
      });
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
        className="flex items-center gap-2 min-h-11 px-3 rounded-lg border border-line text-ink-muted hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
      >
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
            strokeWidth={2}
            d="M8.684 13.342a3 3 0 100-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684zm0-12.632a3 3 0 105.368-2.684 3 3 0 00-5.368 2.684z"
          />
        </svg>
        <span className="hidden sm:inline text-sm font-medium">Share</span>
        <span className="sr-only sm:hidden">Share</span>
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-72 bg-white border border-line rounded-lg shadow-lg py-1 z-50"
        >
          <button
            type="button"
            role="menuitem"
            onClick={handleDownload}
            disabled={isExporting}
            className="w-full text-left px-3 py-3 text-sm text-ink hover:bg-gray-50 disabled:opacity-50"
          >
            <span className="font-medium">
              {isExporting ? 'Creating image…' : 'Download as image'}
            </span>
            <span className="block text-xs text-ink-subtle mt-0.5">
              PNG of your map with your stats
            </span>
          </button>

          <div className="border-t border-line my-1" />

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
        </div>
      )}
    </div>
  );
}

export default ShareMenu;
