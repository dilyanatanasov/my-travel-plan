import { SECTIONS, type SectionId } from './sections';

interface SectionRailProps {
  activeSection: SectionId | null;
  onSelect: (id: SectionId) => void;
}

/**
 * Desktop icon rail. Selecting the active section again closes the panel, so
 * the map can be seen full width without hunting for a separate close control.
 */
function SectionRail({ activeSection, onSelect }: SectionRailProps) {
  return (
    <nav
      aria-label="Sections"
      /*
        relative z-40 puts the rail on the app-chrome layer, with the header
        and the mobile tab bar. Without it the rail is a static flex child, so
        its hover labels resolve at root level against the map's own overlays —
        the search dropdown and the filter card are also z-30 and come later in
        the DOM, so they painted over the labels.
      */
      className="hidden lg:flex relative z-40 flex-col items-center gap-1 w-16 flex-shrink-0 border-r border-line bg-surface py-3"
    >
      {SECTIONS.map((section) => {
        const isActive = activeSection === section.id;
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => onSelect(section.id)}
            aria-current={isActive ? 'page' : undefined}
            /* No title attribute: the native tooltip would arrive a second
               after the hover label below and say the same thing twice. */
            className={`group relative w-12 h-12 rounded-xl flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 ${
              isActive
                ? 'bg-brand-50 text-brand-700'
                : 'text-ink-subtle hover:bg-surface-sunken hover:text-ink-muted'
            }`}
          >
            {section.icon}
            <span className="sr-only">{section.label}</span>
            {/*
              Hover label, since an icon-only rail is otherwise a guessing
              game. aria-hidden because the sr-only span above already names
              the button — without it the accessible name is the two
              concatenated, and every tab stop announced "Overview Overview".
            */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-full ml-2 px-2 py-1 rounded bg-slate-900 text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-30"
            >
              {section.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

export default SectionRail;
