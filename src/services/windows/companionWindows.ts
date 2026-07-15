/**
 * Companion windows: extra desktop pets beyond the main one, each living in
 * its own transparent always-on-top window (label `companion-<petId>`).
 * The main pet plus companions are capped at MAX_DESKTOP_PETS.
 */
import { emit } from '@tauri-apps/api/event';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

import { getManifest } from '../../features/pet-library/services/pet-asset-loader';
import { AppEvents } from '../../types/events';
import { logger } from '../../utils/logger';
import { getPreference, setPreference } from '../storage/preferences';
import { PET_WINDOW_SIZE, type WindowPos } from './petWindow';

/** Main pet + companions shown at the same time. */
export const MAX_DESKTOP_PETS = 5;

const LABEL_PREFIX = 'companion-';

export type CompanionsChangedPayload = string[];

export function companionLabel(petId: string): string {
  return LABEL_PREFIX + petId;
}

/** Pet id encoded in a companion window label, or null for other windows. */
export function companionPetIdFromLabel(label: string): string | null {
  return label.startsWith(LABEL_PREFIX) ? label.slice(LABEL_PREFIX.length) : null;
}

/**
 * Pure guard used by the UI and tests: why `petId` cannot be added as a
 * desktop companion right now. Null means it can.
 */
export function companionBlockedReason(
  companions: string[],
  activePetId: string,
  petId: string
): string | null {
  if (petId === activePetId) return 'This pet is already your main desktop pet.';
  if (companions.includes(petId)) return 'This pet is already on your desktop.';
  if (companions.length + 1 >= MAX_DESKTOP_PETS) {
    return `You can show at most ${MAX_DESKTOP_PETS} pets at once.`;
  }
  return null;
}

/** Saved companion ids, pruned of pets that no longer exist in the catalog. */
export async function getCompanionIds(): Promise<string[]> {
  const ids = await getPreference('companionPets');
  return (Array.isArray(ids) ? ids : []).filter((id) => Boolean(getManifest(id)));
}

async function saveCompanionIds(ids: string[]): Promise<void> {
  await setPreference('companionPets', ids);
  await emit(AppEvents.companionsChanged, ids satisfies CompanionsChangedPayload);
}

export async function getCompanionPosition(petId: string): Promise<WindowPos | null> {
  const positions = await getPreference('companionPositions');
  return positions[petId] ?? null;
}

export async function saveCompanionPosition(petId: string, pos: WindowPos): Promise<void> {
  const positions = await getPreference('companionPositions');
  await setPreference('companionPositions', { ...positions, [petId]: pos });
}

/**
 * Horizontal offset for the corner-fallback placement so companions fan out
 * to the left of the main pet instead of stacking on top of it.
 */
export async function companionFallbackOffsetX(petId: string): Promise<number> {
  const ids = await getCompanionIds();
  const index = Math.max(0, ids.indexOf(petId));
  return (index + 1) * Math.round(PET_WINDOW_SIZE.width * 0.75);
}

async function openCompanionWindow(petId: string): Promise<void> {
  const label = companionLabel(petId);
  if (await WebviewWindow.getByLabel(label)) return;
  await new Promise<void>((resolve, reject) => {
    const window = new WebviewWindow(label, {
      url: 'index.html',
      title: getManifest(petId)?.name ?? 'CacheWraith companion',
      width: PET_WINDOW_SIZE.width,
      height: PET_WINDOW_SIZE.height,
      transparent: true,
      decorations: false,
      shadow: false,
      alwaysOnTop: true,
      resizable: false,
      maximizable: false,
      minimizable: false,
      skipTaskbar: true,
      // CompanionApp shows the window itself once it restored its position.
      visible: false,
      focus: false,
    });
    window.once('tauri://created', () => resolve());
    window.once('tauri://error', (event) => {
      reject(new Error(`could not create companion window: ${JSON.stringify(event.payload)}`));
    });
  });
}

/** Persist and show an extra desktop pet. Callers validate with companionBlockedReason. */
export async function addCompanion(petId: string): Promise<void> {
  const ids = await getCompanionIds();
  if (!ids.includes(petId)) {
    await saveCompanionIds([...ids, petId]);
  }
  await openCompanionWindow(petId);
}

/** Remove a companion from the desktop (also used by a companion to dismiss itself). */
export async function removeCompanion(petId: string): Promise<void> {
  const ids = await getCompanionIds();
  await saveCompanionIds(ids.filter((id) => id !== petId));
  const window = await WebviewWindow.getByLabel(companionLabel(petId));
  await window?.close();
}

/** Open windows for every saved companion; the main pet window calls this on startup. */
export async function syncCompanionWindows(): Promise<void> {
  const ids = await getCompanionIds();
  for (const id of ids.slice(0, MAX_DESKTOP_PETS - 1)) {
    try {
      await openCompanionWindow(id);
    } catch (error) {
      logger.error('companions', `failed to open companion window for "${id}"`, error);
    }
  }
}
