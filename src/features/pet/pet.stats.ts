/**
 * Pure statistic and leveling logic — no I/O, fully unit-testable.
 */
import { clampStat } from '../../utils/clamp';
import type { PetStateName } from './pet.types';

export interface PetStats {
  happiness: number;
  energy: number;
  hunger: number;
  experience: number;
  level: number;
}

export const XP_PER_LEVEL_BASE = 25;

/** Level grows with the square root of experience: 0xp→1, 25xp→2, 100xp→3… */
export function levelForExperience(experience: number): number {
  const xp = Math.max(0, experience);
  return Math.floor(Math.sqrt(xp / XP_PER_LEVEL_BASE)) + 1;
}

/** Experience required to reach a given level (inverse of levelForExperience). */
export function experienceForLevel(level: number): number {
  const l = Math.max(1, Math.floor(level));
  return (l - 1) * (l - 1) * XP_PER_LEVEL_BASE;
}

export function normalizeStats(stats: PetStats): PetStats {
  const experience = Math.max(0, Math.round(stats.experience) || 0);
  return {
    happiness: clampStat(stats.happiness),
    energy: clampStat(stats.energy),
    hunger: clampStat(stats.hunger),
    experience,
    level: levelForExperience(experience),
  };
}

export interface StatDelta {
  happiness?: number;
  energy?: number;
  hunger?: number;
  experience?: number;
}

export function applyDelta(stats: PetStats, delta: StatDelta): PetStats {
  return normalizeStats({
    happiness: stats.happiness + (delta.happiness ?? 0),
    energy: stats.energy + (delta.energy ?? 0),
    hunger: stats.hunger + (delta.hunger ?? 0),
    experience: stats.experience + (delta.experience ?? 0),
    level: stats.level,
  });
}

/**
 * Slow ambient decay applied once per in-memory tick (~60 s). Values are
 * intentionally gentle so the pet does not become needy.
 */
export function decayTick(stats: PetStats, state: PetStateName): PetStats {
  const sleeping = state === 'sleeping';
  // Whole numbers only: stats are stored as integers, fractions would be
  // silently lost to rounding.
  return applyDelta(stats, {
    hunger: sleeping ? 0 : 1,
    energy: sleeping ? 4 : -1,
    happiness: stats.hunger > 80 ? -1 : 0,
  });
}

export const INTERACTION_DELTAS: Record<'feed' | 'pet' | 'chat', StatDelta> = {
  feed: { hunger: -35, happiness: 8, experience: 5 },
  pet: { happiness: 12, experience: 3 },
  chat: { happiness: 5, energy: -2, experience: 4 },
};

export function moodForStats(stats: PetStats): string {
  if (stats.hunger >= 85) return 'hungry';
  if (stats.energy <= 15) return 'sleepy';
  if (stats.happiness >= 75) return 'happy';
  if (stats.happiness <= 30) return 'sad';
  return 'content';
}

export const VERY_HUNGRY_THRESHOLD = 90;
export const SLEEPY_ENERGY_THRESHOLD = 12;
export const HUNGRY_STATE_THRESHOLD = 85;
