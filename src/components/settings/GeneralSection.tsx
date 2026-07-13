import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';

import { getAutostartEnabled, setAutostartEnabled } from '../../services/autostart/autostart';
import { formatAccelerator, getShortcutStatus } from '../../services/shortcuts/shortcuts';
import type { ShortcutStatus } from '../../services/shortcuts/shortcuts';
import { getPreference, setPreference, type ThemeName } from '../../services/storage/preferences';
import { AppEvents } from '../../types/events';
import { logger } from '../../utils/logger';

export function GeneralSection() {
  const [autostart, setAutostart] = useState(false);
  const [sound, setSound] = useState(true);
  const [reducedMotion, setReducedMotionPref] = useState(false);
  const [theme, setTheme] = useState<ThemeName>('system');
  const [shortcut, setShortcut] = useState<ShortcutStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setAutostart(await getAutostartEnabled());
      setSound(await getPreference('soundEnabled'));
      setReducedMotionPref(await getPreference('reducedMotion'));
      setTheme(await getPreference('theme'));
      setShortcut(await getShortcutStatus());
    })();
  }, []);

  const toggleAutostart = async (wanted: boolean) => {
    setMessage(null);
    try {
      const actual = await setAutostartEnabled(wanted);
      setAutostart(actual);
      if (actual !== wanted) {
        setMessage('Windows reported a different autostart state than requested.');
      }
    } catch (error) {
      setAutostart(await getAutostartEnabled());
      setMessage(error instanceof Error ? error.message : 'Autostart change failed.');
    }
  };

  const toggleSound = async (enabled: boolean) => {
    setSound(enabled);
    await setPreference('soundEnabled', enabled);
    await emit(AppEvents.toggleMute, enabled);
  };

  const toggleReducedMotion = async (enabled: boolean) => {
    setReducedMotionPref(enabled);
    await setPreference('reducedMotion', enabled);
    setMessage('Reduced motion applies fully after the pet window is reopened.');
  };

  const changeTheme = async (value: ThemeName) => {
    setTheme(value);
    await setPreference('theme', value);
  };

  const resetPosition = async () => {
    try {
      await invoke('reset_pet_position');
      await emit(AppEvents.resetPosition, null);
      setMessage('Pet position was reset to the bottom-right corner.');
    } catch (error) {
      logger.error('settings', 'reset position failed', error);
      setMessage('Could not reset the pet position.');
    }
  };

  const showHidePet = async (show: boolean) => {
    try {
      const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      const pet = await WebviewWindow.getByLabel('pet');
      if (!pet) return;
      if (show) {
        await pet.show();
        await emit(AppEvents.showPet, null);
      } else {
        await pet.hide();
        await emit(AppEvents.hidePet, null);
      }
    } catch (error) {
      logger.error('settings', 'show/hide pet failed', error);
    }
  };

  return (
    <section aria-labelledby="general-heading">
      <h2 id="general-heading">General</h2>

      <label className="setting-row">
        <input
          type="checkbox"
          checked={autostart}
          onChange={(e) => void toggleAutostart(e.target.checked)}
        />
        <span>Start CacheWraith when I sign in to Windows</span>
      </label>

      <label className="setting-row">
        <input
          type="checkbox"
          checked={sound}
          onChange={(e) => void toggleSound(e.target.checked)}
        />
        <span>Sound effects</span>
      </label>

      <label className="setting-row">
        <input
          type="checkbox"
          checked={reducedMotion}
          onChange={(e) => void toggleReducedMotion(e.target.checked)}
        />
        <span>Reduced motion (calmer animations)</span>
      </label>

      <label className="setting-row">
        <span>Theme</span>
        <select value={theme} onChange={(e) => void changeTheme(e.target.value as ThemeName)}>
          <option value="system">System</option>
          <option value="dark">Dark</option>
          <option value="light">Light</option>
        </select>
      </label>

      <div className="setting-row">
        <span>Global shortcut</span>
        <span className={shortcut?.registered ? 'badge badge-ok' : 'badge badge-warn'}>
          {shortcut
            ? shortcut.registered
              ? `${formatAccelerator(shortcut.accelerator)} — active`
              : `Not registered${shortcut.error ? ` (${shortcut.error})` : ''}`
            : 'Checking…'}
        </span>
      </div>

      <div className="setting-row setting-actions">
        <button type="button" onClick={() => void resetPosition()}>
          Reset pet position
        </button>
        <button type="button" onClick={() => void showHidePet(true)}>
          Show pet
        </button>
        <button type="button" onClick={() => void showHidePet(false)}>
          Hide pet
        </button>
      </div>

      {message && <p className="setting-message">{message}</p>}
    </section>
  );
}
