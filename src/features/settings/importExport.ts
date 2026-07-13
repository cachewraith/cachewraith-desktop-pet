/**
 * Pet-data export/import with strict validation. Pure JSON logic here;
 * the Settings UI handles clipboard/textarea transport so no filesystem
 * permissions are needed.
 */
import { clampStat } from '../../utils/clamp';
import { levelForExperience } from '../pet/pet.stats';

export const EXPORT_FORMAT = 'cachewraith-export';
export const EXPORT_VERSION = 1;

export interface PetExportData {
  format: typeof EXPORT_FORMAT;
  version: number;
  exportedAt: string;
  pet: {
    name: string;
    happiness: number;
    energy: number;
    hunger: number;
    experience: number;
  };
}

export function buildExport(pet: PetExportData['pet']): PetExportData {
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    pet: {
      name: pet.name.trim().slice(0, 40) || 'CacheWraith',
      happiness: clampStat(pet.happiness),
      energy: clampStat(pet.energy),
      hunger: clampStat(pet.hunger),
      experience: Math.max(0, Math.round(pet.experience)),
    },
  };
}

export type ImportResult =
  { ok: true; data: PetExportData; level: number } | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function parseImport(json: string): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: 'This is not valid JSON.' };
  }

  if (!isRecord(raw)) {
    return { ok: false, error: 'The data must be a JSON object.' };
  }
  if (raw.format !== EXPORT_FORMAT) {
    return { ok: false, error: 'This does not look like a CacheWraith export.' };
  }
  if (!isFiniteNumber(raw.version) || raw.version > EXPORT_VERSION || raw.version < 1) {
    return { ok: false, error: `Unsupported export version: ${String(raw.version)}.` };
  }
  if (!isRecord(raw.pet)) {
    return { ok: false, error: 'The export is missing pet data.' };
  }

  const pet = raw.pet;
  if (typeof pet.name !== 'string' || !pet.name.trim()) {
    return { ok: false, error: 'The pet name is missing or empty.' };
  }
  for (const field of ['happiness', 'energy', 'hunger', 'experience'] as const) {
    if (!isFiniteNumber(pet[field])) {
      return { ok: false, error: `The pet field "${field}" must be a number.` };
    }
  }

  const data = buildExport({
    name: pet.name,
    happiness: pet.happiness as number,
    energy: pet.energy as number,
    hunger: pet.hunger as number,
    experience: pet.experience as number,
  });
  return { ok: true, data, level: levelForExperience(data.pet.experience) };
}
