import { useEffect, useRef, useState } from 'react';

const HINT_KEY = 'mycontrail-map-hint-dismissed';

/**
 * The one-time "what can I do here" card (friend feedback, 2026-08-17:
 * the interactions exist but nothing announces them).
 *
 * Once per device, dismissible, and it retires itself the moment the visit
 * count changes — the first successful tap proves the lesson landed better
 * than any tooltip could. localStorage failure counts as dismissed: in
 * private browsing an eternal tooltip is worse than none.
 */
function MapOnboardingHint({
  visitCount,
  ready,
}: {
  visitCount: number;
  /** False while the visits query is loading — the count arriving from the
   *  server must not read as "the user's first tap" and eat the hint. */
  ready: boolean;
}) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(HINT_KEY) === '1';
    } catch {
      return true;
    }
  });
  const armedCount = useRef<number | null>(null);

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(HINT_KEY, '1');
    } catch {
      /* session-only dismissal is fine */
    }
  };

  useEffect(() => {
    if (!ready) return;
    if (armedCount.current === null) {
      armedCount.current = visitCount;
      return;
    }
    if (!dismissed && visitCount !== armedCount.current) dismiss();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, visitCount, dismissed]);

  if (dismissed) return null;

  return (
    <div
      role="note"
      className="absolute bottom-40 sm:bottom-24 left-1/2 -translate-x-1/2 z-30 w-[min(92vw,22rem)]
        map-glass rounded-2xl border shadow-xl px-4 py-3"
    >
      <div className="flex items-start gap-3">
        <p className="text-sm leading-relaxed flex-1">
          <span className="font-semibold">Tap a country</span> to mark it
          visited — tap again to cycle transit and want&nbsp;to&nbsp;go.{' '}
          <span className="font-semibold">Hold or right-click</span> for
          details.
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="flex-shrink-0 min-h-8 px-2 rounded-lg text-xs font-medium
            hover:bg-current/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

export default MapOnboardingHint;
