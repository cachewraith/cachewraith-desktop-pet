/**
 * Chat state hook: loads history from SQLite, sends messages through the
 * AI service (or offline fallback) and keeps the pet informed.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { AiServiceError, hasApiKey, sendChat, type AiChatMessage } from '../../services/ai/ai';
import { getPreference } from '../../services/storage/preferences';
import { logger } from '../../utils/logger';
import { getManifest } from '../pet-library/services/pet-asset-loader';
import { pickPetChatFallback } from '../pet-library/services/pet-dialogue';
import { buildPetIdentity, resolveActivePetId } from '../pet-library/services/pet-library.service';
import {
  clearConversation,
  getOrCreateConversation,
  loadMessages,
  saveMessage,
  type ChatMessageRecord,
} from './chat.repository';

const CONTEXT_MESSAGES = 12;

export interface ChatState {
  messages: ChatMessageRecord[];
  loading: boolean;
  sending: boolean;
  error: string | null;
}

export interface UseChatResult extends ChatState {
  send: (text: string) => Promise<void>;
  clear: () => Promise<void>;
}

interface UseChatOptions {
  onTalkingChange?: (talking: boolean) => void;
  onAssistantReply?: () => void;
}

let tempId = -1;

export function useChat(options: UseChatOptions = {}): UseChatResult {
  const [state, setState] = useState<ChatState>({
    messages: [],
    loading: true,
    sending: false,
    error: null,
  });
  const conversationRef = useRef<number | null>(null);
  const generationRef = useRef(0);
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const conversationId = await getOrCreateConversation();
        conversationRef.current = conversationId;
        const messages = await loadMessages(conversationId);
        if (!cancelled) {
          setState((s) => ({ ...s, messages, loading: false }));
        }
      } catch (error) {
        logger.error('chat', 'failed to load history', error);
        if (!cancelled) {
          setState((s) => ({
            ...s,
            loading: false,
            error: 'Could not load the chat history.',
          }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content) return;
      const conversationId = conversationRef.current;
      if (conversationId === null) return;

      const generation = ++generationRef.current;
      const userMessage: ChatMessageRecord = {
        id: tempId--,
        conversationId,
        role: 'user',
        content,
        createdAt: new Date().toISOString(),
      };

      setState((s) => ({
        ...s,
        messages: [...s.messages, userMessage],
        sending: true,
        error: null,
      }));
      optionsRef.current.onTalkingChange?.(true);

      try {
        await saveMessage(conversationId, 'user', content);

        const aiEnabled = await getPreference('aiEnabled');
        const keyAvailable = aiEnabled ? await hasApiKey().catch(() => false) : false;

        let reply: string;
        // Resolve at send time so a companion chosen moments ago is reflected
        // in both local dialogue and the optional AI system context.
        const activePet = getManifest(await resolveActivePetId());
        if (aiEnabled && keyAvailable) {
          const model = await getPreference('aiModel');
          const personality =
            `${await getPreference('aiPersonality')}\n\n${buildPetIdentity(activePet)}`.trim();
          const history: AiChatMessage[] = [...state.messages, userMessage]
            .slice(-CONTEXT_MESSAGES)
            .map((m) => ({ role: m.role, content: m.content }));
          reply = await sendChat(model, personality, history);
        } else {
          reply = pickPetChatFallback(activePet?.dialogue, content, Math.floor(Math.random() * 16));
        }

        // A newer send superseded this one; drop the stale reply.
        if (generation !== generationRef.current) return;

        await saveMessage(conversationId, 'assistant', reply);
        const messages = await loadMessages(conversationId);
        setState((s) => ({ ...s, messages, sending: false }));
        optionsRef.current.onAssistantReply?.();
      } catch (error) {
        if (generation !== generationRef.current) return;
        const message =
          error instanceof AiServiceError
            ? error.message
            : 'Something went wrong while sending your message.';
        logger.warn('chat', 'send failed', error instanceof Error ? error.message : error);
        setState((s) => ({ ...s, sending: false, error: message }));
      } finally {
        if (generation === generationRef.current) {
          optionsRef.current.onTalkingChange?.(false);
        }
      }
    },
    [state.messages]
  );

  const clear = useCallback(async () => {
    const conversationId = conversationRef.current;
    if (conversationId === null) return;
    try {
      await clearConversation(conversationId);
      setState((s) => ({ ...s, messages: [], error: null }));
    } catch (error) {
      logger.error('chat', 'failed to clear conversation', error);
      setState((s) => ({ ...s, error: 'Could not clear the conversation.' }));
    }
  }, []);

  return { ...state, send, clear };
}
