import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
import {
  renderTripVideo,
  isVideoExportSupported,
  videoFileExtension,
} from '../../utils/exportMapVideo';
import { useToast } from '../../components/Toast/ToastProvider';
import { useAuth } from '../auth/authApi';
import { useGetLegPhotoIdsQuery } from '../flights/flightsApi';
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
  const [videoProgress, setVideoProgress] = useState<number | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const canExportVideo = useMemo(() => isVideoExportSupported(), []);
  const { data: photoIds } = useGetLegPhotoIdsQuery();
  const photoLegSet = useMemo(
    () => new Set(photoIds?.legIds ?? []),
    [photoIds],
  );

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
      setVideoFile(null);
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

  /*
    The replay, portable, in two taps ON PURPOSE (owner report: "still
    downloaded, have to post separately"): browsers only open the share
    sheet within a moment of a real tap, and the 4-10s render burned that
    moment - so navigator.share was silently rejected and the flow fell
    to download every time. Tap one records; tap two is fresh, so the
    social picker actually opens, with the finished MP4 attached.
  */
  const handleCreateVideo = useCallback(async () => {
    const svg = await findExportSvg(TRIP_SVG_ID, () => false);
    if (!svg) {
      showToast('The map is still loading - try again in a moment', {
        tone: 'error',
      });
      return;
    }
    setVideoProgress(0);
    const objectUrls: string[] = [];
    try {
      const km = legs.reduce(
        (sum, leg) => sum + (Number(leg.distanceKm) || 0),
        0,
      );
      /*
        Stop postcards for the film: the same authed per-leg photos the
        replay shows, fetched here as images. A missing or failing photo
        is a null - the video just flies past that stop.
      */
      const base = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';
      const photos = await Promise.all(
        legs.map(async (leg) => {
          if (!leg.id || !photoLegSet.has(leg.id)) return null;
          try {
            const response = await fetch(
              `${base}/flights/legs/${leg.id}/photo`,
              { credentials: 'include' },
            );
            if (!response.ok) return null;
            const photoBlob = await response.blob();
            const url = URL.createObjectURL(photoBlob);
            objectUrls.push(url);
            return await new Promise<HTMLImageElement>((resolve, reject) => {
              const image = new Image();
              image.onload = () => resolve(image);
              image.onerror = reject;
              image.src = url;
            });
          } catch {
            return null;
          }
        }),
      );

      const blob = await renderTripVideo(
        svg,
        {
          routeCodes,
          dateLabel: formatJourneyDate(journey),
          flights: legs.length,
          km,
          passenger: user?.displayName ?? null,
        },
        setVideoProgress,
        // ~2.6s per leg, clamped: one hop stays snappy, a five-leg epic
        // does not drone on.
        Math.min(Math.max(legs.length * 2600, 4000), 10000),
        photos,
      );
      track('share_render', { style: 'trip-video' });
      const extension = videoFileExtension(blob.type);
      const videoName = filename.replace(/\.png$/, `.${extension}`);
      /*
        Strip codec parameters from the type: MediaRecorder labels its
        output "video/mp4;codecs=avc1", and Android's share sheet matches
        its allow-list against the full string - the parameterised type
        fails with exactly "Permission denied" (OnePlus 13 report,
        2026-08-17). Plain "video/mp4" passes.
      */
      const shareType = blob.type.split(';')[0] || 'video/mp4';
      setVideoFile(new File([blob], videoName, { type: shareType }));
    } catch (videoError) {
      showToast(
        videoError instanceof Error
          ? videoError.message
          : 'Could not create the video',
        { tone: 'error' },
      );
    } finally {
      setVideoProgress(null);
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    }
  }, [
    legs,
    journey,
    routeCodes,
    filename,
    showToast,
    user?.displayName,
    photoLegSet,
  ]);

  const handleShareVideo = useCallback(async () => {
    if (!videoFile) return;
    /*
      Diagnostic fallbacks (debugging a OnePlus 13 report, 2026-08-17):
      when this ends in a download, the toast says exactly which gate
      failed - canShare refusing the file type, or share() throwing what.
    */
    if (!canShareFiles(videoFile)) {
      downloadBlob(videoFile, videoFile.name);
      showToast(
        `Saved instead - this browser refuses to share ${videoFile.type || 'this file type'} to apps`,
        { durationMs: 8000 },
      );
      return;
    }
    try {
      await navigator.share({
        files: [videoFile],
        title: 'myContrail trip',
        text: routeCodes.join(' → '),
      });
    } catch (shareError) {
      const err = shareError as Error;
      if (err?.name === 'AbortError') return;
      downloadBlob(videoFile, videoFile.name);
      showToast(`Saved instead - sharing failed (${err?.name}: ${err?.message})`, {
        durationMs: 8000,
      });
    }
  }, [videoFile, routeCodes, showToast]);

  /*
    Portalled to <body> (owner report: the overlay stopped short of the
    top of the phone screen): the dialog used to render inside the mobile
    section sheet, whose CSS transform makes position:fixed anchor to the
    sheet instead of the viewport. From the body there is no transformed
    ancestor and inset-0 means the actual screen.
  */
  return createPortal(
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
        {canExportVideo && !videoFile && (
          <Button
            variant="ghost"
            fullWidth
            className="rounded-xl"
            onClick={handleCreateVideo}
            disabled={!previewUrl || videoProgress !== null}
          >
            {videoProgress !== null
              ? `Recording flight… ${Math.round(videoProgress * 100)}%`
              : 'Create video ✈️'}
          </Button>
        )}
        {videoFile &&
          /*
            Honest buttons: Share only where this browser can actually hand
            a video file to other apps. Where it can't (most desktop
            browsers), offering Share and delivering a download reads as a
            bug - say Save, and say why.
          */
          (canShareFiles(videoFile) ? (
            <div className="flex gap-2">
              <Button
                className="flex-1 rounded-xl font-semibold"
                onClick={handleShareVideo}
              >
                Share video
              </Button>
              <Button
                variant="outline"
                className="flex-1 rounded-xl font-semibold"
                onClick={() => {
                  downloadBlob(videoFile, videoFile.name);
                  showToast('Video saved', { tone: 'success' });
                }}
              >
                Save video
              </Button>
            </div>
          ) : (
            <div className="space-y-1">
              <Button
                fullWidth
                className="rounded-xl font-semibold"
                onClick={() => {
                  downloadBlob(videoFile, videoFile.name);
                  showToast('Video saved', { tone: 'success' });
                }}
              >
                Save video
              </Button>
              <p className="text-[11px] text-ink-subtle text-center">
                This browser can&rsquo;t hand videos to other apps - open
                mycontrail.com on your phone to share straight to Instagram.
              </p>
            </div>
          ))}
      </div>
    </div>,
    document.body,
  );
}

export default TripShareDialog;
