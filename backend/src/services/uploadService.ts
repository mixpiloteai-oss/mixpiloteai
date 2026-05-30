// ============================================================
// NEUROTEK AI — Upload Service (in-memory, mock)
// ============================================================

export interface UploadSession {
  id: string
  creatorId: string
  filename: string
  mimeType: string
  fileSize: number
  uploadedBytes: number
  status: 'pending' | 'uploading' | 'processing' | 'complete' | 'failed'
  copyrightStatus: 'checking' | 'clear' | 'flagged'
  moderationStatus: 'pending' | 'approved' | 'rejected'
  createdAt: number
}

// ── Internal state ───────────────────────────────────────────
const sessions = new Map<string, UploadSession>()
// In a real implementation, chunks would be streamed to object storage.
// Here we just track byte progress.
const chunkTracker = new Map<string, number>()  // sessionId → highest chunk index seen

const KNOWN_ARTIST_NAMES = [
  'daft punk', 'aphex twin', 'boards of canada', 'burial', 'deadmau5',
  'skrillex', 'diplo', 'flume', 'porter robinson', 'odesza',
]

const FLAGGED_KEYWORDS = ['official', 'remix', 'remaster', 'cover']

// ── Public API ───────────────────────────────────────────────
export function createUploadSession(
  creatorId: string,
  filename: string,
  mimeType: string,
  fileSize: number
): UploadSession {
  const id = `upl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const session: UploadSession = {
    id,
    creatorId,
    filename,
    mimeType,
    fileSize,
    uploadedBytes: 0,
    status: 'pending',
    copyrightStatus: 'checking',
    moderationStatus: 'pending',
    createdAt: Date.now(),
  }
  sessions.set(id, session)
  return session
}

export function receiveChunk(
  sessionId: string,
  chunkIndex: number,
  data: Buffer
): void {
  const session = sessions.get(sessionId)
  if (!session) return
  session.status = 'uploading'
  session.uploadedBytes += data.byteLength
  // Clamp to declared file size
  if (session.uploadedBytes > session.fileSize) {
    session.uploadedBytes = session.fileSize
  }
  const prev = chunkTracker.get(sessionId) ?? -1
  if (chunkIndex > prev) chunkTracker.set(sessionId, chunkIndex)
}

export function completeUpload(sessionId: string): UploadSession {
  const session = sessions.get(sessionId)
  if (!session) throw new Error(`Upload session ${sessionId} not found`)

  session.status = 'processing'
  session.uploadedBytes = session.fileSize

  const copyright = checkCopyright(session.filename)
  session.copyrightStatus = copyright.clear ? 'clear' : 'flagged'

  // Simulate async processing — resolve after 500ms
  setTimeout(() => {
    const s = sessions.get(sessionId)
    if (!s) return
    if (s.copyrightStatus === 'flagged') {
      s.status = 'failed'
      s.moderationStatus = 'rejected'
    } else {
      s.status = 'complete'
      s.moderationStatus = 'approved'
    }
  }, 500)

  return session
}

export function getUploadSession(id: string): UploadSession | null {
  return sessions.get(id) ?? null
}

export function listUploadSessionsByCreator(creatorId: string): UploadSession[] {
  return Array.from(sessions.values()).filter((s) => s.creatorId === creatorId)
}

export function checkCopyright(
  filename: string
): { clear: boolean; confidence: number; reason?: string } {
  const lower = filename.toLowerCase()

  for (const keyword of FLAGGED_KEYWORDS) {
    if (lower.includes(keyword)) {
      return {
        clear: false,
        confidence: 0.91,
        reason: `Filename contains flagged keyword: "${keyword}"`,
      }
    }
  }

  for (const artist of KNOWN_ARTIST_NAMES) {
    if (lower.includes(artist.replace(' ', '-')) || lower.includes(artist.replace(' ', '_')) || lower.includes(artist.replace(' ', ''))) {
      return {
        clear: false,
        confidence: 0.87,
        reason: `Filename contains known artist name: "${artist}"`,
      }
    }
  }

  // Random 5% flagged
  if (Math.random() < 0.05) {
    return {
      clear: false,
      confidence: 0.62,
      reason: 'Potential copyright match detected (low confidence — manual review required)',
    }
  }

  return { clear: true, confidence: 0.98 }
}
