import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { FlightJourney } from '../../types';
import MapExportCanvas from '../../components/TravelMap/MapExportCanvas';
import {
  renderTripCard,
  findExportSvg,
  waitForGeography,
  canShareFiles,
  TRIP_SVG_ID,
  type TripContent,
} from '../../utils/shareCard';
import { downloadBlob } from '../../utils/exportMapImage';
import {
  renderTripVideo,
  captureTripScene,
  isVideoExportSupported,
  videoFileExtension,
  type TripVideoScene,
} from '../../utils/exportMapVideo';
import { useToast } from '../../components/Toast/ToastProvider';
import { useAuth } from '../auth/authApi';
import { useGetLegPhotoIdsQuery } from '../flights/flightsApi';
import { useGetCountriesQuery } from '../visits/visitsApi';
import { renderGlobeTripVideo } from '../../utils/exportGlobeVideo';
import { legEndpoints, legMode } from '../../components/FlightMap/routeUtils';
import { ensureTerrainWaypoints, modeMedium } from '../../lib/terrainRoute';
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
  /** Which pipeline stage the video is in - "0%" alone hid which of the
      five pre-render steps was stuck (owner report, 2026-08-18). */
  const [videoStage, setVideoStage] = useState<string | null>(null);
  /** Which film is rendering, so each button narrates only its own run. */
  const [videoKind, setVideoKind] = useState<'flat' | 'globe' | null>(null);
  /** The chosen film style - one dropdown, one button (owner ask,
      2026-08-19: two stacked buttons scaled badly). */
  const [videoStyle, setVideoStyle] = useState<'flat' | 'globe'>('flat');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  /** While capturing scenes, the export canvas frames one leg at a time. */
  const [videoFocusLeg, setVideoFocusLeg] = useState<number | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const canExportVideo = useMemo(() => isVideoExportSupported(), []);
  const { data: photoIds } = useGetLegPhotoIdsQuery();
  // For the globe film: which countries the trip lights up (alpha-3).
  const { data: allCountries = [] } = useGetCountriesQuery();
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
    // legEndpoints: a land stop is a CITY, and reading airports alone
    // dropped Belgrade from the ticket (owner report, 2026-08-18).
    const codes: string[] = [];
    for (const leg of sorted) {
      const endpoints = legEndpoints(leg);
      if (!endpoints) continue;
      if (codes.length === 0) codes.push(endpoints.departure.iataCode);
      codes.push(endpoints.arrival.iataCode);
    }
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
    setVideoKind('flat');
    // Regenerating replaces the previous take.
    setVideoFile(null);
    /*
      Stage labels + per-stage timeouts + a breadcrumb trail (owner
      report, 2026-08-18: a long journey sat at "0%" with no clue which
      step was stuck). Every await below is visible in the button,
      bounded in time, logged to the console with timings, and named in
      the error toast when it fails - debuggable ON PROD, no dev tools
      required to know which stage died.
    */
    const startedAt = performance.now();
    const stageLog: string[] = [];
    const stage = (label: string) => {
      const at = ((performance.now() - startedAt) / 1000).toFixed(1);
      stageLog.push(`${label} @${at}s`);
       
      console.info(`[trip-video] ${label} (+${at}s)`);
      setVideoStage(label);
    };
    stage('Preparing the map');
    /*
      The same readiness the card render waits for (owner repro,
      2026-08-18): data-framed settles from airport coordinates before
      the world atlas has downloaded, so a quick "Create video" on a
      fresh dialog filmed an empty ocean - clicking Share first "fixed"
      it only because the card path waited for the geography.
    */
    try {
      await waitForGeography(svg);
    } catch (geoError) {
      setVideoProgress(null);
      setVideoStage(null);
      showToast(
        geoError instanceof Error
          ? geoError.message
          : 'The map is still loading - try again in a moment',
        { tone: 'error' },
      );
      return;
    }
    const objectUrls: string[] = [];
    try {
      const km = legs.reduce(
        (sum, leg) => sum + (Number(leg.distanceKm) || 0),
        0,
      );
      /*
        Stop postcards for the film: the same authed per-leg photos the
        replay shows, fetched here as images. A missing, failing or SLOW
        photo is a null - the video just flies past that stop rather
        than hanging the whole render on one request.
      */
      stage('Fetching stop photos');
      const base = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';
      const photos = await Promise.all(
        legs.map(async (leg) => {
          if (!leg.id || !photoLegSet.has(leg.id)) return null;
          try {
            const response = await fetch(
              `${base}/flights/legs/${leg.id}/photo`,
              { credentials: 'include', signal: AbortSignal.timeout(8000) },
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

      /*
        Terrain routes must be IN before any scene is captured: on a cold
        cache the router answers a beat after first render, and a scene
        snapped in that beat would film the ferry cutting the straight
        chord across a cape (self-review, 2026-08-18). Resolved answers
        return instantly from the module cache. Time-capped: a marathon
        route computation must not hold the film hostage - an unrouted
        leg draws its straight chord, which is exactly what the map
        shows in that state too.
      */
      stage('Plotting routes');
      await Promise.race([
        Promise.all(
          legs.map((leg) => {
            const medium = modeMedium(legMode(leg));
            const endpoints = legEndpoints(leg);
            if (!medium || !endpoints) return null;
            return ensureTerrainWaypoints(
              [
                Number(endpoints.departure.longitude),
                Number(endpoints.departure.latitude),
              ],
              [
                Number(endpoints.arrival.longitude),
                Number(endpoints.arrival.latitude),
              ],
              medium,
            );
          }),
        ),
        new Promise((resolve) => setTimeout(resolve, 15000)),
      ]);
      // One settle frame so FlightRoutes re-renders with the answers.
      await new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r)),
      );

      /*
        The animated camera (2026-08-18): capture one scene per leg by
        re-aiming the export canvas at that leg and waiting for its
        framing to settle. The film then cuts between sharp close-ups
        instead of digitally zooming one blurry continental frame.
      */
      const waitForFraming = async (legNumber: number) => {
        await new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        );
        const deadline = Date.now() + 15000;
        while (svg.getAttribute('data-framed') !== '1') {
          if (Date.now() > deadline) {
            throw new Error(
              `The map could not frame leg ${legNumber} of ${legs.length} - try again`,
            );
          }
          await new Promise((r) => setTimeout(r, 60));
        }
      };
      const scenes: TripVideoScene[] = [];
      for (let i = 0; i < legs.length; i++) {
        stage(`Framing leg ${i + 1} of ${legs.length}`);
        setVideoFocusLeg(legs[i].legOrder);
        await waitForFraming(i + 1);
        scenes.push(await captureTripScene(svg, i));
      }
      setVideoFocusLeg(null);

      stage('Recording journey');
      const blob = await renderTripVideo(
        scenes,
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
      const lastStage = stageLog[stageLog.length - 1] ?? 'start';
      const message =
        videoError instanceof Error
          ? videoError.message
          : 'Could not create the video';
      // The toast names the dying stage; the console keeps the whole
      // trail with timings; Umami gets an event - three places to
      // debug a prod failure without a repro (owner ask, 2026-08-18).
       
      console.error('[trip-video] failed:', message, '| trail:', stageLog.join(' → '));
      // Stage AND message: the first prod failure only recorded the
      // stage, which named the room but not the body (2026-08-18).
      track('video_error', {
        stage: lastStage.split(' @')[0],
        message: message.slice(0, 100),
      });
      showToast(`${message} (failed at: ${lastStage})`, { tone: 'error' });
    } finally {
      setVideoProgress(null);
      setVideoStage(null);
      setVideoKind(null);
      setVideoFocusLeg(null);
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

  /*
    The globe film (owner ask, 2026-08-19): no SVG, no scene capture -
    a bespoke canvas painter flies the same timeline the live globe
    replay does. Pipeline is therefore two stages: plot routes, record.
  */
  const handleCreateGlobeVideo = useCallback(async () => {
    setVideoProgress(0);
    setVideoKind('globe');
    // Regenerating replaces the previous take.
    setVideoFile(null);
    const startedAt = performance.now();
    const stageLog: string[] = [];
    const stage = (label: string) => {
      const at = ((performance.now() - startedAt) / 1000).toFixed(1);
      stageLog.push(`${label} @${at}s`);
      console.info(`[globe-video] ${label} (+${at}s)`);
      setVideoStage(label);
    };
    try {
      stage('Plotting routes');
      await Promise.race([
        Promise.all(
          legs.map((leg) => {
            const medium = modeMedium(legMode(leg));
            const endpoints = legEndpoints(leg);
            if (!medium || !endpoints) return null;
            return ensureTerrainWaypoints(
              [
                Number(endpoints.departure.longitude),
                Number(endpoints.departure.latitude),
              ],
              [
                Number(endpoints.arrival.longitude),
                Number(endpoints.arrival.latitude),
              ],
              medium,
            );
          }),
        ),
        new Promise((resolve) => setTimeout(resolve, 15000)),
      ]);

      stage('Recording journey');
      const alpha2ToAlpha3 = new Map(
        allCountries.map((country) => [country.isoCode2, country.isoCode]),
      );
      const tripIsos = new Set<string>();
      for (const leg of legs) {
        const endpoints = legEndpoints(leg);
        for (const place of [endpoints?.departure, endpoints?.arrival]) {
          const alpha3 = place?.countryIso
            ? alpha2ToAlpha3.get(place.countryIso)
            : null;
          if (alpha3) tripIsos.add(alpha3);
        }
      }
      // Every stop, labelled: the departure plus each arrival, deduped.
      const stops: { lon: number; lat: number; label: string }[] = [];
      const seen = new Set<string>();
      const addStop = (place?: {
        longitude: number | string;
        latitude: number | string;
        iataCode: string;
      }) => {
        if (!place || seen.has(place.iataCode)) return;
        seen.add(place.iataCode);
        stops.push({
          lon: Number(place.longitude),
          lat: Number(place.latitude),
          label: place.iataCode,
        });
      };
      for (const leg of legs) {
        const endpoints = legEndpoints(leg);
        addStop(endpoints?.departure);
        addStop(endpoints?.arrival);
      }
      const blob = await renderGlobeTripVideo(
        journey,
        { routeCodes, dateLabel: formatJourneyDate(journey), stops },
        tripIsos,
        setVideoProgress,
        // Slower than the flat film: the globe's chase IS the show.
        Math.min(Math.max(legs.length * 3200, 6000), 14000),
      );
      track('share_render', { style: 'globe-video' });
      const extension = videoFileExtension(blob.type);
      const videoName = filename.replace(/\.png$/, `-globe.${extension}`);
      const shareType = blob.type.split(';')[0] || 'video/mp4';
      setVideoFile(new File([blob], videoName, { type: shareType }));
    } catch (videoError) {
      const lastStage = stageLog[stageLog.length - 1] ?? 'start';
      const message =
        videoError instanceof Error
          ? videoError.message
          : 'Could not create the video';
      console.error(
        '[globe-video] failed:',
        message,
        '| trail:',
        stageLog.join(' → '),
      );
      track('video_error', {
        stage: `globe: ${lastStage.split(' @')[0]}`,
        message: message.slice(0, 100),
      });
      showToast(`${message} (failed at: ${lastStage})`, { tone: 'error' });
    } finally {
      setVideoProgress(null);
      setVideoStage(null);
      setVideoKind(null);
    }
  }, [legs, journey, routeCodes, filename, showToast, allCountries]);

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
      <MapExportCanvas
        theme="light"
        journey={journey}
        focusLegOrder={videoFocusLeg}
        svgId={TRIP_SVG_ID}
      />

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
        {/* One style picker, one button - and it stays after a take, so
            sharing or rejecting a video never ends the session (owner,
            2026-08-19). A new take replaces the old one. */}
        {canExportVideo && (
          <div className="flex items-stretch gap-2">
            {/* Segmented chips with the app's own SVG marks, not a bare
                native select (owner, 2026-08-19: match the app's control
                language, and the map/globe icons already exist). */}
            <div
              role="radiogroup"
              aria-label="Video style"
              className="flex items-center gap-1 p-1 rounded-xl bg-surface-sunken"
            >
              {(
                [
                  {
                    value: 'flat' as const,
                    label: 'Map',
                    icon: (
                      <svg
                        className="w-4 h-4 flex-shrink-0"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.8}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M9 4L3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4zM9 4v14M15 6v14" />
                      </svg>
                    ),
                  },
                  {
                    value: 'globe' as const,
                    label: 'Globe',
                    icon: (
                      <svg
                        className="w-4 h-4 flex-shrink-0"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.8}
                        aria-hidden="true"
                      >
                        <circle cx="12" cy="12" r="9" />
                        <ellipse cx="12" cy="12" rx="4" ry="9" />
                        <path d="M3.6 9h16.8M3.6 15h16.8" />
                      </svg>
                    ),
                  },
                ]
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={videoStyle === option.value}
                  disabled={videoProgress !== null}
                  onClick={() => setVideoStyle(option.value)}
                  className={`min-h-9 px-2.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
                    videoStyle === option.value
                      ? 'bg-secondary-600 text-white'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  {option.icon}
                  {option.label}
                </button>
              ))}
            </div>
            <Button
              variant="ghost"
              fullWidth
              className="rounded-xl flex-1"
              onClick={
                videoStyle === 'flat'
                  ? handleCreateVideo
                  : handleCreateGlobeVideo
              }
              disabled={!previewUrl || videoProgress !== null}
            >
              {videoProgress !== null && videoKind !== null
                ? videoStage === 'Recording journey' || videoStage === null
                  ? `Recording journey… ${Math.round(videoProgress * 100)}%`
                  : `${videoStage}…`
                : videoFile
                  ? 'Create another video'
                  : 'Create video'}
            </Button>
          </div>
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
