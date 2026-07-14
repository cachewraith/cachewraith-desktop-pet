/**
 * SQLite access for pet-character ownership, favorites and the active pet.
 * The active pet id lives on the existing pet_profile row so switching
 * characters can never touch statistics.
 */
import { getDb } from '../../../services/database/db';
import { logger } from '../../../utils/logger';
import { DEFAULT_PET_ID, type PetCharacterState } from '../types/pet-library.types';

interface CharacterRow {
  id: string;
  unlocked: number;
  favorite: number;
  first_selected_at: string | null;
  last_selected_at: string | null;
  selection_count: number;
}

function rowToState(row: CharacterRow): PetCharacterState {
  return {
    id: row.id,
    unlocked: row.unlocked === 1,
    favorite: row.favorite === 1,
    firstSelectedAt: row.first_selected_at,
    lastSelectedAt: row.last_selected_at,
    selectionCount: row.selection_count,
  };
}

export async function loadCharacterStates(): Promise<Map<string, PetCharacterState>> {
  const db = await getDb();
  const rows = await db.select<CharacterRow[]>(
    'SELECT id, unlocked, favorite, first_selected_at, last_selected_at, selection_count FROM pet_characters'
  );
  return new Map(rows.map((row) => [row.id, rowToState(row)]));
}

export async function setFavorite(petId: string, favorite: boolean): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE pet_characters SET favorite = $1, updated_at = datetime('now') WHERE id = $2",
    [favorite ? 1 : 0, petId]
  );
}

export async function unlockCharacter(petId: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE pet_characters SET unlocked = 1, updated_at = datetime('now') WHERE id = $1",
    [petId]
  );
}

export async function unlockAllCharacters(): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE pet_characters SET unlocked = 1, updated_at = datetime('now')");
}

export async function getActivePetId(): Promise<string> {
  try {
    const db = await getDb();
    const rows = await db.select<{ active_pet_id: string }[]>(
      'SELECT active_pet_id FROM pet_profile WHERE id = 1'
    );
    const id = rows[0]?.active_pet_id;
    return typeof id === 'string' && id ? id : DEFAULT_PET_ID;
  } catch (error) {
    logger.warn('pet-library', 'failed to read active pet, using default', error);
    return DEFAULT_PET_ID;
  }
}

/** Persist the selection and update character usage bookkeeping. */
export async function persistActivePet(petId: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE pet_profile SET active_pet_id = $1, updated_at = datetime('now') WHERE id = 1",
    [petId]
  );
  await db.execute(
    `UPDATE pet_characters
     SET last_selected_at = datetime('now'),
         first_selected_at = COALESCE(first_selected_at, datetime('now')),
         selection_count = selection_count + 1,
         updated_at = datetime('now')
     WHERE id = $1`,
    [petId]
  );
}
