import type { ReactNode } from 'react';

export type SectionId = 'overview' | 'countries' | 'flights' | 'stats' | 'share';

export interface SectionDef {
  id: SectionId;
  label: string;
  icon: ReactNode;
  /**
   * Statistics is a dashboard and Share is a 4:5 preview card — neither fits
   * a 400px rail, so they replace the map instead of docking beside it.
   */
  fullView?: boolean;
}

const iconProps = {
  // 20px, not 24: five tabs across a 390px phone leaves ~74px each, and the
  // larger glyph pushed the label into the safe-area inset.
  className: 'w-5 h-5',
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  'aria-hidden': true,
} as const;

export const SECTIONS: SectionDef[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: (
      <svg {...iconProps}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
  {
    id: 'countries',
    label: 'Countries',
    icon: (
      <svg {...iconProps}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    ),
  },
  {
    id: 'flights',
    label: 'Flights',
    icon: (
      <svg {...iconProps}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
        />
      </svg>
    ),
  },
  {
    id: 'stats',
    label: 'Statistics',
    fullView: true,
    icon: (
      <svg {...iconProps}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      </svg>
    ),
  },
  {
    id: 'share',
    label: 'Share',
    // The preview is a portrait card; a 400px dock would show it postage-stamp
    // sized, which defeats the point of previewing it at all.
    fullView: true,
    // Lucide share-2: the three-node glyph the handoff specifies. It carries
    // more strokes than an upload arrow, so the weight is nudged up to hold
    // together at 20px.
    icon: (
      <svg {...iconProps} strokeWidth={2}>
        <circle cx="18" cy="5" r="2.6" />
        <circle cx="6" cy="12" r="2.6" />
        <circle cx="18" cy="19" r="2.6" />
        <path strokeLinecap="round" d="M8.4 13.3l7.2 4.2M15.6 6.5L8.4 10.7" />
      </svg>
    ),
  },
];

export function getSection(id: SectionId): SectionDef {
  return SECTIONS.find((section) => section.id === id) ?? SECTIONS[0];
}
