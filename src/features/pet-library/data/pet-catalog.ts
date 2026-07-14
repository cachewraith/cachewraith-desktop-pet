/**
 * The built-in pet catalog: validated manifests plus MVP unlock hints.
 * Real unlock mechanics (level rewards, achievements, packs) plug into
 * pet-library.service later — the hints here are display-only.
 */
import { loadManifests } from '../services/pet-asset-loader';
import type { PetCharacterManifest } from '../types/pet-library.types';

export interface UnlockRule {
  hint: string;
  requiredLevel: number | null;
}

/** Placeholder unlock requirements for the MVP (display-only). */
export const UNLOCK_RULES: Record<string, UnlockRule> = {
  'null-cat': { hint: 'Reach Level 3', requiredLevel: 3 },
  'glitch-slime': { hint: 'Reach Level 3', requiredLevel: 3 },
  'moss-munch': { hint: 'Reach Level 5', requiredLevel: 5 },
  'orbit-orb': { hint: 'Reach Level 5', requiredLevel: 5 },
  'ember-fox': { hint: 'Complete 20 interactions', requiredLevel: null },
  'frost-fang': { hint: 'Complete 20 interactions', requiredLevel: null },
  'lunar-moth': { hint: 'Coming soon', requiredLevel: null },
  'rune-owl': { hint: 'Coming soon', requiredLevel: null },
};

export function catalogManifests(): PetCharacterManifest[] {
  return [...loadManifests().values()].sort((a, b) => a.number - b.number);
}

export function unlockRuleFor(petId: string): UnlockRule | null {
  return UNLOCK_RULES[petId] ?? null;
}
