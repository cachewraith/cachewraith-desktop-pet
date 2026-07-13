/**
 * Typed SQLite repository for the pet profile and activity log.
 */
import { getDb } from '../../services/database/db';
import { logger } from '../../utils/logger';
import { normalizeStats, type PetStats } from './pet.stats';
import type { Activity, ActivityType, PetProfile } from './pet.types';

interface PetProfileRow {
  id: number;
  name: string;
  mood: string;
  happiness: number;
  energy: number;
  hunger: number;
  experience: number;
  level: number;
  created_at: string;
  updated_at: string;
  last_interaction_at: string | null;
}

function rowToProfile(row: PetProfileRow): PetProfile {
  const stats = normalizeStats({
    happiness: row.happiness,
    energy: row.energy,
    hunger: row.hunger,
    experience: row.experience,
    level: row.level,
  });
  return {
    id: row.id,
    name: typeof row.name === 'string' && row.name.trim() ? row.name : 'CacheWraith',
    mood: row.mood,
    ...stats,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastInteractionAt: row.last_interaction_at,
  };
}

export async function loadPetProfile(): Promise<PetProfile> {
  const db = await getDb();
  const rows = await db.select<PetProfileRow[]>('SELECT * FROM pet_profile WHERE id = 1');
  if (rows.length === 0) {
    // Should not happen (migration seeds the row) but recover anyway.
    logger.warn('pet', 'pet profile missing, recreating');
    await db.execute("INSERT OR IGNORE INTO pet_profile (id, name) VALUES (1, 'CacheWraith')");
    const retry = await db.select<PetProfileRow[]>('SELECT * FROM pet_profile WHERE id = 1');
    if (retry.length === 0) throw new Error('Could not create the pet profile.');
    return rowToProfile(retry[0]);
  }
  return rowToProfile(rows[0]);
}

export async function savePetStats(stats: PetStats, mood: string): Promise<void> {
  const db = await getDb();
  const s = normalizeStats(stats);
  await db.execute(
    `UPDATE pet_profile
     SET happiness = $1, energy = $2, hunger = $3, experience = $4, level = $5,
         mood = $6, updated_at = datetime('now')
     WHERE id = 1`,
    [s.happiness, s.energy, s.hunger, s.experience, s.level, mood]
  );
}

export async function savePetName(name: string): Promise<void> {
  const trimmed = name.trim().slice(0, 40);
  if (!trimmed) throw new Error('The pet name cannot be empty.');
  const db = await getDb();
  await db.execute("UPDATE pet_profile SET name = $1, updated_at = datetime('now') WHERE id = 1", [
    trimmed,
  ]);
}

export async function touchLastInteraction(): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE pet_profile SET last_interaction_at = datetime('now') WHERE id = 1");
}

export async function resetPetProgress(): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE pet_profile
     SET mood = 'idle', happiness = 70, energy = 80, hunger = 20,
         experience = 0, level = 1, updated_at = datetime('now'),
         last_interaction_at = NULL
     WHERE id = 1`
  );
}

export async function logActivity(
  type: ActivityType,
  details: string | null,
  experienceAwarded: number
): Promise<void> {
  try {
    const db = await getDb();
    await db.execute(
      'INSERT INTO activities (activity_type, details, experience_awarded) VALUES ($1, $2, $3)',
      [type, details, experienceAwarded]
    );
  } catch (error) {
    // Activity logging must never break an interaction.
    logger.warn('pet', 'failed to log activity', error);
  }
}

interface ActivityRow {
  id: number;
  activity_type: string;
  details: string | null;
  experience_awarded: number;
  created_at: string;
}

export async function loadRecentActivities(limit = 50): Promise<Activity[]> {
  const db = await getDb();
  const rows = await db.select<ActivityRow[]>(
    'SELECT * FROM activities ORDER BY id DESC LIMIT $1',
    [limit]
  );
  return rows.map((row) => ({
    id: row.id,
    activityType: row.activity_type,
    details: row.details,
    experienceAwarded: row.experience_awarded,
    createdAt: row.created_at,
  }));
}

export async function clearActivities(): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM activities');
}
