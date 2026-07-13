/**
 * Windows autostart via the official Tauri autostart plugin. Always report
 * the real OS state; never assume a toggle succeeded.
 */
import { disable, enable, isEnabled } from '@tauri-apps/plugin-autostart';

import { logger } from '../../utils/logger';

export async function getAutostartEnabled(): Promise<boolean> {
  try {
    return await isEnabled();
  } catch (error) {
    logger.warn('autostart', 'failed to read autostart state', error);
    return false;
  }
}

/**
 * Set the autostart state and return the state the OS actually reports
 * afterwards. Throws a friendly error when the plugin call fails.
 */
export async function setAutostartEnabled(wanted: boolean): Promise<boolean> {
  try {
    if (wanted) {
      await enable();
    } else {
      await disable();
    }
  } catch (error) {
    logger.error('autostart', 'failed to change autostart', error);
    throw new Error(
      wanted
        ? 'Windows did not allow enabling autostart. You can add CacheWraith manually in Task Manager → Startup apps.'
        : 'Could not disable autostart. You can remove CacheWraith in Task Manager → Startup apps.',
      { cause: error }
    );
  }
  return getAutostartEnabled();
}
