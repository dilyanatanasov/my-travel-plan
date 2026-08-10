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
          land: token('map-land'),
          ocean: token('map-ocean'),
          route: token('map-route'),
        },
        danger: {
          DEFAULT: token('danger'),
          soft: token('danger-soft'),
        },
      },
    },
  },
  plugins: [],
};
