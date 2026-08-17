/** @type {import('tailwindcss').Config} */

// Consume a token as rgb() so opacity utilities (bg-brand-600/50) keep working.
const token = (name) => `rgb(var(--color-${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  // Groundwork only — no toggle ships yet. See src/styles/tokens.css.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: token('brand-50'),
          100: token('brand-100'),
          200: token('brand-200'),
          300: token('brand-300'),
          400: token('brand-400'),
          500: token('brand-500'),
          600: token('brand-600'),
          700: token('brand-700'),
          800: token('brand-800'),
          900: token('brand-900'),
        },
        canvas: token('canvas'),
        // Accent text; distinct from brand-600, which is a fill. See tokens.css.
        'brand-text': token('brand-text'),
        // Filled panel that always carries white text; see tokens.css.
        'panel-accent': token('panel-accent'),
        surface: {
          DEFAULT: token('surface'),
          sunken: token('surface-sunken'),
        },
        line: {
          DEFAULT: token('border'),
          strong: token('border-strong'),
        },
        ink: {
          DEFAULT: token('ink'),
          muted: token('ink-muted'),
          subtle: token('ink-subtle'),
        },
        // Map semantics — also exported from src/theme/mapColors.ts for the
        // parts of the map that need JS colour strings.
        map: {
          home: token('map-home'),
          visited: token('map-visited'),
          transit: token('map-transit'),
          wishlist: token('map-wishlist'),
          lived: token('map-lived'),
          land: token('map-land'),
          ocean: token('map-ocean'),
          route: token('map-route'),
        },
        danger: {
          DEFAULT: token('danger'),
          soft: token('danger-soft'),
        },
      },

      /*
        Type. Figtree carries the interface; Caprasimo is display only —
        it has one weight, no italic and very tight counters, so it is
        unreadable below about 18px and must never become the body face.
      */
      fontFamily: {
        sans: ['Figtree', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Caprasimo', 'Georgia', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },

      /*
        Shape. Tailwind's defaults are noticeably squarer than the rest of
        this app now reads; redefining the scale here rounds every existing
        rounded-lg / rounded-2xl at once, with no component edits and no risk
        of missing one.
      */
      borderRadius: {
        lg: '0.75rem',
        xl: '1.125rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },

      // Depth comes from the theme-aware strings in tokens.css.
      boxShadow: {
        sm: 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow-md)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
    },
  },
  plugins: [],
};
