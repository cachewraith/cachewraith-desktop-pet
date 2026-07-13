/**
 * Typed SQLite repository for conversations and messages.
 */
import { getDb } from '../../services/database/db';

export interface ChatMessageRecord {
  id: number;
  conversationId: number;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

interface MessageRow {
  id: number;
  conversation_id: number;
  role: string;
  content: string;
  created_at: string;
}

interface ConversationRow {
  id: number;
}

/** Get the single active conversation, creating it on first use. */
export async function getOrCreateConversation(): Promise<number> {
  const db = await getDb();
  const rows = await db.select<ConversationRow[]>(
    'SELECT id FROM conversations ORDER BY id DESC LIMIT 1'
  );
  if (rows.length > 0) return rows[0].id;
  const result = await db.execute('INSERT INTO conversations (title) VALUES ($1)', [
    'Chat with CacheWraith',
  ]);
  if (result.lastInsertId === undefined) {
    throw new Error('Could not create a conversation.');
  }
  return result.lastInsertId;
}

export async function loadMessages(
  conversationId: number,
  limit = 200
): Promise<ChatMessageRecord[]> {
  const db = await getDb();
  const rows = await db.select<MessageRow[]>(
    `SELECT * FROM (
       SELECT * FROM messages WHERE conversation_id = $1 ORDER BY id DESC LIMIT $2
     ) ORDER BY id ASC`,
    [conversationId, limit]
  );
  return rows
    .filter((row) => row.role === 'user' || row.role === 'assistant')
    .map((row) => ({
      id: row.id,
      conversationId: row.conversation_id,
      role: row.role as 'user' | 'assistant',
      content: row.content,
      createdAt: row.created_at,
    }));
}

export async function saveMessage(
  conversationId: number,
  role: 'user' | 'assistant',
  content: string
): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    'INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)',
    [conversationId, role, content]
  );
  await db.execute("UPDATE conversations SET updated_at = datetime('now') WHERE id = $1", [
    conversationId,
  ]);
  return result.lastInsertId ?? -1;
}

export async function clearConversation(conversationId: number): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM messages WHERE conversation_id = $1', [conversationId]);
}

export async function clearAllChatHistory(): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM messages');
  await db.execute('DELETE FROM conversations');
}
