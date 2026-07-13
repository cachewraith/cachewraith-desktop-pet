/**
 * First-run onboarding shown inside the settings window.
 */
import { useState } from 'react';
import { emit } from '@tauri-apps/api/event';

import { savePetName } from '../../features/pet/pet.repository';
import { setAutostartEnabled } from '../../services/autostart/autostart';
import { setPreference } from '../../services/storage/preferences';
import { AppEvents } from '../../types/events';
import { logger } from '../../utils/logger';

interface OnboardingProps {
  onDone: () => void;
}

export function Onboarding({ onDone }: OnboardingProps) {
  const [name, setName] = useState('CacheWraith');
  const [autostart, setAutostart] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const finish = async () => {
    setBusy(true);
    setMessage(null);
    try {
      if (name.trim()) {
        await savePetName(name);
        await emit(AppEvents.petProfileChanged, null);
      }
      await setPreference('reducedMotion', reducedMotion);
      if (autostart) {
        const actual = await setAutostartEnabled(true).catch((error: unknown) => {
          setMessage(error instanceof Error ? error.message : 'Autostart could not be enabled.');
          return false;
        });
        setAutostart(actual);
      }
      await setPreference('firstRunDone', true);
      onDone();
    } catch (error) {
      logger.error('onboarding', 'finish failed', error);
      setMessage('Something went wrong saving your choices — you can adjust them in Settings.');
      await setPreference('firstRunDone', true).catch(() => undefined);
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="onboarding" aria-labelledby="onboarding-heading">
      <h2 id="onboarding-heading">👻 Welcome to CacheWraith</h2>
      <ul className="onboarding-list">
        <li>CacheWraith lives on your desktop, floating above other windows.</li>
        <li>
          <strong>Drag</strong> it to move it anywhere. It remembers its spot.
        </li>
        <li>
          <strong>Double-click</strong> it to talk. <strong>Right-click</strong> for quick actions.
        </li>
        <li>If it's hidden, use the tray icon near the clock.</li>
        <li>
          <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Space</kbd> toggles visibility from anywhere.
        </li>
        <li>
          AI chat is <em>optional</em>: it needs your own OpenAI API key, and API usage may cost
          money. No key is bundled with the app — without one, CacheWraith answers with friendly
          local phrases.
        </li>
      </ul>

      <label className="setting-row">
        <span>Name your ghost</span>
        <input
          type="text"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          aria-label="Pet name"
        />
      </label>

      <label className="setting-row">
        <input
          type="checkbox"
          checked={autostart}
          onChange={(e) => setAutostart(e.target.checked)}
        />
        <span>Start CacheWraith when I sign in to Windows</span>
      </label>

      <label className="setting-row">
        <input
          type="checkbox"
          checked={reducedMotion}
          onChange={(e) => setReducedMotion(e.target.checked)}
        />
        <span>Reduced motion</span>
      </label>

      <div className="setting-actions">
        <button type="button" className="primary" onClick={() => void finish()} disabled={busy}>
          {busy ? 'Saving…' : "Let's go!"}
        </button>
      </div>
      <p className="setting-hint">
        You can configure AI later under Settings → AI, or skip it entirely.
      </p>
      {message && <p className="setting-message">{message}</p>}
    </section>
  );
}
