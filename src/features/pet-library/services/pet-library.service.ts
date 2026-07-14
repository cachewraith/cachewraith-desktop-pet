/**
 * Pet Library orchestration: merges the validated catalog with SQLite
 * state, enforces selection rules and broadcasts the active-pet event.
 */
import { invoke } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';

import { AppEvents } from '../../../types/events';
import { logger } from '../../../utils/logger';
import { catalogManifests, unlockRuleFor } from '../data/pet-catalog';
import { getManifest } from './pet-asset-loader';
import {
  getActivePetId,
  loadCharacterStates,
  persistActivePet,
  setFavorite,
  unlockAllCharacters,
} from './pet-library.repository';
import {
  DEFAULT_PET_ID,
  type ActivePetChangedPayload,
  type LibraryPet,
  type PetCharacterManifest,
  type PetCharacterState,
} from '../types/pet-library.types';

function defaultState(manifest: PetCharacterManifest): PetCharacterState {
  return {
    id: manifest.id,
    unlocked: manifest.defaultUnlocked,
    favorite: false,
    firstSelectedAt: null,
    lastSelectedAt: null,
    selectionCount: 0,
  };
}

/** Catalog + DB state, tolerant of a missing/failed database. */
export async function loadLibrary(): Promise<LibraryPet[]> {
  const manifests = catalogManifests();
  let states = new Map<string, PetCharacterState>();
  try {
    states = await loadCharacterStates();
  } catch (error) {
    logger.warn('pet-library', 'character states unavailable, using defaults', error);
  }
  return manifests.map((manifest) => {
    const rule = unlockRuleFor(manifest.id);
    return {
      manifest,
      state: states.get(manifest.id) ?? defaultState(manifest),
      unlockHint: rule?.hint ?? null,
      requiredLevel: rule?.requiredLevel ?? null,
    };
  });
}

/** Pure guard used by the UI and tests: why a pet cannot be selected. */
export function selectionBlockedReason(pet: LibraryPet | undefined): string | null {
  if (!pet) return 'This pet does not exist.';
  if (!pet.state.unlocked) {
    return pet.unlockHint ? `Locked — ${pet.unlockHint} to unlock.` : 'This pet is still locked.';
  }
  return null;
}

/**
 * Select a pet: validate, persist, notify the pet window and update the
 * tray tooltip. Statistics are untouched — only pet_profile.active_pet_id
 * changes.
 */
export async function selectActivePet(pet: LibraryPet): Promise<void> {
  const blocked = selectionBlockedReason(pet);
  if (blocked) throw new Error(blocked);
  if (!getManifest(pet.manifest.id)) {
    throw new Error('The assets for this pet could not be loaded.');
  }

  await persistActivePet(pet.manifest.id);
  const payload: ActivePetChangedPayload = { petId: pet.manifest.id };
  await emit(AppEvents.activePetChanged, payload);
  invoke('set_tray_tooltip', { tooltip: pet.manifest.name }).catch((error) => {
    logger.warn('pet-library', 'failed to update tray tooltip', error);
  });
}

export async function toggleFavorite(petId: string, favorite: boolean): Promise<void> {
  await setFavorite(petId, favorite);
}

/** Development helper — the button is only rendered when import.meta.env.DEV. */
export async function devUnlockAll(): Promise<void> {
  await unlockAllCharacters();
}

/** Active pet id with fallback to the default when the stored id is unknown. */
export async function resolveActivePetId(): Promise<string> {
  const id = await getActivePetId();
  if (getManifest(id)) return id;
  logger.warn('pet-library', `stored active pet "${id}" is unknown, falling back`);
  return DEFAULT_PET_ID;
}

/**
 * Identity paragraph merged into the user-configured AI personality. The
 * user's own personality text is never replaced.
 */
export function buildPetIdentity(manifest: PetCharacterManifest | null): string {
  if (!manifest || manifest.id === DEFAULT_PET_ID) return '';
  return (
    `You are currently appearing as ${manifest.name}, ${manifest.description
      .charAt(0)
      .toLowerCase()}${manifest.description.slice(1).replace(/\.$/, '')}. ` +
    `Category: ${manifest.category}. Personality: ${manifest.personality} ` +
    `Background: ${manifest.lore} Stay in character while remaining helpful.`
  );
}
