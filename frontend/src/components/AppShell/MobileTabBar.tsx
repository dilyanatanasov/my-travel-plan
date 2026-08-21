import { SECTIONS, type SectionId } from './sections';

interface MobileTabBarProps {
  activeSection: SectionId | null;
  onSelect: (id: SectionId) => void;
}

/**
 * Bottom tab bar. Tapping the active tab closes its sheet, so the map can be
 * seen unobstructed without a separate gesture.
 *
 * The active state is a rounded pill inset from the tab's edges, not a
 * full-bleed background or an inset focus ring. Edge-to-edge highlights get
 * clipped by the rounded corners and the home indicator on modern phones, so
 * the bottom two tabs looked cut off while the middle ones did not.
 */
function MobileTabBar({ activeSection, onSelect }: MobileTabBarProps) {
  return (
    <nav
      aria-label="Sections"
      className="lg:hidden flex-shrink-0 border-t border-line bg-surface z-40"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/*
        Five equal columns. grid-cols-5 rather than flex, so every tab is the
        same width regardless of label length — "Statistics" is twice the
        length of "Share" and would otherwise take twice the room.
      */}
      {/* Play is deliberately absent (owner call, 2026-08-21): a sixth
          column would squeeze five already-tight tabs, so on phones the
          games live in the header instead. */}
      <div className="grid grid-cols-5 px-0.5 py-1">
        {SECTIONS.filter((section) => section.id !== 'play').map((section) => {
          const isActive = activeSection === section.id;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onSelect(section.id)}
              aria-current={isActive ? 'page' : undefined}
              className="group flex items-center justify-center min-h-14 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <span
                className={`flex flex-col items-center justify-center gap-0.5 w-full mx-0.5 px-0.5 py-1.5 rounded-xl transition-colors ${
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-ink-subtle group-hover:text-ink-muted'
                }`}
              >
                {section.icon}
                {/* Truncate rather than wrap: a second line would make this
                    tab taller than its neighbours and break the row. */}
                <span className="text-[10px] font-medium leading-none w-full text-center truncate">
                  {section.label}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default MobileTabBar;
