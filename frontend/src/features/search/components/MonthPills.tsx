import { nextTwelveMonths } from '../months';

interface MonthPillsProps {
  selected: string;
  onSelect: (month: string) => void;
}

/**
 * The month is the only question discovery asks, so it gets the top of the
 * panel and pill ergonomics rather than a date field: nobody knows the
 * dates yet — that is why they are here.
 */
function MonthPills({ selected, onSelect }: MonthPillsProps) {
  const months = nextTwelveMonths();

  return (
    <div
      role="radiogroup"
      aria-label="Travel month"
      // Scrolls horizontally rather than wrapping: two rows of pills read as
      // a wall of buttons, and the far months matter less than the near ones.
      className="flex gap-1.5 overflow-x-auto pb-1 -mb-1 snap-x"
    >
      {months.map((month) => {
        const isActive = month.value === selected;
        return (
          <button
            key={month.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onSelect(month.value)}
            className={`flex-shrink-0 snap-start min-h-9 px-3 rounded-full text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
              isActive
                ? 'bg-brand-600 text-white'
                : 'bg-surface-sunken text-ink-muted hover:text-ink'
            }`}
          >
            {month.label}
          </button>
        );
      })}
    </div>
  );
}

export default MonthPills;
