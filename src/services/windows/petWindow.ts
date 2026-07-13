/**
 * Native pet-window management: positioning, dragging, show/hide,
 * temporary resize for the chat panel.
 */
import { invoke } from '@tauri-apps/api/core';
import { LogicalSize, PhysicalPosition } from '@tauri-apps/api/dpi';
import { getCurrentWindow } from '@tauri-apps/api/window';

import { getPreference, setPreference } from '../storage/preferences';
import { logger } from '../../utils/logger';

export interface WindowPos {
  x: number;
  y: number;
}

export const PET_WINDOW_SIZE = { width: 280, height: 320 };
export const PET_WINDOW_CHAT_SIZE = { width: 320, height: 540 };

/**
 * Restore the saved window position (validated against active monitors on
 * the Rust side), then show the window. Falls back to the bottom-right
 * corner of the primary monitor.
 */
export async function restorePositionAndShow(): Promise<void> {
  const window = getCurrentWindow();
  try {
    const x = await getPreference('windowX');
    const y = await getPreference('windowY');
    const applied = await invoke<WindowPos>('apply_saved_position', { x, y });
    await savePosition(applied);
  } catch (error) {
    logger.warn('window', 'could not restore position, keeping defaults', error);
  }
  await window.show();
}

export async function savePosition(pos: WindowPos): Promise<void> {
  try {
    await setPreference('windowX', pos.x);
    await setPreference('windowY', pos.y);
  } catch (error) {
    logger.warn('window', 'failed to persist window position', error);
  }
}

export async function saveCurrentPosition(): Promise<void> {
  try {
    const pos = await getCurrentWindow().outerPosition();
    await savePosition({ x: pos.x, y: pos.y });
  } catch (error) {
    logger.warn('window', 'failed to read window position', error);
  }
}

/** Begin a native window drag (call from a pointerdown handler). */
export async function startDragging(): Promise<void> {
  await getCurrentWindow().startDragging();
}

export async function resetPosition(): Promise<WindowPos | null> {
  try {
    const pos = await invoke<WindowPos>('reset_pet_position');
    await savePosition(pos);
    return pos;
  } catch (error) {
    logger.error('window', 'failed to reset position', error);
    return null;
  }
}

export async function hidePetWindow(): Promise<void> {
  await getCurrentWindow().hide();
}

/**
 * Grow the pet window upward for the chat panel (or shrink back), keeping
 * the pet anchored at the bottom edge.
 */
export async function setChatExpanded(expanded: boolean): Promise<void> {
  const window = getCurrentWindow();
  try {
    const before = await window.outerPosition();
    const beforeSize = await window.outerSize();
    const target = expanded ? PET_WINDOW_CHAT_SIZE : PET_WINDOW_SIZE;
    await window.setSize(new LogicalSize(target.width, target.height));
    const afterSize = await window.outerSize();
    const dy = afterSize.height - beforeSize.height;
    const dx = afterSize.width - beforeSize.width;
    await window.setPosition(new PhysicalPosition(before.x - dx, before.y - dy));
    if (!expanded) {
      await saveCurrentPosition();
    }
  } catch (error) {
    logger.error('window', 'failed to resize for chat', { expanded, error });
    // Best effort: try to at least restore the base size.
    if (!expanded) {
      await window
        .setSize(new LogicalSize(PET_WINDOW_SIZE.width, PET_WINDOW_SIZE.height))
        .catch(() => undefined);
    }
  }
}
