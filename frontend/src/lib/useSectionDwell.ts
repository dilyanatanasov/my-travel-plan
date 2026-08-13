import { useEffect, useRef } from 'react';
import { track } from './analytics';

/**
 * Reports `section_view { section, dwellMs }` when a section is *left* —
 * that is the only moment the dwell is known.
 *
 * visibilitychange counts too: a tab hidden or closed flushes the dwell
 * accumulated so far, so "left the tab open overnight" does not read as
 * twelve hours of engagement. Sub-second dwells are dropped as navigation
 * noise rather than views.
 */
export function useSectionDwell(section: string): void {
  const enteredAt = useRef(Date.now());

  useEffect(() => {
    enteredAt.current = Date.now();

    const flush = () => {
      const dwellMs = Date.now() - enteredAt.current;
      if (dwellMs > 500) {
        track('section_view', { section, dwellMs });
      }
      // Restart the clock: after a flush-on-hide, time only re-accumulates
      // from now, so the hidden interval is never counted.
      enteredAt.current = Date.now();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };

    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      flush();
    };
  }, [section]);
}
