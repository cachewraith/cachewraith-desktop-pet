/**
 * Pure animation-resolution logic with the documented fallback chain:
 *   requested animation → pet idle → CacheWraith idle → null (caller draws
 *   the safe generated fallback graphic).
 */
import type {
  PetAnimationDefinition,
  PetAnimationName,
  PetCharacterManifest,
} from '../types/pet-library.types';
import type { PetStateName } from '../../pet/pet.types';

export const STATE_TO_ANIMATION: Record<PetStateName, PetAnimationName | null> = {
  initializing: 'idle',
  idle: 'idle',
  walking: 'walk',
  sleeping: 'sleep',
  happy: 'happy',
  sad: 'sad',
  hungry: 'hungry',
  eating: 'eat',
  talking: 'talk',
  celebrating: 'celebrate',
  dragging: 'idle',
  hidden: null, // rendering pauses entirely
};

export function animationForState(state: PetStateName): PetAnimationName | null {
  return STATE_TO_ANIMATION[state];
}

export interface ResolvedAnimation {
  definition: PetAnimationDefinition;
  /** Slug of the manifest that actually provides the sheet. */
  slug: string;
}

export function resolveAnimation(
  manifest: PetCharacterManifest | null,
  name: PetAnimationName,
  fallbackManifest: PetCharacterManifest | null
): ResolvedAnimation | null {
  if (manifest?.animations[name]) {
    return { definition: manifest.animations[name], slug: manifest.slug };
  }
  if (manifest?.animations.idle) {
    return { definition: manifest.animations.idle, slug: manifest.slug };
  }
  if (fallbackManifest?.animations[name]) {
    return { definition: fallbackManifest.animations[name], slug: fallbackManifest.slug };
  }
  if (fallbackManifest?.animations.idle) {
    return { definition: fallbackManifest.animations.idle, slug: fallbackManifest.slug };
  }
  return null;
}
