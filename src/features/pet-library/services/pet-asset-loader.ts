/**
 * Loads built-in pet manifests and sprite URLs bundled under
 * src/assets/pets/<slug>/. Manifests are validated before use; a broken
 * pet folder is skipped instead of crashing the app.
 */
import { logger } from '../../../utils/logger';
import { validatePetManifest } from './manifest-validation';
import type { PetCharacterManifest } from '../types/pet-library.types';

const manifestModules = import.meta.glob('/src/assets/pets/*/manifest.json', {
  eager: true,
}) as Record<string, { default: unknown }>;

const spriteUrlModules = import.meta.glob('/src/assets/pets/*/sprites/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const thumbnailUrlModules = import.meta.glob('/src/assets/pets/*/thumbnail.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

let manifestCache: Map<string, PetCharacterManifest> | null = null;

function slugFromPath(path: string): string {
  const match = path.match(/\/pets\/([^/]+)\//);
  return match ? match[1] : '';
}

/** All valid built-in manifests, keyed by pet id. Cached after first call. */
export function loadManifests(): Map<string, PetCharacterManifest> {
  if (manifestCache) return manifestCache;
  const map = new Map<string, PetCharacterManifest>();
  for (const [path, module] of Object.entries(manifestModules)) {
    const result = validatePetManifest(module.default);
    if (!result.ok) {
      logger.warn('pet-library', `skipping invalid pet manifest at ${path}: ${result.error}`);
      continue;
    }
    if (result.manifest.slug !== slugFromPath(path)) {
      logger.warn('pet-library', `manifest slug mismatch at ${path}, skipping`);
      continue;
    }
    map.set(result.manifest.id, result.manifest);
  }
  manifestCache = map;
  return map;
}

export function getManifest(petId: string): PetCharacterManifest | null {
  return loadManifests().get(petId) ?? null;
}

/** Bundled URL for an animation sprite sheet (e.g. asset "sprites/idle.png"). */
export function getSpriteUrl(slug: string, asset: string): string | null {
  return spriteUrlModules[`/src/assets/pets/${slug}/${asset}`] ?? null;
}

export function getThumbnailUrl(slug: string): string | null {
  return thumbnailUrlModules[`/src/assets/pets/${slug}/thumbnail.png`] ?? null;
}
