interface BrandMarkProps {
  className?: string;
}

/**
 * The Contrail mark: a great-circle arc from a hollow origin waypoint to a
 * solid destination one.
 *
 * Strokes use currentColor so the mark inherits whatever it sits on, which is
 * what lets the same component work on the teal auth tile and in the header
 * in both themes. Kept in sync by hand with public/favicon.svg — that one
 * cannot import from here, since it is fetched by the browser as a file.
 */
function BrandMark({ className }: BrandMarkProps) {
  return (
    <svg
      className={className}
      /*
        Cropped to the mark's own bounds rather than the icon's 0 0 64 64 box.
        That box exists so the favicon has breathing room inside its rounded
        square; reusing it here would render the mark at half the size of
        whatever tile it is placed in, with the origin ring too small to read.
      */
      viewBox="10 10 44 44"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M17.06 40.92 A 32 32 0 0 1 48 18"
        stroke="currentColor"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <circle cx="48" cy="18" r="5.5" fill="currentColor" />
      {/*
        The hollow origin is a ring, not a disc filled with the background
        colour: filling it would need to know what it is sitting on, and it
        sits on three different surfaces.
      */}
      <circle cx="16" cy="46" r="4.2" stroke="currentColor" strokeWidth="2.8" />
    </svg>
  );
}

export default BrandMark;
