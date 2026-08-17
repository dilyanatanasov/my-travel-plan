import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FlightJourney } from '../../types';
import MapExportCanvas from '../../components/TravelMap/MapExportCanvas';
import {
  renderTripCard,
  findExportSvg,
  canShareFiles,
  TRIP_SVG_ID,
  type TripContent,
} from '../../utils/shareCard';
import { downloadBlob } from '../../utils/exportMapImage';
import { useToast } from '../../components/Toast/ToastProvider';
import { useAuth } from '../auth/authApi';
import { formatJourneyDate } from '../../utils/journeyDate';
import { track } from '../../lib/analytics';
import Button from '../../components/ui/Button';

/**
 * One journey as a boarding-pass image (trip share v1, 2026-08-14).
 *
 * Image only, on purpose: the card goes wherever the user chooses to send
 * it, so sharing a trip creates no public URL and no new privacy surface.
 * Opened from the Flights list and from the map's selected-journey card.
 */
function TripShareDialog({
  journey,
  onClose,
}: {
  journey: FlightJourney;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const blobRef = useRef<Blob | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const { legs, routeCodes } = useMemo(() => {
    const sorted = [...(journey.legs ?? [])].sort(
      (a, b) => a.legOrder - b.legOrder,
    );
    const codes = sorted.length
      ? ([
          sorted[0].departureAirport?.iataCode,
          ...sorted.map((leg) => leg.arrivalAirport?.iataCode),
        ].filter(Boolean) as string[])
      : [];
    return { legs: sorted, routeCodes: codes };
  }, [journey]);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    const render = async () => {
      setError(null);
      const svg = await findExportSvg(TRIP_SVG_ID, () => cancelled);
      if (cancelled) return;
      if (!svg) {
        setError('The map is still loading - try again in a moment.');
        return;
      }
      const content: TripContent = {
        routeCodes,
        dateLabel: formatJourneyDate(journey),
        flights: legs.length,
        km: legs.reduce((sum, leg) => sum + (Number(leg.distanceKm) || 0), 0),
        passenger: user?.displayName ?? null,
      };
      try {
        const blob = await renderTripCard(svg, content);
        if (cancelled) return;
        // Style name only - never the route or the date.
        track('share_render', { style: 'trip' });
        blobRef.current = blob;
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      } catch (renderError) {
        if (!cancelled) {
          setError(
            renderError instanceof Error
              ? renderError.message
              : 'Could not draw the card',
          );
        }
      }
    };

    void render();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // journey.id stands in for the derived route/date/km fields.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journey.id, user?.displayName, retryToken]);

  const filename = `contrail-trip-${routeCodes[0] ?? 'trip'}-${
    routeCodes[routeCodes.length - 1] ?? ''
  }.png`;

  const handleDownload = useCallback(() => {
    if (!blobRef.current) return;
    downloadBlob(blobRef.current, filename);
    showToast('Image saved', { tone: 'success' });
  }, [filename, showToast]);

  const handleShare = useCallback(async () => {
    const blob = blobRef.current;
    if (!blob) return;
    const file = new File([blob], filename, { type: 'image/png' });
    if (canShareFiles(file)) {
      try {
        await navigator.share({
          files: [file],
          title: 'myContrail trip',
          text: routeCodes.join(' → '),
        });
        return;
      } catch (shareError) {
        if ((shareError as Error)?.name === 'AbortError') return;
      }
    }
    handleDownload();
    showToast('Saved - post it from your gallery', { durationMs: 6000 });
  }, [filename, handleDownload, routeCodes, showToast]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Share this trip"
    >
      {/* Off-screen source, framed on this journey only. */}
      <MapExportCanvas theme="light" journey={journey} svgId={TRIP_SVG_ID} />

      <div
        className="w-full max-w-sm bg-surface rounded-2xl shadow-2xl p-4 space-y-3"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-ink truncate">
            {routeCodes.join(' → ')}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex-shrink-0 p-2 text-ink-subtle hover:text-ink rounded-lg hover:bg-surface-sunken"
          >
            ✕
          </button>
        </div>

        <div className="relative aspect-[4/5] rounded-xl overflow-hidden border border-line bg-surface-sunken">
          {previewUrl && (
            <img
              src={previewUrl}
              alt={`Boarding pass for ${routeCodes.join(' → ')}`}
              className="w-full h-full object-cover"
            />
          )}
          {(!previewUrl || error) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-sm text-ink-muted px-6 text-center">
              <span>{error ?? 'Drawing your boarding pass…'}</span>
              {error && (
                <Button size="sm" onClick={() => setRetryToken((n) => n + 1)}>
                  Try again
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            className="flex-1 rounded-xl font-semibold"
            onClick={handleShare}
            disabled={!previewUrl}
          >
            Share
          </Button>
          <Button
            variant="outline"
            className="flex-1 rounded-xl font-semibold"
            onClick={handleDownload}
            disabled={!previewUrl}
          >
            Save image
          </Button>
        </div>
      </div>
    </div>
  );
}

export default TripShareDialog;
