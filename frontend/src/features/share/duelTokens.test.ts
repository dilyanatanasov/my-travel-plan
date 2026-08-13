import { describe, it, expect } from 'vitest';
import { extractTokens } from './duelTokens';

/**
 * The parser behind "paste their link to start a duel". Its one shipped bug:
 * a pasted duel URL carries two tokens, and taking only the first handed the
 * user their own token back ("you cannot duel yourself"). These cases pin
 * every input shape the UI invites.
 */

const A = 'McDsAredLrAaw6jN'; // 16-char share tokens, base64url alphabet
const B = 'AFoP6hvok0Cmjutp';

describe('extractTokens', () => {
  it('accepts a bare token, trimmed', () => {
    expect(extractTokens(`  ${A} `)).toEqual([A]);
  });

  it('accepts a share link', () => {
    expect(extractTokens(`https://mycontrail.com/s/${A}`)).toEqual([A]);
  });

  it('returns BOTH tokens of a pasted duel link, in order', () => {
    expect(extractTokens(`https://mycontrail.com/duel/${A}/${B}`)).toEqual([
      A,
      B,
    ]);
  });

  it('accepts a single-token challenge link', () => {
    expect(extractTokens(`https://mycontrail.com/duel/${A}`)).toEqual([A]);
  });

  it('dedupes a self-vs-self duel link to one token', () => {
    expect(extractTokens(`/duel/${A}/${A}`)).toEqual([A]);
  });

  it('works without an origin and on relative paths', () => {
    expect(extractTokens(`/s/${A}`)).toEqual([A]);
    expect(extractTokens(`localhost:5173/duel/${A}/${B}`)).toEqual([A, B]);
  });

  it('rejects empty, junk, and wrong-shaped tokens', () => {
    expect(extractTokens('')).toEqual([]);
    expect(extractTokens('   ')).toEqual([]);
    expect(extractTokens('not a token!')).toEqual([]);
    expect(extractTokens('short')).toEqual([]); // under 8 chars
    expect(extractTokens('x'.repeat(25))).toEqual([]); // over 24 chars
    expect(extractTokens('/duel/short')).toEqual([]);
  });

  it('ignores other paths that merely contain a plausible string', () => {
    expect(extractTokens('https://mycontrail.com/settings')).toEqual([]);
  });
});
