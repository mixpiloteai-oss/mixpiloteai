// ─── Chunk Service ────────────────────────────────────────────────────────────
// Handles chunked upload/download of large project files.
// Large projects are split into 512 KB chunks on the client and reassembled
// here. Supports resumable uploads — already-received chunks are acknowledged.

const CHUNK_SIZE_MAX = 512 * 1024  // 512 KB

interface ChunkSession {
  sessionId:  string
  totalChunks: number
  received:   Set<number>
  chunks:     Map<number, Buffer>
  metadata:   Record<string, string>
  createdAt:  number
  updatedAt:  number
}

// In-memory store; in production this would use Redis or S3.
const sessions = new Map<string, ChunkSession>()

// Evict sessions older than 2 hours
const SESSION_TTL_MS = 2 * 60 * 60 * 1000

function evictStaleSessions(): void {
  const cutoff = Date.now() - SESSION_TTL_MS
  for (const [id, session] of sessions) {
    if (session.createdAt < cutoff) sessions.delete(id)
  }
}

setInterval(evictStaleSessions, 5 * 60 * 1000)

// ── API ───────────────────────────────────────────────────────────────────────

export function createSession(
  sessionId:    string,
  totalChunks:  number,
  metadata:     Record<string, string> = {},
): void {
  if (sessions.has(sessionId)) return  // resume existing session
  sessions.set(sessionId, {
    sessionId, totalChunks,
    received: new Set(), chunks: new Map(),
    metadata, createdAt: Date.now(), updatedAt: Date.now(),
  })
}

export function receiveChunk(
  sessionId: string,
  index:     number,
  data:      Buffer,
): { received: number; total: number; complete: boolean } {
  const session = sessions.get(sessionId)
  if (!session) throw new Error(`Unknown session: ${sessionId}`)
  if (index < 0 || index >= session.totalChunks) throw new Error(`Invalid chunk index: ${index}`)
  if (data.length > CHUNK_SIZE_MAX) throw new Error('Chunk exceeds 512 KB limit')

  session.chunks.set(index, data)
  session.received.add(index)
  session.updatedAt = Date.now()

  const complete = session.received.size === session.totalChunks
  return { received: session.received.size, total: session.totalChunks, complete }
}

export function getMissingChunks(sessionId: string): number[] {
  const session = sessions.get(sessionId)
  if (!session) throw new Error(`Unknown session: ${sessionId}`)
  const missing: number[] = []
  for (let i = 0; i < session.totalChunks; i++) {
    if (!session.received.has(i)) missing.push(i)
  }
  return missing
}

export function assembleSession(sessionId: string): Buffer {
  const session = sessions.get(sessionId)
  if (!session) throw new Error(`Unknown session: ${sessionId}`)

  const missing = getMissingChunks(sessionId)
  if (missing.length > 0) throw new Error(`Missing chunks: ${missing.join(',')}`)

  const parts: Buffer[] = []
  for (let i = 0; i < session.totalChunks; i++) {
    parts.push(session.chunks.get(i)!)
  }
  return Buffer.concat(parts)
}

export function getSessionStatus(sessionId: string): {
  sessionId: string; totalChunks: number; receivedChunks: number; complete: boolean
} | null {
  const s = sessions.get(sessionId)
  if (!s) return null
  return {
    sessionId: s.sessionId,
    totalChunks: s.totalChunks,
    receivedChunks: s.received.size,
    complete: s.received.size === s.totalChunks,
  }
}

export function deleteSession(sessionId: string): void {
  sessions.delete(sessionId)
}

/** Split a Buffer into 512 KB chunks for client-side use. */
export function splitIntoChunks(data: Buffer): Buffer[] {
  const chunks: Buffer[] = []
  for (let i = 0; i < data.length; i += CHUNK_SIZE_MAX) {
    chunks.push(data.subarray(i, i + CHUNK_SIZE_MAX))
  }
  return chunks
}
