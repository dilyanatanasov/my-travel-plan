import { describe, it, expect } from 'vitest';
import { wrapCaption } from './postcardCaption';

describe('wrapCaption', () => {
  it('leaves short captions on one line', () => {
    expect(wrapCaption('Sofia · May 2023')).toEqual(['Sofia · May 2023']);
  });

  it('wraps on word boundaries into two lines', () => {
    expect(wrapCaption('Honeymoon day three in Barcelona')).toEqual([
      'Honeymoon day three in',
      'Barcelona',
    ]);
  });

  it('ellipsizes when the text outruns both lines', () => {
    const lines = wrapCaption(
      'A very long story about the time we nearly missed this flight entirely',
    );
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith('…')).toBe(true);
    expect(lines[1].length).toBeLessThanOrEqual(24);
  });

  it('ellipsizes a single unbreakable overlong word', () => {
    const lines = wrapCaption('Llanfairpwllgwyngyllgogerychwyrndrobwll');
    expect(lines).toHaveLength(1);
    expect(lines[0].endsWith('…')).toBe(true);
    expect(lines[0].length).toBeLessThanOrEqual(24);
  });

  it('survives empty input', () => {
    expect(wrapCaption('')).toEqual([]);
  });
});
