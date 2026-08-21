import { describe, expect, it } from 'vitest';
import { matchTier } from './MapSearch';

/**
 * The map search ranks rows by how well they answer the query rather
 * than by type (friend feedback, 2026-08-21). These pin the scoring the
 * ordering rests on - the interleaving itself is only a stable sort.
 */
describe('matchTier', () => {
  it('rates an exact name best', () => {
    expect(matchTier('bath', 'Bath')).toBe(0);
  });

  it('rates a prefix above a word inside the name', () => {
    expect(matchTier('bath', 'Bathinda')).toBeLessThan(
      matchTier('bath', 'Roman Bath Museum'),
    );
  });

  it('rates a word inside the name above a bare substring', () => {
    expect(matchTier('bath', 'Roman Bath Museum')).toBeLessThan(
      matchTier('bath', 'Ambatholampy'),
    );
  });

  it('ignores case', () => {
    expect(matchTier('NICE', 'nice')).toBe(0);
  });

  it('folds diacritics, so an ascii query matches the native spelling', () => {
    // The city table ships "Keramotí"; nobody types the accent.
    expect(matchTier('keramoti', 'Keramotí')).toBe(0);
    expect(matchTier('stavros', 'Stavrós')).toBe(0);
    expect(matchTier('lefkada', 'Lefkáda')).toBe(0);
  });

  it('takes the best of several names', () => {
    // An airport is judged on its code, its city, or its full name -
    // whichever answers the query best.
    expect(matchTier('lhr', 'LHR', 'London', 'Heathrow Airport')).toBe(0);
    expect(matchTier('london', 'LHR', 'London', 'Heathrow Airport')).toBe(0);
    // "Heathrow Airport" starts with the term but is not equal to it.
    expect(matchTier('heathrow', 'LHR', 'London', 'Heathrow Airport')).toBe(1);
  });

  it('skips missing names rather than counting them as misses', () => {
    expect(matchTier('sofia', null, undefined, 'Sofia')).toBe(0);
  });

  it('returns a non-finite score when the term appears nowhere', () => {
    expect(Number.isFinite(matchTier('varna', 'Plovdiv', 'PDV'))).toBe(false);
  });

  it('treats regex characters in the query as literal text', () => {
    // "n. mariana is." reaches this via the country path; a stray "." must
    // not compile into a wildcard that matches anything.
    expect(Number.isFinite(matchTier('a.b', 'axb'))).toBe(false);
    expect(matchTier('st.', 'St. Louis')).toBe(1);
  });
});
