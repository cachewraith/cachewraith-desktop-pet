import { useEffect, useState } from 'react';

import {
  AiServiceError,
  clearApiKey,
  hasApiKey,
  setApiKey,
  testConnection,
} from '../../services/ai/ai';
import { clearAllChatHistory } from '../../features/chat/chat.repository';
import {
  DEFAULT_AI_MODEL,
  DEFAULT_PERSONALITY,
  getPreference,
  setPreference,
} from '../../services/storage/preferences';

export function AiSection() {
  const [aiEnabled, setAiEnabled] = useState(false);
  const [keyPresent, setKeyPresent] = useState(false);
  const [keyDraft, setKeyDraft] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [model, setModel] = useState(DEFAULT_AI_MODEL);
  const [personality, setPersonality] = useState(DEFAULT_PERSONALITY);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    void (async () => {
      setAiEnabled(await getPreference('aiEnabled'));
      setModel(await getPreference('aiModel'));
      setPersonality(await getPreference('aiPersonality'));
      setKeyPresent(await hasApiKey().catch(() => false));
    })();
  }, []);

  const toggleAi = async (enabled: boolean) => {
    setAiEnabled(enabled);
    await setPreference('aiEnabled', enabled);
  };

  const saveKey = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await setApiKey(keyDraft);
      setKeyDraft('');
      setKeyPresent(true);
      setMessage('API key saved to the Windows Credential Manager.');
    } catch (error) {
      setMessage(error instanceof AiServiceError ? error.message : 'Could not save the key.');
    } finally {
      setBusy(false);
    }
  };

  const removeKey = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await clearApiKey();
      setKeyPresent(false);
      setMessage('API key removed.');
    } catch (error) {
      setMessage(error instanceof AiServiceError ? error.message : 'Could not remove the key.');
    } finally {
      setBusy(false);
    }
  };

  const saveModel = async () => {
    const trimmed = model.trim() || DEFAULT_AI_MODEL;
    setModel(trimmed);
    await setPreference('aiModel', trimmed);
    setMessage('Model saved.');
  };

  const savePersonality = async () => {
    const value = personality.trim() || DEFAULT_PERSONALITY;
    setPersonality(value);
    await setPreference('aiPersonality', value);
    setMessage('Personality saved.');
  };

  const runTest = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await testConnection(model.trim() || DEFAULT_AI_MODEL);
      setMessage('✅ Connection works! CacheWraith can reach OpenAI.');
    } catch (error) {
      setMessage(
        error instanceof AiServiceError ? `❌ ${error.message}` : '❌ The connection test failed.'
      );
    } finally {
      setBusy(false);
    }
  };

  const doClearHistory = async () => {
    setConfirmClear(false);
    try {
      await clearAllChatHistory();
      setMessage('Chat history cleared.');
    } catch {
      setMessage('Could not clear the chat history.');
    }
  };

  return (
    <section aria-labelledby="ai-heading">
      <h2 id="ai-heading">AI</h2>
      <p className="setting-hint">
        AI chat is optional. Using your own OpenAI API key may incur costs billed by OpenAI. The key
        is stored in the Windows Credential Manager, never in files or the database, and requests go
        directly from this app to OpenAI.
      </p>

      <label className="setting-row">
        <input
          type="checkbox"
          checked={aiEnabled}
          onChange={(e) => void toggleAi(e.target.checked)}
        />
        <span>Enable AI-powered replies</span>
      </label>

      <div className="setting-row">
        <span>API key {keyPresent ? '· ✅ saved' : '· not set'}</span>
        <input
          type={showKey ? 'text' : 'password'}
          value={keyDraft}
          onChange={(e) => setKeyDraft(e.target.value)}
          placeholder={keyPresent ? 'Enter a new key to replace it' : 'sk-…'}
          autoComplete="off"
          aria-label="OpenAI API key"
        />
        <button
          type="button"
          onClick={() => setShowKey((v) => !v)}
          aria-label={showKey ? 'Hide API key' : 'Show API key'}
          title={showKey ? 'Hide API key' : 'Show API key'}
        >
          {showKey ? '🙈' : '👁'}
        </button>
        <button type="button" onClick={() => void saveKey()} disabled={busy || !keyDraft.trim()}>
          Save key
        </button>
        {keyPresent && (
          <button type="button" onClick={() => void removeKey()} disabled={busy}>
            Remove
          </button>
        )}
      </div>

      <label className="setting-row">
        <span>Model</span>
        <input
          type="text"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          aria-label="OpenAI model name"
        />
        <button type="button" onClick={() => void saveModel()}>
          Save
        </button>
      </label>

      <label className="setting-column">
        <span>Pet personality (system prompt)</span>
        <textarea
          value={personality}
          rows={6}
          onChange={(e) => setPersonality(e.target.value)}
          aria-label="Pet personality"
        />
        <div className="setting-actions">
          <button type="button" onClick={() => void savePersonality()}>
            Save personality
          </button>
          <button type="button" onClick={() => setPersonality(DEFAULT_PERSONALITY)}>
            Restore default
          </button>
        </div>
      </label>

      <div className="setting-row setting-actions">
        <button type="button" onClick={() => void runTest()} disabled={busy || !keyPresent}>
          {busy ? 'Working…' : 'Test connection'}
        </button>
        {!confirmClear ? (
          <button type="button" className="danger" onClick={() => setConfirmClear(true)}>
            Clear chat history…
          </button>
        ) : (
          <span className="confirm-row">
            Delete all conversations?
            <button type="button" className="danger" onClick={() => void doClearHistory()}>
              Yes
            </button>
            <button type="button" onClick={() => setConfirmClear(false)}>
              No
            </button>
          </span>
        )}
      </div>

      {message && <p className="setting-message">{message}</p>}
    </section>
  );
}
