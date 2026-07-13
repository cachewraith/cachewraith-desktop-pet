/**
 * Typed wrapper around the Tauri store plugin for lightweight preferences.
 * Structured data (pet profile, conversations) lives in SQLite instead.
 */
import { load, type Store } from '@tauri-apps/plugin-store';

import { logger } from '../../utils/logger';

export type ThemeName = 'system' | 'dark' | 'light';

export interface Preferences {
  windowX: number | null;
  windowY: number | null;
  soundEnabled: boolean;
  reducedMotion: boolean;
  theme: ThemeName;
  speechBubbleDurationMs: number;
  aiEnabled: boolean;
  aiModel: string;
  aiPersonality: string;
  firstRunDone: boolean;
  notificationsEnabled: boolean;
}

export const DEFAULT_AI_MODEL = 'gpt-5-mini';

export const DEFAULT_PERSONALITY =
  'You are CacheWraith, a small, friendly desktop ghost who lives near the ' +
  "user's taskbar. You are playful, supportive and concise. You help the " +
  'user work, code and take healthy breaks. Never pretend to have performed ' +
  'computer actions unless the application has actually supplied an event ' +
  'confirming them. Keep ordinary responses under four sentences unless the ' +
  'user asks for detail.';

export const DEFAULT_PREFERENCES: Preferences = {
  windowX: null,
  windowY: null,
  soundEnabled: true,
  reducedMotion: false,
  theme: 'system',
  speechBubbleDurationMs: 4000,
  aiEnabled: false,
  aiModel: DEFAULT_AI_MODEL,
  aiPersonality: DEFAULT_PERSONALITY,
  firstRunDone: false,
  notificationsEnabled: true,
};

const STORE_FILE = 'preferences.json';

let storePromise: Promise<Store> | null = null;

function getStore(): Promise<Store> {
  if (!storePromise) {
    storePromise = load(STORE_FILE, { autoSave: true, defaults: {} });
  }
  return storePromise;
}

export async function getPreference<K extends keyof Preferences>(key: K): Promise<Preferences[K]> {
  try {
    const store = await getStore();
    const value = await store.get<Preferences[K]>(key);
    return value ?? DEFAULT_PREFERENCES[key];
  } catch (error) {
    logger.warn('preferences', `failed to read "${key}", using default`, error);
    return DEFAULT_PREFERENCES[key];
  }
}

export async function setPreference<K extends keyof Preferences>(
  key: K,
  value: Preferences[K]
): Promise<void> {
  try {
    const store = await getStore();
    await store.set(key, value);
    await store.save();
  } catch (error) {
    logger.error('preferences', `failed to write "${key}"`, error);
    throw new Error('Could not save your settings.', { cause: error });
  }
}

export async function getAllPreferences(): Promise<Preferences> {
  const keys = Object.keys(DEFAULT_PREFERENCES) as (keyof Preferences)[];
  const result = { ...DEFAULT_PREFERENCES };
  for (const key of keys) {
    // Sequential reads are fine: the store is an in-memory map after load.
    const value = await getPreference(key);
    (result as Record<string, unknown>)[key] = value;
  }
  return result;
}
