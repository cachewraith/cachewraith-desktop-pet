/**
 * SQLite access through the official Tauri SQL plugin. Migrations are
 * registered on the Rust side (src-tauri/migrations); loading the database
 * runs them automatically.
 */
import Database from '@tauri-apps/plugin-sql';

import { logger } from '../../utils/logger';

export const DB_URL = 'sqlite:cachewraith.db';

let dbPromise: Promise<Database> | null = null;

export function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = Database.load(DB_URL).catch((error: unknown) => {
      dbPromise = null;
      logger.error('db', 'failed to open SQLite database', error);
      throw new Error('The local database could not be opened.');
    });
  }
  return dbPromise;
}
