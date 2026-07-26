/**
 * DeepAGI Persistence System
 *
 * SQLite-based session and message storage.
 * Replaces Open-ClaudeCode's JSONL transcript system.
 * Uses better-sqlite3 for synchronous, zero-config operation.
 *
 * Note: requires 'better-sqlite3' npm package to be installed.
 * Falls back to in-memory storage if package is unavailable.
 */

let db: any = null
let useMemory = false
const memoryStore: Array<{ sessionId: string; role: string; content: string; timestamp: string }> = []

export type SessionRecord = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messageCount: number
}

export type MessageRecord = {
  id: string
  sessionId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  parentId?: string
}

/**
 * Initialize persistence layer.
 * Tries SQLite first, falls back to in-memory.
 */
export function initPersistence(dbPath?: string): boolean {
  try {
    const Database = require('better-sqlite3')
    db = new Database(dbPath ?? ':memory:')
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT 'New conversation',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
        content TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        parent_id TEXT,
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      );
      CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
    `)
    useMemory = false
    return true
  } catch {
    useMemory = true
    return false
  }
}

/**
 * Create a new session.
 */
export function createSession(title?: string): SessionRecord {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const record: SessionRecord = { id, title: title ?? 'New conversation', createdAt: now, updatedAt: now, messageCount: 0 }

  if (useMemory) {
    memoryStore.push({ sessionId: id, role: 'system', content: `session:${id}`, timestamp: now })
  } else {
    db.prepare('INSERT INTO sessions (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)').run(id, record.title, now, now)
  }
  return record
}

/**
 * List all sessions, most recent first.
 */
export function listSessions(limit = 50): SessionRecord[] {
  if (useMemory) {
    return []
  }
  return db.prepare(`
    SELECT s.id, s.title, s.created_at as createdAt, s.updated_at as updatedAt,
           (SELECT COUNT(*) FROM messages WHERE session_id = s.id) as messageCount
    FROM sessions s ORDER BY s.updated_at DESC LIMIT ?
  `).all(limit) as SessionRecord[]
}

/**
 * Append a message to a session.
 */
export function appendMessage(sessionId: string, role: string, content: string, parentId?: string): MessageRecord {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const record: MessageRecord = { id, sessionId, role: role as any, content, timestamp: now, parentId }

  if (useMemory) {
    memoryStore.push({ sessionId, role, content, timestamp: now })
  } else {
    db.prepare('INSERT INTO messages (id, session_id, role, content, timestamp, parent_id) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, sessionId, role, content, now, parentId ?? null)
    db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(now, sessionId)
  }
  return record
}

/**
 * Get messages for a session.
 */
export function getSessionMessages(sessionId: string, limit = 100): MessageRecord[] {
  if (useMemory) {
    return memoryStore
      .filter(m => m.sessionId === sessionId)
      .slice(-limit)
      .map(m => ({ id: crypto.randomUUID(), sessionId, role: m.role as any, content: m.content, timestamp: m.timestamp }))
  }
  return db.prepare(
    'SELECT id, session_id as sessionId, role, content, timestamp, parent_id as parentId FROM messages WHERE session_id = ? ORDER BY timestamp ASC LIMIT ?'
  ).all(sessionId, limit) as MessageRecord[]
}

/**
 * Delete a session and its messages.
 */
export function deleteSession(sessionId: string): boolean {
  if (useMemory) { return true }
  db.prepare('DELETE FROM messages WHERE session_id = ?').run(sessionId)
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId)
  return true
}

/**
 * Update session title.
 */
export function updateSessionTitle(sessionId: string, title: string): void {
  if (!useMemory) {
    db.prepare('UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?').run(title, new Date().toISOString(), sessionId)
  }
}
