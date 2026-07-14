/**
 * Foundation for importable pet packs (experimental — not yet wired to a
 * file picker). A pack is a folder:
 *
 *   my-pet-pack/
 *   ├── manifest.json
 *   ├── thumbnail.png
 *   └── sprites/{idle,walk,sleep,happy,sad,hungry,eat,talk,celebrate}.png
 *
 * Packs are pure data: PNG sheets + a JSON manifest. They must never be
 * able to execute JavaScript, HTML, Rust or shell commands, so validation
 * only accepts PNG assets on safe relative paths.
 */
import { validatePetManifest, isSafeAssetPath } from './manifest-validation';
import type { PetCharacterManifest } from '../types/pet-library.types';

export const MAX_PACK_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB per sheet

export interface PetPackFile {
  /** Path relative to the pack root, e.g. "sprites/idle.png". */
  path: string;
  bytes: number;
}

export type PackValidationResult =
  { ok: true; manifest: PetCharacterManifest } | { ok: false; errors: string[] };

/**
 * Validate a pack's manifest plus its file listing. Pure so it is fully
 * testable; actual file reading will be added with the import UI.
 */
export function validatePetPack(rawManifest: unknown, files: PetPackFile[]): PackValidationResult {
  const errors: string[] = [];

  const manifestResult = validatePetManifest(rawManifest);
  if (!manifestResult.ok) {
    return { ok: false, errors: [manifestResult.error] };
  }
  const manifest = manifestResult.manifest;

  const filesByPath = new Map(files.map((f) => [f.path.replace(/\\/g, '/'), f]));
  for (const file of files) {
    if (!isSafeAssetPath(file.path) && file.path !== 'manifest.json') {
      errors.push(`unsafe or unsupported file in pack: "${file.path}"`);
    }
    if (file.bytes > MAX_PACK_IMAGE_BYTES) {
      errors.push(`"${file.path}" exceeds the ${MAX_PACK_IMAGE_BYTES / 1024 / 1024} MB limit`);
    }
  }

  if (!filesByPath.has(manifest.thumbnail)) {
    errors.push(`thumbnail "${manifest.thumbnail}" is missing from the pack`);
  }
  for (const animation of Object.values(manifest.animations)) {
    if (!filesByPath.has(animation.asset)) {
      errors.push(`sprite sheet "${animation.asset}" is missing from the pack`);
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, manifest };
}

/**
 * Future import entry point. Kept as a typed stub so the UI can show the
 * experimental button today and a real implementation can slot in without
 * schema changes.
 */
export async function importPetPack(): Promise<never> {
  throw new Error(
    'Importing pet packs is not available yet. The format is documented in the README.'
  );
}
