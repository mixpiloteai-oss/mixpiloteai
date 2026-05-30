// ─── Chunks Router ────────────────────────────────────────────────────────────
// Resumable chunked upload/download for large projects.
//
// POST   /api/chunks/session          — create or resume an upload session
// POST   /api/chunks/:sessionId/:idx  — upload a single chunk (raw binary)
// GET    /api/chunks/:sessionId/status — check upload progress
// GET    /api/chunks/:sessionId/missing — list missing chunk indexes
// GET    /api/chunks/:sessionId/assemble — assemble and return full payload
// DELETE /api/chunks/:sessionId       — discard a session

import { Router, type Request, type Response } from 'express'
import {
  createSession, receiveChunk, getMissingChunks,
  assembleSession, getSessionStatus, deleteSession,
} from '../services/chunkService'

const router = Router()

// ── Helpers ───────────────────────────────────────────────────────────────────

function ok(res: Response, data: unknown): void {
  res.status(200).json({ ok: true, ...((typeof data === 'object' && data !== null) ? data : { data }) })
}

function err(res: Response, status: number, message: string): void {
  res.status(status).json({ ok: false, error: message })
}

// ── Routes ────────────────────────────────────────────────────────────────────

// Create / resume session
router.post('/session', (req: Request, res: Response) => {
  const { sessionId, totalChunks, metadata } = req.body as {
    sessionId:   string
    totalChunks: number
    metadata?:   Record<string, string>
  }
  if (!sessionId || !totalChunks || totalChunks < 1) return err(res, 400, 'sessionId and totalChunks required')
  if (totalChunks > 2000) return err(res, 400, 'totalChunks exceeds limit (2000)')
  try {
    createSession(sessionId, totalChunks, metadata ?? {})
    const status = getSessionStatus(sessionId)
    return ok(res, { session: status })
  } catch (e) {
    return err(res, 500, String(e))
  }
})

// Upload a single chunk (binary body)
router.post('/:sessionId/:idx', (req: Request, res: Response) => {
  const { sessionId, idx } = req.params
  const index = parseInt(idx!, 10)
  if (isNaN(index)) return err(res, 400, 'Invalid chunk index')

  // Collect raw bytes
  const chunks: Buffer[] = []
  req.on('data', (chunk: Buffer) => chunks.push(chunk))
  req.on('end', () => {
    const data = Buffer.concat(chunks)
    if (!data.length) return err(res, 400, 'Empty chunk body')
    try {
      const result = receiveChunk(sessionId!, index, data)
      return ok(res, result)
    } catch (e) {
      return err(res, 400, String(e))
    }
  })
  req.on('error', () => err(res, 500, 'Stream error'))
})

// Session status
router.get('/:sessionId/status', (req: Request, res: Response) => {
  const status = getSessionStatus(req.params.sessionId!)
  if (!status) return err(res, 404, 'Session not found')
  return ok(res, { session: status })
})

// Missing chunks
router.get('/:sessionId/missing', (req: Request, res: Response) => {
  try {
    const missing = getMissingChunks(req.params.sessionId!)
    return ok(res, { missing })
  } catch (e) {
    return err(res, 404, String(e))
  }
})

// Assemble and return full payload
router.get('/:sessionId/assemble', (req: Request, res: Response) => {
  try {
    const assembled = assembleSession(req.params.sessionId!)
    deleteSession(req.params.sessionId!)
    res.setHeader('Content-Type', 'application/octet-stream')
    res.setHeader('Content-Length', assembled.length)
    res.status(200).send(assembled)
  } catch (e) {
    return err(res, 400, String(e))
  }
})

// Delete session
router.delete('/:sessionId', (req: Request, res: Response) => {
  deleteSession(req.params.sessionId!)
  return ok(res, { deleted: true })
})

export default router
