import { describe, it, expect } from 'vitest';
import { planeLightAlphas } from './planeSprite';

describe('planeLightAlphas', () => {
  it('keeps the nav lights visible while they pulse in antiphase', () => {
    for (const t of [0, 150, 300, 450, 700, 1100]) {
      const { port, starboard } = planeLightAlphas(t);
      expect(port).toBeGreaterThanOrEqual(0.45);
      expect(port).toBeLessThanOrEqual(1);
      expect(starboard).toBeGreaterThanOrEqual(0.45);
      expect(starboard).toBeLessThanOrEqual(1);
      // Antiphase: together they always sum to the same brightness.
      expect(port + starboard).toBeCloseTo(1.45, 5);
    }
  });

  it('double-flashes the strobe: flash, flash, dark', () => {
    expect(planeLightAlphas(40).strobe).toBe(1); // first flash
    expect(planeLightAlphas(130).strobe).toBe(0); // gap
    expect(planeLightAlphas(220).strobe).toBe(1); // second flash
    expect(planeLightAlphas(800).strobe).toBe(0); // long dark
    // And the cycle repeats.
    expect(planeLightAlphas(1300 + 40).strobe).toBe(1);
  });
});
