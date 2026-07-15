import { describe, expect, it } from 'vitest';

import { matchesSearch } from './pet-filters';
import type { LibraryPet, PetCharacterManifest } from '../types/pet-library.types';

function petWith(overrides: Partial<PetCharacterManifest>): LibraryPet {
  const manifest: PetCharacterManifest = {
    id: 'ember-fox',
    number: 3,
    name: 'EmberFox',
    slug: 'ember-fox',
    description: 'A warm little fox spirit that naps on CPUs.',
    lore: '',
    personality: 'cozy and loyal',
    category: 'elemental',
    rarity: 'rare',
    tags: ['fire', 'fox'],
    featured: false,
    new: false,
    free: true,
    defaultUnlocked: false,
    thumbnail: 'thumbnail.png',
    animations: {},
    ...overrides,
  };
  return {
    manifest,
    state: {
      id: manifest.id,
      unlocked: true,
      favorite: false,
      firstSelectedAt: null,
      lastSelectedAt: null,
      selectionCount: 0,
    },
    unlockHint: null,
    requiredLevel: null,
  };
}

describe('matchesSearch', () => {
  it('matches everything for an empty or whitespace query', () => {
    expect(matchesSearch(petWith({}), '')).toBe(true);
    expect(matchesSearch(petWith({}), '   ')).toBe(true);
  });

  it('matches by name case-insensitively', () => {
    expect(matchesSearch(petWith({}), 'emberFOX')).toBe(true);
  });

  it('matches multi-word queries across different fields', () => {
    // "rare" is the rarity, "fox" is a tag — no single field has both.
    expect(matchesSearch(petWith({}), 'rare fox')).toBe(true);
  });

  it('matches on personality', () => {
    expect(matchesSearch(petWith({}), 'loyal')).toBe(true);
  });

  it('rejects when any term is missing', () => {
    expect(matchesSearch(petWith({}), 'rare dragon')).toBe(false);
  });

  it('rejects a plain miss', () => {
    expect(matchesSearch(petWith({}), 'octopus')).toBe(false);
  });
});
