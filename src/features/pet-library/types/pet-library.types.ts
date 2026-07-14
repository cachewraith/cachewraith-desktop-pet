/**
 * Types for the Pet Library: character manifests, catalog entries and
 * ownership state.
 */

export type PetRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export type PetCategory =
  'ghost' | 'animal' | 'robot' | 'slime' | 'fantasy' | 'elemental' | 'space' | 'nature';

export type PetAnimationName =
  'idle' | 'walk' | 'sleep' | 'happy' | 'sad' | 'hungry' | 'eat' | 'talk' | 'celebrate';

export const PET_ANIMATION_NAMES: readonly PetAnimationName[] = [
  'idle',
  'walk',
  'sleep',
  'happy',
  'sad',
  'hungry',
  'eat',
  'talk',
  'celebrate',
];

export const PET_CATEGORIES: readonly PetCategory[] = [
  'ghost',
  'animal',
  'robot',
  'slime',
  'fantasy',
  'elemental',
  'space',
  'nature',
];

export const PET_RARITIES: readonly PetRarity[] = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
];

export interface PetAnimationDefinition {
  name: PetAnimationName;
  asset: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  frameRate: number;
  loop: boolean;
  scale?: number;
  anchorX?: number;
  anchorY?: number;
}

export type ParticleKind = 'spark' | 'star' | 'leaf' | 'snow' | 'pixel';

export interface PetVisualEffects {
  glowColor?: string;
  shadowColor?: string;
  celebrationParticle?: ParticleKind;
  particleColors?: string[];
  idleFloatAmount?: number;
  idleFloatSpeed?: number;
  ambientParticle?: ParticleKind;
  glitch?: boolean;
}

export interface PetDialogue {
  greeting: string[];
  clicked: string[];
  hungry: string[];
  fed: string[];
  happy: string[];
  sleeping: string[];
  celebrating: string[];
}

export interface PetCharacterManifest {
  id: string;
  number: number;
  name: string;
  slug: string;
  description: string;
  lore: string;
  personality: string;
  category: PetCategory;
  rarity: PetRarity;
  tags: string[];
  featured: boolean;
  new: boolean;
  free: boolean;
  defaultUnlocked: boolean;
  thumbnail: string;
  animations: Partial<Record<PetAnimationName, PetAnimationDefinition>>;
  effects?: PetVisualEffects;
  dialogue?: PetDialogue;
}

/** Per-user ownership/usage state stored in SQLite. */
export interface PetCharacterState {
  id: string;
  unlocked: boolean;
  favorite: boolean;
  firstSelectedAt: string | null;
  lastSelectedAt: string | null;
  selectionCount: number;
}

/** Manifest + user state + unlock hint, as consumed by the UI. */
export interface LibraryPet {
  manifest: PetCharacterManifest;
  state: PetCharacterState;
  unlockHint: string | null;
  /** Minimum level shown on the card for level-gated pets. */
  requiredLevel: number | null;
}

export interface ActivePetChangedPayload {
  petId: string;
}

export const DEFAULT_PET_ID = 'cachewraith';
