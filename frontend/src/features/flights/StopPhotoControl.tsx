import { useRef, useState } from 'react';
import {
  useGetLegPhotoIdsQuery,
  useUploadLegPhotoMutation,
  useDeleteLegPhotoMutation,
} from './flightsApi';
import { useToast } from '../../components/Toast/ToastProvider';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

/** Authed photo URL - <img> sends same-origin cookies, so no client magic. */
export function legPhotoUrl(legId: number, cacheBust?: number): string {
  return `${API_BASE}/flights/legs/${legId}/photo${
    cacheBust ? `?v=${cacheBust}` : ''
  }`;
}

/**
 * The camera on a stop chip (trip photos, 2026-08-14): upload, replace via
 * tapping the thumbnail, remove via its ✕. One photo per stop - the server
 * enforces it; this just mirrors it. Shared wherever a stop is shown.
 */
function StopPhotoControl({ legId }: { legId: number }) {
  const { data } = useGetLegPhotoIdsQuery();
  const hasPhoto = data?.legIds.includes(legId) ?? false;
  const [uploadPhoto, { isLoading: isUploading }] = useUploadLegPhotoMutation();
  const [deletePhoto] = useDeleteLegPhotoMutation();
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  // Bumped after a replace so the <img> refetches past its cache.
  const [cacheBust, setCacheBust] = useState(0);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showToast('Photos can be at most 10MB', { tone: 'error' });
      return;
    }
    try {
      await uploadPhoto({ legId, file }).unwrap();
      setCacheBust(Date.now());
      showToast('Postcard saved - it will appear in your replay', {
        tone: 'success',
      });
    } catch (error) {
      const message =
        (error as { data?: { message?: string } })?.data?.message ??
        'Could not upload that photo';
      showToast(message, { tone: 'error' });
    }
  };

  const handleRemove = async () => {
    try {
      await deletePhoto(legId).unwrap();
      showToast('Photo removed', { tone: 'success' });
    } catch {
      showToast('Could not remove the photo', { tone: 'error' });
    }
  };

  return (
    <span className="inline-flex items-center">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {hasPhoto ? (
        <span className="relative inline-flex">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
            aria-label="Replace this stop's photo"
            title="Replace photo"
            className="rounded overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-50"
          >
            <img
              src={legPhotoUrl(legId, cacheBust)}
              alt=""
              className="w-7 h-7 object-cover"
            />
          </button>
          <button
            type="button"
            onClick={handleRemove}
            aria-label="Remove this stop's photo"
            title="Remove photo"
            className="absolute -top-1.5 -right-1.5 w-4 h-4 flex items-center justify-center rounded-full bg-surface border border-line text-ink-subtle hover:text-red-500 text-[9px] leading-none"
          >
            ✕
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          aria-label="Add a photo to this stop"
          title="Add a photo - it shows as a postcard in your replay"
          className="p-1 text-ink-subtle hover:text-brand-700 hover:bg-brand-50 rounded transition-colors disabled:opacity-50"
        >
          <svg
            className={`w-4 h-4 ${isUploading ? 'animate-pulse' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>
      )}
    </span>
  );
}

export default StopPhotoControl;
