import { describe, expect, it } from 'vitest';

import {
  applyDelta,
  decayTick,
  experienceForLevel,
  levelForExperience,
  moodForStats,
  normalizeStats,
  type PetStats,
} from './pet.stats';

const base: PetStats = { happiness: 50, energy: 50, hunger: 50, experience: 0, level: 1 };

describe('levelForExperience', () => {
  it('starts at level 1 with 0 xp', () => {
    expect(levelForExperience(0)).toBe(1);
  });

  it('reaches level 2 at 25 xp and level 3 at 100 xp', () => {
    expect(levelForExperience(24)).toBe(1);
    expect(levelForExperience(25)).toBe(2);
    expect(levelForExperience(100)).toBe(3);
  });

  it('never goes below level 1 for negative xp', () => {
    expect(levelForExperience(-50)).toBe(1);
  });

  it('is the inverse of experienceForLevel', () => {
    for (const level of [1, 2, 3, 5, 10]) {
      expect(levelForExperience(experienceForLevel(level))).toBe(level);
    }
  });
});

describe('normalizeStats', () => {
  it('clamps stats into 0..100', () => {
    const result = normalizeStats({
      happiness: 150,
      energy: -20,
      hunger: 100.7,
      experience: 30,
      level: 99,
    });
    expect(result.happiness).toBe(100);
    expect(result.energy).toBe(0);
    expect(result.hunger).toBe(100);
    expect(result.level).toBe(2); // derived from xp, not trusted from input
  });

  it('treats NaN experience as 0', () => {
    const result = normalizeStats({ ...base, experience: Number.NaN });
    expect(result.experience).toBe(0);
    expect(result.level).toBe(1);
  });
});

describe('applyDelta', () => {
  it('applies partial deltas and clamps', () => {
    const result = applyDelta(base, { happiness: 100, hunger: -100, experience: 5 });
    expect(result.happiness).toBe(100);
    expect(result.hunger).toBe(0);
    expect(result.experience).toBe(5);
    expect(result.energy).toBe(50);
  });
});

describe('decayTick', () => {
  it('drains energy and raises hunger while awake', () => {
    const result = decayTick(base, 'idle');
    expect(result.hunger).toBeGreaterThan(base.hunger);
    expect(result.energy).toBeLessThan(base.energy);
  });

  it('restores energy while sleeping', () => {
    const result = decayTick(base, 'sleeping');
    expect(result.energy).toBeGreaterThan(base.energy);
  });
});

describe('moodForStats', () => {
  it('prioritizes hunger', () => {
    expect(moodForStats({ ...base, hunger: 90, happiness: 90 })).toBe('hungry');
  });
  it('reports happy and sad', () => {
    expect(moodForStats({ ...base, happiness: 80 })).toBe('happy');
    expect(moodForStats({ ...base, happiness: 10 })).toBe('sad');
  });
});
