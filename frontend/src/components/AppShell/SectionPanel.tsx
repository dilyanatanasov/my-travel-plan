import { useEffect, type ReactNode } from 'react';

interface SectionPanelProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  /**
   * Only 'dock' exists now. Phones show sections as a full screen instead —
   * the half-height sheet this component also used to render left forms
   * cramped, and the map it was preserving was mostly covered by the map
   * controls anyway.
   */
  variant: 'dock';
}

/** Section content docked beside the map on large screens. */
function SectionPanel({ title, isOpen, onClose, children }: SectionPanelProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <aside
      aria-label={title}
      className="flex flex-col w-[26rem] xl:w-[30rem] flex-shrink-0 border-l border-line bg-surface"
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

export default SectionPanel;
