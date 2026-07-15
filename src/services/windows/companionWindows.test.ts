import { describe, expect, it } from 'vitest';

import {
  companionBlockedReason,
  companionLabel,
  companionPetIdFromLabel,
  MAX_DESKTOP_PETS,
} from './companionWindows';

describe('companionBlockedReason', () => {
  it('allows adding a free pet when there is room', () => {
    expect(companionBlockedReason([], 'cachewraith', 'embercat')).toBeNull();
    expect(companionBlockedReason(['a', 'b'], 'cachewraith', 'embercat')).toBeNull();
  });

  it('blocks the active pet', () => {
    expect(companionBlockedReason([], 'cachewraith', 'cachewraith')).toMatch(/main desktop pet/);
  });

  it('blocks a pet that is already a companion', () => {
    expect(companionBlockedReason(['embercat'], 'cachewraith', 'embercat')).toMatch(
      /already on your desktop/
    );
  });

  it('blocks when the desktop is full (main pet + 4 companions)', () => {
    const full = ['a', 'b', 'c', 'd'];
    expect(full.length + 1).toBe(MAX_DESKTOP_PETS);
    expect(companionBlockedReason(full, 'cachewraith', 'embercat')).toMatch(/at most 5 pets/);
  });
});

describe('companion window labels', () => {
  it('round-trips a pet id through the label', () => {
    expect(companionPetIdFromLabel(companionLabel('ember-cat'))).toBe('ember-cat');
  });

  it('returns null for non-companion windows', () => {
    expect(companionPetIdFromLabel('pet')).toBeNull();
    expect(companionPetIdFromLabel('settings')).toBeNull();
  });
});
