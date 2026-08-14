/**
 * Greedy word-wrap into at most `maxLines`, ellipsizing the last. SVG text
 * has no wrapping of its own; ~24 chars fits the postcard band at the
 * caption size.
 */
export function wrapCaption(
  text: string,
  maxChars = 24,
  maxLines = 2,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  let ranOut = false;
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= maxChars || !line) {
      line = candidate;
      continue;
    }
    if (lines.length === maxLines - 1) {
      ranOut = true;
      break;
    }
    lines.push(line);
    line = word;
  }
  if (line) lines.push(line);
  const last = lines[lines.length - 1] ?? '';
  if (lines.length > 0 && (ranOut || last.length > maxChars)) {
    lines[lines.length - 1] = `${last.slice(0, maxChars - 1)}…`;
  }
  return lines;
}
