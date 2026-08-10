import { useEffect, useRef, useState, type ReactNode } from 'react';

interface SectionPanelProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  /**
   * 'sheet' overlays the map on small screens; 'dock' sits beside it on large
   * ones. The caller picks, because the two live at different points in the
   * layout tree — the sheet must be inside the canvas box to float over the
   * map, the dock must be a sibling of it.
   */
  variant: 'sheet' | 'dock';
}

const SWIPE_DISMISS_PX = 90;

/**
 * The section container: a docked column on desktop, a bottom sheet on mobile.
 *
 * The mobile sheet is deliberately **not** a modal. It covers a little over
 * half the screen and leaves the map live above it, because the reward for
 * adding a country is watching it fill in. A full-screen or confirm-to-dismiss
 * sheet would hide exactly the thing the action is for, and toggling countries
 * is repeated rather than a one-shot commit.
 */
function SectionPanel({
  title,
  isOpen,
  onClose,
  children,
  variant,
}: SectionPanelProps) {
  const [dragOffset, setDragOffset] = useState(0);
  const dragStartY = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  // Reset scroll and any in-flight drag when switching sections.
  useEffect(() => {
    if (isOpen) {
      setDragOffset(0);
      scrollRef.current?.scrollTo({ top: 0 });
    }
  }, [isOpen, title]);

  if (!isOpen) return null;

  const handleTouchStart = (event: React.TouchEvent) => {
    // Only start a dismiss drag from the top of the content, otherwise this
    // fights with scrolling a long country list.
    if ((scrollRef.current?.scrollTop ?? 0) > 0) return;
    dragStartY.current = event.touches[0].clientY;
  };

  const handleTouchMove = (event: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const delta = event.touches[0].clientY - dragStartY.current;
    setDragOffset(Math.max(0, delta));
  };

  const handleTouchEnd = () => {
    if (dragOffset > SWIPE_DISMISS_PX) onClose();
    setDragOffset(0);
    dragStartY.current = null;
  };

  if (variant === 'dock') {
    return (
      <aside
        aria-label={title}
        className="hidden lg:flex flex-col w-[26rem] xl:w-[30rem] flex-shrink-0 border-l border-line bg-surface"
      >
        <header className="flex-shrink-0 flex items-center justify-between px-5 h-14 border-b border-line">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${title}`}
            className="w-9 h-9 -mr-1 flex items-center justify-center rounded-lg text-ink-subtle hover:bg-surface-sunken focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </header>
        <div className="flex-1 min-h-0 overflow-y-auto p-5">{children}</div>
      </aside>
    );
  }

  return (
    <>
      {/* Mobile: bottom sheet over a still-visible, still-interactive map */}
      <section
        aria-label={title}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: dragOffset ? `translateY(${dragOffset}px)` : undefined,
          transition: dragOffset ? 'none' : 'transform 150ms ease-out',
        }}
        className="lg:hidden absolute inset-x-0 bottom-0 z-30 h-[58%] flex flex-col bg-surface rounded-t-2xl shadow-[0_-8px_24px_rgba(15,23,42,0.14)] border-t border-line"
      >
        <div className="flex-shrink-0 pt-2 pb-1">
          {/* Grab handle — the affordance for swipe-to-dismiss */}
          <div
            className="mx-auto w-10 h-1.5 rounded-full bg-line-strong"
            aria-hidden="true"
          />
        </div>
        <header className="flex-shrink-0 flex items-center justify-between px-4 pb-2">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${title}`}
            className="w-11 h-11 -mr-2 flex items-center justify-center rounded-lg text-ink-subtle hover:bg-surface-sunken focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </header>
        <div
          ref={scrollRef}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-4"
        >
          {children}
        </div>
      </section>
    </>
  );
}

export default SectionPanel;
