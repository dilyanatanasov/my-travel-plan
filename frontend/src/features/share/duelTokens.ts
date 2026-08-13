/**
 * Every token in the pasted input, in order. A duel URL carries TWO tokens —
 * naively taking the first meant pasting an existing duel link handed you
 * your own token back ("you cannot duel yourself"). The caller filters self
 * out and duels whoever remains.
 *
 * Extracted from DuelSection (2026-08-13) so the parsing rules are testable:
 * this exact function shipped the you-cannot-duel-yourself bug once already.
 */
export function extractTokens(input: string): string[] {
  const trimmed = input.trim();
  if (!trimmed) return [];
  const fromUrl = [
    ...trimmed.matchAll(/\/(?:s|duel)\/([A-Za-z0-9_-]{8,24})/g),
  ].flatMap((match) => {
    // A /duel/a/b URL: the second token rides after the captured first.
    const tail = trimmed
      .slice((match.index ?? 0) + match[0].length)
      .match(/^\/([A-Za-z0-9_-]{8,24})/);
    return tail ? [match[1], tail[1]] : [match[1]];
  });
  if (fromUrl.length > 0) return [...new Set(fromUrl)];
  if (/^[A-Za-z0-9_-]{8,24}$/.test(trimmed)) return [trimmed];
  return [];
}
