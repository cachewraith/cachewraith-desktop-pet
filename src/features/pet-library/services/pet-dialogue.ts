/**
 * Pure pet-dialogue selection. Falls back to the generic CacheWraith
 * phrases when a pet does not define lines for a category.
 */
import { FALLBACK_RESPONSES } from '../../chat/fallback';
import type { PetDialogue } from '../types/pet-library.types';

export type DialogueKind = keyof PetDialogue;

const GREETING_PATTERN = /\b(hi|hello|hey|yo|good (morning|afternoon|evening))\b/i;

export function pickDialogueLine(
  dialogue: PetDialogue | undefined,
  kind: DialogueKind,
  seed: number
): string | null {
  const lines = dialogue?.[kind];
  if (!lines || lines.length === 0) return null;
  return lines[Math.abs(Math.floor(seed)) % lines.length];
}

export function randomDialogueLine(
  dialogue: PetDialogue | undefined,
  kind: DialogueKind,
  fallback: string
): string {
  return pickDialogueLine(dialogue, kind, Math.floor(Math.random() * 16)) ?? fallback;
}

/**
 * Offline chat reply flavoured by the active pet: greetings use the pet's
 * greeting lines, everything else mixes its happy/clicked lines with the
 * generic pool. Deterministic per (message, seed) for tests.
 */
export function pickPetChatFallback(
  dialogue: PetDialogue | undefined,
  userMessage: string,
  seed: number
): string {
  if (GREETING_PATTERN.test(userMessage)) {
    const line = pickDialogueLine(dialogue, 'greeting', seed);
    if (line) return line;
  }
  const pool = [...(dialogue?.happy ?? []), ...(dialogue?.clicked ?? []), ...FALLBACK_RESPONSES];
  return pool[Math.abs(Math.floor(seed)) % pool.length];
}
