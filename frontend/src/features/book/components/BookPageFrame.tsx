import type { ReactNode } from 'react';
import { BASE_PAGE_HEIGHT, BASE_PAGE_WIDTH } from './FlipBook';

/** Fine paper grain, inline so the book needs no image assets. */
const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.35  0 0 0 0 0.27  0 0 0 0 0.18  0 0 0 0.09 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

interface BookPageFrameProps {
  side: 'left' | 'right' | 'single';
  variant?: 'paper' | 'cover';
  /** Printed page number; omitted on covers and openers. */
  pageNumber?: number;
  /** Decoration behind the content (flags). */
  backdrop?: ReactNode;
  children: ReactNode;
}

/**
 * One physical page: stock, grain, the shadow where it meets the spine,
 * the page number. Content is laid out at the base page size and scaled
 * with --page-scale (set by FlipBook), so every page keeps its design at
 * any screen size.
 */
function BookPageFrame({ side, variant = 'paper', pageNumber, backdrop, children }: BookPageFrameProps) {
  const isCover = variant === 'cover';
  // The spine is on the left of a right-hand page and vice versa.
  const gutter =
    side === 'right'
      ? 'linear-gradient(to right, rgb(0 0 0 / 0.16), rgb(0 0 0 / 0.04) 6%, transparent 14%)'
      : side === 'left'
        ? 'linear-gradient(to left, rgb(0 0 0 / 0.16), rgb(0 0 0 / 0.04) 6%, transparent 14%)'
        : 'linear-gradient(to right, rgb(0 0 0 / 0.10), transparent 6%)';

  return (
    <div
      className={[
        'absolute inset-0 overflow-hidden',
        isCover ? 'bg-binding text-binding-foil' : 'bg-paper text-ink',
        side === 'left' ? 'rounded-l-md' : side === 'right' ? 'rounded-r-md' : 'rounded-md',
      ].join(' ')}
      style={{ boxShadow: 'var(--shadow-lg)' }}
    >
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: GRAIN }} />
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{
          width: BASE_PAGE_WIDTH,
          height: BASE_PAGE_HEIGHT,
          transform: 'scale(var(--page-scale, 1))',
        }}
      >
        {/* Scaled with the page, so flags keep their size relative to the text. */}
        {backdrop && <div className="absolute inset-0 overflow-hidden pointer-events-none">{backdrop}</div>}
        {children}
        {pageNumber !== undefined && !isCover && (
          <span
            className={[
              'absolute bottom-5 font-serif text-[11px] text-ink-subtle tabular-nums',
              side === 'left' ? 'left-7' : 'right-7',
            ].join(' ')}
          >
            {pageNumber}
          </span>
        )}
      </div>
      {!isCover && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: gutter }}
        />
      )}
      {isCover && (
        // Leather sheen and a pressed border, both in foil.
        <>
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                'radial-gradient(120% 80% at 30% 20%, rgb(255 255 255 / 0.10), transparent 60%), linear-gradient(to right, rgb(0 0 0 / 0.35), transparent 7%)',
            }}
          />
          <div className="absolute inset-[4%] rounded-sm border border-binding-foil/40 pointer-events-none" />
        </>
      )}
    </div>
  );
}

export default BookPageFrame;
