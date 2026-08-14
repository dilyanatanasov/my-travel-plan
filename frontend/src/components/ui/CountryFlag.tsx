/**
 * The app's country flag (same rule as Button: shared primitives over
 * repeated markup). Wraps flag-icons' CSS classes — SVG flags served as
 * static assets, identical on every OS, unlike emoji flags which Windows
 * renders as letter pairs. Every flag in the app goes through here; raw
 * `fi fi-xx` classes never appear anywhere else.
 *
 * Decorative by design: the country name is always adjacent text, so the
 * flag is aria-hidden and screen readers hear nothing extra.
 */

interface CountryFlagProps {
  /** Alpha-2 code ("BG"). Null/undefined renders nothing — a missing flag
      should be invisible, not a broken placeholder square. */
  iso2?: string | null;
  className?: string;
}

function CountryFlag({ iso2, className = '' }: CountryFlagProps) {
  if (!iso2) return null;
  return (
    <span
      aria-hidden="true"
      className={[
        // fi sets the 4:3 aspect and background sizing; w-5 keeps it around
        // 1em tall next to body text.
        `fi fi-${iso2.toLowerCase()}`,
        'inline-block w-5 flex-shrink-0 rounded-[2px]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    />
  );
}

export default CountryFlag;
