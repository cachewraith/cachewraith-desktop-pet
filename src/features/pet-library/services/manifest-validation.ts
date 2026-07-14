/**
 * Strict validation for pet manifests. A malformed manifest is rejected
 * (and logged) instead of crashing the app — the catalog simply skips it.
 */
import {
  PET_ANIMATION_NAMES,
  PET_CATEGORIES,
  PET_RARITIES,
  type PetAnimationDefinition,
  type PetAnimationName,
  type PetCharacterManifest,
} from '../types/pet-library.types';

export type ManifestResult =
  { ok: true; manifest: PetCharacterManifest } | { ok: false; error: string };

const MAX_FRAME_COUNT = 64;
const MAX_FRAME_SIZE = 256;
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
/** Relative path inside the pet folder: no traversal, no absolute paths. */
const SAFE_ASSET_PATTERN = /^[a-z0-9_\-/]+\.(png)$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

export function isSafeAssetPath(path: unknown): path is string {
  return (
    typeof path === 'string' &&
    SAFE_ASSET_PATTERN.test(path) &&
    !path.includes('..') &&
    !path.startsWith('/') &&
    !path.includes('\\') &&
    !path.includes(':')
  );
}

function validateAnimation(name: string, value: unknown): string | PetAnimationDefinition {
  if (!isRecord(value)) return `animation "${name}" is not an object`;
  if (value.name !== name) return `animation "${name}" has mismatched name`;
  if (!isSafeAssetPath(value.asset)) return `animation "${name}" has an unsafe asset path`;
  for (const field of ['frameWidth', 'frameHeight', 'frameCount', 'frameRate'] as const) {
    const n = value[field];
    if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) {
      return `animation "${name}" field "${field}" must be a positive number`;
    }
  }
  if ((value.frameCount as number) > MAX_FRAME_COUNT) {
    return `animation "${name}" exceeds the maximum of ${MAX_FRAME_COUNT} frames`;
  }
  if (
    (value.frameWidth as number) > MAX_FRAME_SIZE ||
    (value.frameHeight as number) > MAX_FRAME_SIZE
  ) {
    return `animation "${name}" frame size exceeds ${MAX_FRAME_SIZE}px`;
  }
  if (typeof value.loop !== 'boolean') return `animation "${name}" is missing "loop"`;
  return value as unknown as PetAnimationDefinition;
}

export function validatePetManifest(raw: unknown): ManifestResult {
  if (!isRecord(raw)) return { ok: false, error: 'manifest is not an object' };

  if (!isNonEmptyString(raw.id) || !ID_PATTERN.test(raw.id)) {
    return { ok: false, error: 'invalid or missing id' };
  }
  for (const field of ['name', 'slug', 'description', 'lore', 'personality'] as const) {
    if (!isNonEmptyString(raw[field])) {
      return { ok: false, error: `missing text field "${field}" (${raw.id})` };
    }
  }
  if (typeof raw.number !== 'number' || raw.number < 1) {
    return { ok: false, error: `invalid number (${raw.id})` };
  }
  if (!PET_CATEGORIES.includes(raw.category as never)) {
    return { ok: false, error: `unknown category "${String(raw.category)}" (${raw.id})` };
  }
  if (!PET_RARITIES.includes(raw.rarity as never)) {
    return { ok: false, error: `unknown rarity "${String(raw.rarity)}" (${raw.id})` };
  }
  if (!isStringArray(raw.tags)) return { ok: false, error: `invalid tags (${raw.id})` };
  for (const flag of ['featured', 'new', 'free', 'defaultUnlocked'] as const) {
    if (typeof raw[flag] !== 'boolean') {
      return { ok: false, error: `missing boolean "${flag}" (${raw.id})` };
    }
  }
  if (!isSafeAssetPath(raw.thumbnail)) {
    return { ok: false, error: `unsafe thumbnail path (${raw.id})` };
  }
  if (!isRecord(raw.animations)) {
    return { ok: false, error: `missing animations (${raw.id})` };
  }

  const animations: Partial<Record<PetAnimationName, PetAnimationDefinition>> = {};
  for (const [name, def] of Object.entries(raw.animations)) {
    if (!PET_ANIMATION_NAMES.includes(name as PetAnimationName)) {
      return { ok: false, error: `unsupported animation "${name}" (${raw.id})` };
    }
    const result = validateAnimation(name, def);
    if (typeof result === 'string') return { ok: false, error: `${result} (${raw.id})` };
    animations[name as PetAnimationName] = result;
  }
  if (!animations.idle) {
    return { ok: false, error: `an "idle" animation is required (${raw.id})` };
  }

  return { ok: true, manifest: { ...(raw as unknown as PetCharacterManifest), animations } };
}
