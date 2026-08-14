import { legPhotoUrl } from '../../features/flights/StopPhotoControl';

/**
 * The postcard (trip photos, 2026-08-14): a tilted polaroid that pops in
 * as the replay lands at a stop with a photo, holds through the ground
 * pause, and leaves. White frame on purpose — polaroids are white in both
 * themes. Shared by the flat map and the globe.
 */
function PostcardOverlay({
  postcard,
}: {
  postcard: { legId: number; key: number } | null;
}) {
  if (!postcard) return null;
  return (
    <div
      key={postcard.key}
      aria-hidden="true"
      className="postcard-pop absolute z-30 bottom-24 right-4 lg:right-20 pointer-events-none"
    >
      <div className="bg-white p-2 pb-6 rounded shadow-2xl -rotate-3">
        <img
          src={legPhotoUrl(postcard.legId)}
          alt=""
          className="w-44 h-32 object-cover rounded-sm"
        />
      </div>
    </div>
  );
}

export default PostcardOverlay;
