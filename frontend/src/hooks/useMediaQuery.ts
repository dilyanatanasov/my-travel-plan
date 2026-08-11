import { useEffect, useState } from 'react';

/**
 * Reactive media query.
 *
 * Used where the layout genuinely differs rather than just restyles — the
 * mobile and desktop section views mount different component trees, so
 * choosing between them with CSS would mean mounting both and running two
 * copies of every form's state.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches
  );

  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    setMatches(list.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** Matches the `lg` Tailwind breakpoint, where the rail and dock appear. */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)');
}
