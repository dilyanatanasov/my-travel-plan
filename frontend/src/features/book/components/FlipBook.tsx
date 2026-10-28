import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';

/** Page shape: 3:4, fixed so the book reads as a book and can print later. */
export const PAGE_RATIO = 3 / 4;
/**
 * Pages are designed at this size and scaled to fit, so type and layout
 * hold their proportions on every screen (and in a future print export).
 */
export const BASE_PAGE_WIDTH = 450;
export const BASE_PAGE_HEIGHT = 600;
const TURN_MS = 750;
/** Below this the stage shows one page at a time (Tailwind md). */
const SPREAD_MIN_WIDTH = 768;

export interface FlipBookApi {
  goTo: (page: number) => void;
  next: () => void;
  prev: () => void;
}

interface FlipBookProps {
  pageCount: number;
  /** side tells the page which edge is the spine, for the gutter shadow. */
  renderPage: (index: number, side: 'left' | 'right' | 'single', api: FlipBookApi) => ReactNode;
  pageLabel: (index: number) => string;
  initialPage?: number;
  onPageChange?: (page: number) => void;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

interface Drag {
  pointerId: number;
  startX: number;
  startY: number;
  /** Started on a button or link: a still tap is that control's click. */
  onControl: boolean;
  /** Horizontal travel so far; positive is to the right. */
  dx: number;
  /** The leaf being dragged and which way it travels. */
  leaf: number;
  forward: boolean;
  progress: number;
  moved: boolean;
  /** Forward from the back cover: closes the book and reopens it at the cover. */
  loop: boolean;
}

/**
 * A hardcover book with 3D page turns (travel book, 2026-10-27).
 *
 * The book is a stack of leaves. Each leaf is one sheet of paper hinged on
 * the spine: its front is a right-hand page, its back the next left-hand
 * page. A turned leaf is rotated -180deg around the spine, so its back
 * faces up on the left. On phones every page is its own leaf with a blank
 * back, which turns the same way and simply disappears once over.
 *
 * Only the leaves around the open spread are mounted, so a book of a
 * hundred trips costs the same as a book of three.
 */
function FlipBook({ pageCount, renderPage, pageLabel, initialPage = 0, onPageChange }: FlipBookProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState({ width: 0, height: 0 });
  const reducedMotion = usePrefersReducedMotion();

  useLayoutEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const measure = () => setStage({ width: node.clientWidth, height: node.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const spread = stage.width >= SPREAD_MIN_WIDTH;
  const pad = spread ? 48 : 24;
  const pageWidth = Math.max(
    0,
    Math.floor(
      spread
        ? Math.min((stage.height - pad) * PAGE_RATIO, (stage.width - pad * 2) / 2)
        : Math.min((stage.height - pad) * PAGE_RATIO, stage.width - pad),
    ),
  );
  const pageHeight = Math.floor(pageWidth / PAGE_RATIO);

  // The page is the source of truth; leaves are derived per layout, so a
  // resize across the breakpoint keeps the reader on the same page.
  const [page, setPage] = useState(() => Math.min(Math.max(initialPage, 0), pageCount - 1));
  const leafCount = spread ? pageCount / 2 : pageCount;
  const turned = spread ? Math.ceil(page / 2) : page;
  /*
    Where the book ends. In spreads the back cover is the last leaf's back,
    shown once every leaf is turned. On a phone the back cover is the last
    leaf's front, so turning that leaf too would leave a blank page.
  */
  const maxTurned = spread ? leafCount : leafCount - 1;
  const atEnd = turned >= maxTurned;

  const [drag, setDrag] = useState<Drag | null>(null);
  const [turning, setTurning] = useState<number | null>(null);
  const [jumpKey, setJumpKey] = useState(0);
  const turningTimer = useRef<number>();

  const pageForTurned = useCallback(
    (t: number) => (spread ? (t === 0 ? 0 : 2 * t - 1) : t),
    [spread],
  );

  const turnTo = useCallback(
    (nextTurned: number) => {
      const clamped = Math.min(Math.max(nextTurned, 0), maxTurned);
      if (clamped === turned) return;
      if (Math.abs(clamped - turned) > 1) {
        // A jump (contents, chapter links) fades instead of riffling.
        setJumpKey((k) => k + 1);
      } else {
        setTurning(clamped > turned ? turned : clamped);
        window.clearTimeout(turningTimer.current);
        turningTimer.current = window.setTimeout(() => setTurning(null), TURN_MS);
      }
      setPage(pageForTurned(clamped));
    },
    [maxTurned, turned, pageForTurned],
  );

  /** Past the back cover: the book closes and opens again at the cover. */
  const restart = useCallback(() => {
    setJumpKey((k) => k + 1);
    setPage(0);
  }, []);

  const api: FlipBookApi = {
    goTo: (target) => turnTo(spread ? Math.ceil(target / 2) : target),
    next: () => (atEnd ? restart() : turnTo(turned + 1)),
    prev: () => turnTo(turned - 1),
  };
  const apiRef = useRef(api);
  apiRef.current = api;
  /** Same object for the book's life, so memoized pages are not re-rendered by it. */
  const stableApi = useMemo<FlipBookApi>(
    () => ({
      goTo: (target) => apiRef.current.goTo(target),
      next: () => apiRef.current.next(),
      prev: () => apiRef.current.prev(),
    }),
    [],
  );

  // Through a ref: a parent's callback identity must not re-fire this.
  const onPageChangeRef = useRef(onPageChange);
  onPageChangeRef.current = onPageChange;
  useEffect(() => onPageChangeRef.current?.(page), [page]);
  useEffect(() => () => window.clearTimeout(turningTimer.current), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key === 'ArrowRight' || event.key === 'PageDown') apiRef.current.next();
      else if (event.key === 'ArrowLeft' || event.key === 'PageUp') apiRef.current.prev();
      else if (event.key === 'Home') apiRef.current.goTo(0);
      else if (event.key === 'End') apiRef.current.goTo(pageCount - 1);
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pageCount]);

  // --- Drag to turn -------------------------------------------------------
  const bookRef = useRef<HTMLDivElement>(null);

  /*
    A swipe may start anywhere, buttons included: the contents page is
    almost all buttons, and skipping them meant a swipe there never turned
    the page, and the browser then read the swipe as a tap on a chapter
    and jumped to it (owner report, 2026-10-28: "from 3 to 64"). So:
    pointer capture only starts once the finger really travels sideways,
    a gesture that moved swallows the click that follows, and a still tap
    on a button or link is left to the button or link.
  */
  const suppressClick = useRef(false);

  const onClickCapture = (event: React.MouseEvent) => {
    if (!suppressClick.current) return;
    suppressClick.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  const onPointerDown = (event: React.PointerEvent) => {
    suppressClick.current = false;
    if (event.button !== 0 || reducedMotion) return;
    const rect = bookRef.current?.getBoundingClientRect();
    if (!rect) return;
    /*
      On the closed back cover a tap or a swipe to the left reopens the
      book at the front; only a drag to the right goes back a page (see
      onPointerUp). Elsewhere the tapped side decides the direction.
    */
    const split = spread ? rect.left + rect.width / 2 : rect.left + rect.width * 0.3;
    const loop = atEnd;
    const forward = loop || event.clientX > split;
    const leaf = forward ? turned : turned - 1;
    if (!loop && (leaf < 0 || leaf >= leafCount)) return;
    const onControl = Boolean((event.target as HTMLElement).closest('a, button'));
    setDrag({
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dx: 0,
      leaf,
      forward,
      progress: 0,
      moved: false,
      loop,
      onControl,
    });
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dx = event.clientX - drag.startX;
    let moved = drag.moved;
    if (!moved) {
      // Wait for a clearly sideways move; a small wobble is still a tap.
      const dy = event.clientY - drag.startY;
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
      moved = true;
      suppressClick.current = true;
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    }
    const travel = pageWidth * (spread ? 1.6 : 1);
    const raw = drag.forward ? -dx / travel : dx / travel;
    const progress = Math.min(Math.max(raw, 0), 1);
    setDrag({ ...drag, progress, dx, moved });
  };

  const onPointerUp = (event: React.PointerEvent) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    setDrag(null);
    // A still tap on a button or link belongs to it, not to the book.
    if (!drag.moved && drag.onControl) return;
    if (drag.loop) {
      if (!drag.moved || drag.progress > 0.3) restart();
      else if (drag.dx > 0) turnTo(turned - 1);
      return;
    }
    if (!drag.moved) {
      // A tap turns the page on the side that was tapped.
      turnTo(drag.forward ? turned + 1 : turned - 1);
      return;
    }
    if (drag.progress > 0.3) turnTo(drag.forward ? turned + 1 : turned - 1);
    else {
      // Let it fall back with the normal transition.
      setTurning(drag.leaf);
      window.clearTimeout(turningTimer.current);
      turningTimer.current = window.setTimeout(() => setTurning(null), TURN_MS);
    }
  };

  // --- Layout ---------------------------------------------------------------
  const bookWidth = spread ? pageWidth * 2 : pageWidth;
  /*
    A closed book sits centred: the front cover alone is the right half of
    the spread, so shift it left by half a page; the back cover the other
    way. Phones show one page and need no shift.
  */
  const shift = !spread ? 0 : turned === 0 ? -pageWidth / 2 : turned === leafCount ? pageWidth / 2 : 0;

  // Spreads need two turned leaves (the left page under the one turning back).
  const firstLeaf = Math.max(0, turned - (spread ? 2 : 1));
  const lastLeaf = Math.min(leafCount - 1, turned + 1);
  const leaves: number[] = [];
  for (let i = firstLeaf; i <= lastLeaf; i++) leaves.push(i);

  const visiblePages = spread
    ? [turned > 0 ? 2 * turned - 1 : null, turned < leafCount ? 2 * turned : null].filter(
        (p): p is number => p !== null,
      )
    : [page];

  const transition = reducedMotion || drag ? 'none' : `transform ${TURN_MS}ms cubic-bezier(0.645, 0.045, 0.355, 1)`;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div
        ref={stageRef}
        className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden select-none"
      >
        {pageWidth > 0 && (
          <div
            key={jumpKey}
            ref={bookRef}
            className={['relative touch-pan-y', jumpKey > 0 && !reducedMotion ? 'animate-book-fade' : '']
              .filter(Boolean)
              .join(' ')}
            style={{
              width: bookWidth,
              height: pageHeight,
              perspective: pageWidth * 4,
              ['--page-scale' as string]: pageWidth / BASE_PAGE_WIDTH,
              transform: `translateX(${shift}px)`,
              transition: reducedMotion ? 'none' : `transform ${TURN_MS}ms ease`,
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => setDrag(null)}
            onClickCapture={onClickCapture}
          >
            {/* The book's own shadow, under whatever is open: one cover or the spread. */}
            <div
              aria-hidden="true"
              className="absolute top-0 rounded-md"
              style={{
                left: spread && turned === 0 ? pageWidth : 0,
                width: spread && turned > 0 && turned < leafCount ? bookWidth : pageWidth,
                height: pageHeight,
                boxShadow: '0 18px 40px rgb(0 0 0 / 0.28), 0 2px 6px rgb(0 0 0 / 0.18)',
              }}
            />
            {leaves.map((leaf) => {
              const isTurned = leaf < turned;
              let angle = isTurned ? -180 : 0;
              const dragging = drag !== null && !drag.loop && drag.leaf === leaf;
              if (dragging) {
                angle = drag.forward ? -180 * drag.progress : -180 + 180 * drag.progress;
              }
              const active = turning === leaf || dragging;
              // Unturned leaves stack first-on-top; turned ones last-on-top.
              const z = active ? 1000 : isTurned ? leaf + 1 : leafCount - leaf;
              const shade = dragging ? Math.sin((Math.abs(angle) * Math.PI) / 180) * 0.35 : 0;
              const frontPage = spread ? 2 * leaf : leaf;
              const backPage = spread ? 2 * leaf + 1 : null;
              const frontVisible = visiblePages.includes(frontPage) && !isTurned;
              const backVisible = backPage !== null && visiblePages.includes(backPage);
              return (
                <div
                  key={`${spread ? 's' : 'p'}${leaf}`}
                  className="absolute top-0"
                  style={{
                    left: spread ? pageWidth : 0,
                    width: pageWidth,
                    height: pageHeight,
                    transformStyle: 'preserve-3d',
                    transformOrigin: 'left center',
                    transform: `rotateY(${angle}deg)`,
                    transition,
                    zIndex: z,
                  }}
                >
                  <Face hidden={!frontVisible} shade={shade} animate={turning === leaf && !reducedMotion}>
                    <PageContent index={frontPage} side={spread ? 'right' : 'single'} renderPage={renderPage} api={stableApi} />
                  </Face>
                  {backPage !== null && (
                    <Face back hidden={!backVisible} shade={shade} animate={turning === leaf && !reducedMotion}>
                      <PageContent index={backPage} side="left" renderPage={renderPage} api={stableApi} />
                    </Face>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <nav
        aria-label="Book pages"
        className="flex-shrink-0 flex items-center justify-center gap-3 py-3"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <button
          type="button"
          onClick={api.prev}
          disabled={turned === 0}
          aria-label="Previous page"
          className="w-11 h-11 flex items-center justify-center rounded-full border border-line bg-surface text-ink
            hover:bg-surface-sunken disabled:opacity-40 disabled:cursor-default focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <p className="min-w-[9rem] text-center text-sm text-ink-muted tabular-nums" aria-live="polite">
          {visiblePages.map(pageLabel).join(' - ')}
        </p>
        <button
          type="button"
          onClick={api.next}
          disabled={pageCount < 2}
          aria-label={atEnd ? 'Back to the cover' : 'Next page'}
          title={atEnd ? 'Back to the cover' : undefined}
          className="w-11 h-11 flex items-center justify-center rounded-full border border-line bg-surface text-ink
            hover:bg-surface-sunken disabled:opacity-40 disabled:cursor-default focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {atEnd ? <path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" /> : <path d="M9 18l6-6-6-6" />}
          </svg>
        </button>
      </nav>
    </div>
  );
}

/*
  A page's content, memoized: dragging re-renders the shell on every
  pointer move, and without this every mounted page (route maps
  included) re-rendered with it - the lag the owner felt on phones.
*/
const PageContent = memo(function PageContent({
  index,
  side,
  renderPage,
  api,
}: {
  index: number;
  side: 'left' | 'right' | 'single';
  renderPage: FlipBookProps['renderPage'];
  api: FlipBookApi;
}) {
  return <>{renderPage(index, side, api)}</>;
});

/** One side of a leaf. The back is pre-rotated so it reads correctly once turned. */
function Face({
  children,
  back = false,
  hidden,
  shade,
  animate,
}: {
  children: ReactNode;
  back?: boolean;
  hidden: boolean;
  shade: number;
  animate: boolean;
}) {
  return (
    <div
      aria-hidden={hidden || undefined}
      className="absolute inset-0 overflow-hidden"
      style={{
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        transform: back ? 'rotateY(180deg)' : undefined,
      }}
    >
      {children}
      {/* Light falling across the sheet as it lifts. */}
      <div
        className={['absolute inset-0 pointer-events-none bg-black', animate ? 'animate-book-shade' : '']
          .filter(Boolean)
          .join(' ')}
        style={{ opacity: animate ? undefined : shade }}
      />
    </div>
  );
}

export default FlipBook;
