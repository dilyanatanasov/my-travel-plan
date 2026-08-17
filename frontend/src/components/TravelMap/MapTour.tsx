import { useState } from 'react';

const TOUR_KEY = 'mycontrail-tour-done';

interface TourStep {
  title: string;
  body: string;
  /** Where the card sits — near the thing it talks about. */
  placement: string;
}

/*
  Three stops, not a manual: the map gesture, where everything else lives,
  and the two reasons to come back. Each card sits near what it describes —
  the "guide around the places to hit" from the 2026-08-17 feedback,
  replacing the two overlapping hint cards that said half of this between
  them in glass too faint to read.
*/
const STEPS: TourStep[] = [
  {
    title: 'This map is the app',
    body: 'Tap any country you’ve been to — tap again to cycle Visited → Lived → Transit → Want to go. Hold (or right-click) a country for details and dates.',
    placement:
      'left-1/2 -translate-x-1/2 bottom-40 sm:bottom-28 w-[min(92vw,24rem)]',
  },
  {
    title: 'Everything else lives here',
    body: 'Overview, Countries, Flights, Statistics and Share. Add the flights you’ve taken and watch them fly in the replay ✈️',
    placement:
      'left-1/2 -translate-x-1/2 bottom-24 sm:left-24 sm:translate-x-0 sm:bottom-auto sm:top-1/3 w-[min(92vw,22rem)]',
  },
  {
    title: 'Come back tomorrow',
    body: 'The Daily country puzzle waits in your Overview, and “Where to next?” finds the cheap months when you’re dreaming of a trip.',
    placement:
      'left-1/2 -translate-x-1/2 bottom-24 sm:left-auto sm:translate-x-0 sm:right-6 sm:bottom-auto sm:top-16 w-[min(92vw,22rem)]',
  },
];

function MapTour() {
  const [done, setDone] = useState(() => {
    try {
      return localStorage.getItem(TOUR_KEY) === '1';
    } catch {
      return true; // private browsing: an eternal tour is worse than none
    }
  });
  const [stepIndex, setStepIndex] = useState(0);

  const finish = () => {
    setDone(true);
    try {
      localStorage.setItem(TOUR_KEY, '1');
    } catch {
      /* session-only is fine */
    }
  };

  if (done) return null;
  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;

  return (
    // Solid surface, not glass: the previous hints washed out over the map
    // (friend feedback) — a card that teaches must be readable first.
    <div
      role="dialog"
      aria-label={`Tip ${stepIndex + 1} of ${STEPS.length}: ${step.title}`}
      className={`fixed z-40 ${step.placement} bg-surface text-ink border border-line rounded-2xl shadow-xl px-4 py-3`}
    >
      <p className="text-sm font-semibold">{step.title}</p>
      <p className="text-sm text-ink-muted mt-1 leading-relaxed">{step.body}</p>
      <div className="flex items-center gap-2 mt-3">
        <div className="flex gap-1.5" aria-hidden="true">
          {STEPS.map((_, index) => (
            <span
              key={index}
              className={`w-1.5 h-1.5 rounded-full ${
                index === stepIndex ? 'bg-brand-600' : 'bg-line'
              }`}
            />
          ))}
        </div>
        <div className="flex-1" />
        {!isLast && (
          <button
            type="button"
            onClick={finish}
            className="min-h-9 px-2 rounded-lg text-xs font-medium text-ink-muted hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            Skip
          </button>
        )}
        <button
          type="button"
          onClick={() => (isLast ? finish() : setStepIndex(stepIndex + 1))}
          className="min-h-9 px-3 rounded-lg bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          {isLast ? 'Got it' : 'Next'}
        </button>
      </div>
    </div>
  );
}

export default MapTour;
