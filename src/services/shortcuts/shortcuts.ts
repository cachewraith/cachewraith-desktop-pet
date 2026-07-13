/**
 * Global-shortcut status. Registration happens on the Rust side at startup;
 * this service only reports whether it worked so Settings can show it.
 */
import { invoke } from '@tauri-apps/api/core';

import { logger } from '../../utils/logger';

export interface ShortcutStatus {
  accelerator: string;
  registered: boolean;
  error: string | null;
}

export async function getShortcutStatus(): Promise<ShortcutStatus> {
  try {
    return await invoke<ShortcutStatus>('get_shortcut_status');
  } catch (error) {
    logger.warn('shortcuts', 'failed to read shortcut status', error);
    return {
      accelerator: 'ctrl+shift+space',
      registered: false,
      error: 'Could not query the shortcut status.',
    };
  }
}

/** Human-readable form of the default accelerator. */
export function formatAccelerator(accelerator: string): string {
  return accelerator
    .split('+')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('+');
}
