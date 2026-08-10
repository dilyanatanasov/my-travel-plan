import { SECTIONS, type SectionId } from './sections';

interface MobileTabBarProps {
  activeSection: SectionId | null;
  onSelect: (id: SectionId) => void;
}

/**
 * Bottom tab bar. Tapping the active tab closes its sheet, so the map can be
 * seen unobstructed without a separate gesture.
 *
 * pb-safe keeps the targets clear of the iOS home indicator.
 */
function MobileTabBar({ activeSection, onSelect }: MobileTabBarProps) {
  return (
    <nav
      aria-label="Sections"
      className="lg:hidden flex-shrink-0 border-t border-line bg-surface z-40"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="grid grid-cols-4">
        {SECTIONS.map((section) => {
          const isActive = activeSection === section.id;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onSelect(section.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 min-h-14 px-1 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-500 ${
                isActive ? 'text-brand-700' : 'text-ink-subtle'
              }`}
            >
              {section.icon}
              <span className="text-[11px] font-medium leading-none">
                {section.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default MobileTabBar;
