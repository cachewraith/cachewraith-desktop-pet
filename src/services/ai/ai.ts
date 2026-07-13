/**
 * AI service boundary. All OpenAI traffic happens on the Rust side
 * (`src-tauri/src/ai.rs`); the API key is kept in the Windows Credential
 * Manager and never enters the frontend, preferences or SQLite.
 */
import { invoke } from '@tauri-apps/api/core';

import { logger } from '../../utils/logger';

export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type AiErrorKind =
  | 'no_key'
  | 'invalid_key'
  | 'rate_limit'
  | 'network'
  | 'api'
  | 'keystore'
  | 'invalid_input'
  | 'unknown';

export class AiServiceError extends Error {
  readonly kind: AiErrorKind;

  constructor(kind: AiErrorKind, message: string) {
    super(message);
    this.name = 'AiServiceError';
    this.kind = kind;
  }
}

function toAiError(error: unknown): AiServiceError {
  if (error && typeof error === 'object' && 'kind' in error && 'message' in error) {
    const e = error as { kind: string; message: string };
    return new AiServiceError(e.kind as AiErrorKind, e.message);
  }
  logger.error('ai', 'unexpected AI service error shape');
  return new AiServiceError('unknown', 'Something went wrong while talking to the AI service.');
}

export async function setApiKey(key: string): Promise<void> {
  try {
    await invoke('ai_set_api_key', { key });
  } catch (error) {
    throw toAiError(error);
  }
}

export async function hasApiKey(): Promise<boolean> {
  try {
    return await invoke<boolean>('ai_has_api_key');
  } catch (error) {
    logger.warn('ai', 'could not check for API key');
    throw toAiError(error);
  }
}

export async function clearApiKey(): Promise<void> {
  try {
    await invoke('ai_clear_api_key');
  } catch (error) {
    throw toAiError(error);
  }
}

export async function sendChat(
  model: string,
  personality: string,
  messages: AiChatMessage[]
): Promise<string> {
  try {
    return await invoke<string>('ai_chat', { model, personality, messages });
  } catch (error) {
    throw toAiError(error);
  }
}

export async function testConnection(model: string): Promise<string> {
  try {
    return await invoke<string>('ai_test_connection', { model });
  } catch (error) {
    throw toAiError(error);
  }
}
