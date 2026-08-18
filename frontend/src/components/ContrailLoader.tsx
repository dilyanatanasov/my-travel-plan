interface ContrailLoaderProps {
  /** Fill the viewport (route-level loads) or sit inline in a panel. */
  fullScreen?: boolean;
  label?: string;
}

/**
 * The loading state IS the brand (owner idea, 2026-08-18): the logo's
 * contrail arc draws itself from the hollow origin to the destination
 * dot, which pops on arrival - then the trail fades and flies again.
 * Pure CSS (.contrail-loader-* in index.css), a static mark under
 * prefers-reduced-motion.
 *
 * Geometry mirrors BrandMark - kept in sync by hand, same as the
 * favicon; the arc carries pathLength=1 so the draw animation needs no
 * measured length.
 */
function ContrailLoader({
  fullScreen = false,
  label = 'Loading…',
}: ContrailLoaderProps) {
  const mark = (
    <span
      role="status"
      aria-label={label}
      className="inline-flex contrail-loader-shell"
    >
      <svg
        viewBox="10 10 44 44"
        fill="none"
        aria-hidden="true"
        className="w-12 h-12 text-brand-600"
      >
        <path
          className="contrail-loader-arc"
          d="M17.06 40.92 A 32 32 0 0 1 48 18"
          pathLength={1}
          stroke="currentColor"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        <circle
          className="contrail-loader-dot"
          cx="48"
          cy="18"
          r="5.5"
          fill="currentColor"
        />
        <circle
          cx="16"
          cy="46"
          r="4.2"
          stroke="currentColor"
          strokeWidth="2.8"
        />
      </svg>
    </span>
  );

  if (!fullScreen) return mark;
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-canvas">
      {mark}
    </div>
  );
}

export default ContrailLoader;
