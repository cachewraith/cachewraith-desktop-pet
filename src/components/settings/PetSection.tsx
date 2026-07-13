import { useEffect, useState } from 'react';
import { emit } from '@tauri-apps/api/event';

import {
  loadPetProfile,
  resetPetProgress,
  savePetName,
  savePetStats,
} from '../../features/pet/pet.repository';
import { applyDelta, INTERACTION_DELTAS, moodForStats } from '../../features/pet/pet.stats';
import type { PetProfile } from '../../features/pet/pet.types';
import { AppEvents } from '../../types/events';
import { logger } from '../../utils/logger';

function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat-bar-row">
      <span className="stat-bar-label">{label}</span>
      <div
        className="stat-bar"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div className="stat-bar-fill" style={{ width: `${value}%` }} />
      </div>
      <span className="stat-bar-value">{value}</span>
    </div>
  );
}

export function PetSection() {
  const [profile, setProfile] = useState<PetProfile | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const refresh = async () => {
    try {
      const p = await loadPetProfile();
      setProfile(p);
      setNameDraft(p.name);
    } catch (error) {
      logger.error('settings', 'failed to load pet profile', error);
      setMessage('Could not load the pet profile.');
    }
  };

  useEffect(() => {
    // Invoked from a microtask so the effect body itself stays setState-free.
    void Promise.resolve().then(refresh);
  }, []);

  const rename = async () => {
    try {
      await savePetName(nameDraft);
      await emit(AppEvents.petProfileChanged, null);
      await refresh();
      setMessage('Name saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save the name.');
    }
  };

  const interact = async (kind: 'feed' | 'pet') => {
    if (!profile) return;
    const next = applyDelta(profile, INTERACTION_DELTAS[kind]);
    await savePetStats(next, moodForStats(next));
    // petProfileChanged (not feedPet) so the pet window reloads the profile
    // instead of applying the interaction delta a second time.
    await emit(AppEvents.petProfileChanged, null);
    await refresh();
  };

  const doReset = async () => {
    setConfirmReset(false);
    try {
      await resetPetProgress();
      await emit(AppEvents.petProfileChanged, null);
      await refresh();
      setMessage('Pet progress was reset.');
    } catch (error) {
      logger.error('settings', 'reset failed', error);
      setMessage('Could not reset the pet.');
    }
  };

  return (
    <section aria-labelledby="pet-heading">
      <h2 id="pet-heading">Pet</h2>

      <label className="setting-row">
        <span>Pet name</span>
        <input
          type="text"
          value={nameDraft}
          maxLength={40}
          onChange={(e) => setNameDraft(e.target.value)}
          aria-label="Pet name"
        />
        <button type="button" onClick={() => void rename()} disabled={!nameDraft.trim()}>
          Save
        </button>
      </label>

      {profile && (
        <>
          <p className="setting-hint">
            Mood: <strong>{profile.mood}</strong> · Level {profile.level} · {profile.experience} XP
            · adopted {profile.createdAt.slice(0, 10)}
          </p>
          <StatBar label="Happiness" value={profile.happiness} />
          <StatBar label="Energy" value={profile.energy} />
          <StatBar label="Hunger" value={profile.hunger} />
        </>
      )}

      <div className="setting-row setting-actions">
        <button type="button" onClick={() => void interact('feed')}>
          🍬 Feed
        </button>
        <button type="button" onClick={() => void interact('pet')}>
          💜 Pet
        </button>
        <button type="button" onClick={() => void refresh()}>
          ↻ Refresh
        </button>
      </div>

      <div className="danger-zone">
        {!confirmReset ? (
          <button type="button" className="danger" onClick={() => setConfirmReset(true)}>
            Reset pet progress…
          </button>
        ) : (
          <div className="confirm-row" role="alertdialog" aria-label="Confirm pet reset">
            <span>Reset level, XP and stats? This cannot be undone.</span>
            <button type="button" className="danger" onClick={() => void doReset()}>
              Yes, reset
            </button>
            <button type="button" onClick={() => setConfirmReset(false)}>
              Cancel
            </button>
          </div>
        )}
      </div>

      {message && <p className="setting-message">{message}</p>}
    </section>
  );
}
