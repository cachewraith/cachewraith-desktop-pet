import { useEffect, useState } from 'react';
import { appDataDir } from '@tauri-apps/api/path';
import { emit } from '@tauri-apps/api/event';

import {
  clearActivities,
  loadPetProfile,
  savePetName,
  savePetStats,
} from '../../features/pet/pet.repository';
import { moodForStats, normalizeStats } from '../../features/pet/pet.stats';
import { clearAllChatHistory } from '../../features/chat/chat.repository';
import { buildExport, parseImport } from '../../features/settings/importExport';
import { resetPetProgress } from '../../features/pet/pet.repository';
import { notify } from '../../services/notifications/notifications';
import { AppEvents } from '../../types/events';
import { logger } from '../../utils/logger';

export function DataSection() {
  const [dbLocation, setDbLocation] = useState('…');
  const [exportText, setExportText] = useState('');
  const [importText, setImportText] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [confirmWipe, setConfirmWipe] = useState(false);

  useEffect(() => {
    void appDataDir()
      .then((dir) =>
        setDbLocation(`${dir}${dir.endsWith('\\') || dir.endsWith('/') ? '' : '\\'}cachewraith.db`)
      )
      .catch(() => setDbLocation('(could not determine the app data directory)'));
  }, []);

  const doExport = async () => {
    setMessage(null);
    try {
      const profile = await loadPetProfile();
      const data = buildExport(profile);
      const json = JSON.stringify(data, null, 2);
      setExportText(json);
      try {
        await navigator.clipboard.writeText(json);
        setMessage('Export copied to the clipboard (and shown below).');
      } catch {
        setMessage('Export shown below — copy it manually.');
      }
    } catch (error) {
      logger.error('settings', 'export failed', error);
      setMessage('Could not export the pet data.');
    }
  };

  const doImport = async () => {
    setMessage(null);
    const result = parseImport(importText);
    if (!result.ok) {
      setMessage(`Import rejected: ${result.error}`);
      return;
    }
    try {
      const pet = result.data.pet;
      await savePetName(pet.name);
      await savePetStats(
        normalizeStats({ ...pet, level: result.level }),
        moodForStats(normalizeStats({ ...pet, level: result.level }))
      );
      await emit(AppEvents.petProfileChanged, null);
      setImportText('');
      setMessage(`Imported "${pet.name}" (level ${result.level}).`);
    } catch (error) {
      logger.error('settings', 'import failed', error);
      setMessage('The data was valid but could not be written to the database.');
    }
  };

  const doClearActivities = async () => {
    try {
      await clearActivities();
      setMessage('Activity history cleared.');
    } catch {
      setMessage('Could not clear the activity history.');
    }
  };

  const doWipe = async () => {
    setConfirmWipe(false);
    try {
      await clearAllChatHistory();
      await clearActivities();
      await resetPetProgress();
      await emit(AppEvents.petProfileChanged, null);
      setMessage('All local data was reset.');
    } catch (error) {
      logger.error('settings', 'wipe failed', error);
      setMessage('Could not reset all data.');
    }
  };

  const testNotification = async () => {
    const sent = await notify('test', 'CacheWraith', 'Notifications are working! 👻');
    setMessage(sent ? 'Test notification sent.' : 'Notification not sent (permission or setting).');
  };

  return (
    <section aria-labelledby="data-heading">
      <h2 id="data-heading">Data</h2>

      <p className="setting-hint">
        Database location: <code>{dbLocation}</code>
      </p>

      <h3>Export</h3>
      <div className="setting-actions">
        <button type="button" onClick={() => void doExport()}>
          Export pet data to JSON
        </button>
        <button type="button" onClick={() => void testNotification()}>
          Send test notification
        </button>
      </div>
      {exportText && (
        <textarea
          className="data-textarea"
          readOnly
          value={exportText}
          rows={8}
          aria-label="Exported pet data"
        />
      )}

      <h3>Import</h3>
      <textarea
        className="data-textarea"
        value={importText}
        onChange={(e) => setImportText(e.target.value)}
        rows={8}
        placeholder="Paste a CacheWraith JSON export here"
        aria-label="Pet data to import"
      />
      <div className="setting-actions">
        <button type="button" onClick={() => void doImport()} disabled={!importText.trim()}>
          Validate and import
        </button>
      </div>

      <h3>Maintenance</h3>
      <div className="setting-actions">
        <button type="button" onClick={() => void doClearActivities()}>
          Clear activity history
        </button>
        {!confirmWipe ? (
          <button type="button" className="danger" onClick={() => setConfirmWipe(true)}>
            Reset all local data…
          </button>
        ) : (
          <span className="confirm-row">
            Delete chats, activities and pet progress?
            <button type="button" className="danger" onClick={() => void doWipe()}>
              Yes, reset everything
            </button>
            <button type="button" onClick={() => setConfirmWipe(false)}>
              Cancel
            </button>
          </span>
        )}
      </div>

      {message && <p className="setting-message">{message}</p>}
    </section>
  );
}
