/**
 * Optional desktop notifications with permission handling and anti-spam
 * throttling (at most one notification per category per 10 minutes).
 */
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';

import { getPreference } from '../storage/preferences';
import { logger } from '../../utils/logger';

const THROTTLE_MS = 10 * 60 * 1000;
const lastSent = new Map<string, number>();

async function ensurePermission(): Promise<boolean> {
  try {
    if (await isPermissionGranted()) return true;
    const permission = await requestPermission();
    return permission === 'granted';
  } catch (error) {
    logger.warn('notifications', 'permission check failed', error);
    return false;
  }
}

export async function notify(
  category: 'hungry' | 'level-up' | 'test',
  title: string,
  body: string
): Promise<boolean> {
  const enabled = await getPreference('notificationsEnabled');
  if (!enabled) return false;

  const now = Date.now();
  const last = lastSent.get(category) ?? 0;
  if (category !== 'test' && now - last < THROTTLE_MS) return false;

  if (!(await ensurePermission())) return false;

  try {
    sendNotification({ title, body });
    lastSent.set(category, now);
    return true;
  } catch (error) {
    logger.warn('notifications', 'failed to send notification', error);
    return false;
  }
}
