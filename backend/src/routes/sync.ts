// ─── Deferred Sync Endpoint ────────────────────────────────────────────────────
// Accepts a batch of operations that were queued offline and replays them.
// POST /api/sync   { operations: SyncOperation[] }
//
// Idempotency: clients include a stable operation id; duplicate ids are skipped.

import { Router, Request, Response } from 'express'
import { db }          from '../data/mockDB'
import { saveService } from '../services/saveService'

const router = Router()

// ─── Types ────────────────────────────────────────────────────────────────────

type SyncMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE'

interface SyncOperation {
  id:        string       // client-generated uuid
  type:      string       // semantic operation type
  method:    SyncMethod
  url:       string       // original path, e.g. /api/projects/abc
  payload:   unknown
  timestamp: number
}

interface SyncResult {
  operationId: string
  success:     boolean
  error?:      string
  data?:       unknown
}

// ─── Seen IDs (in-memory dedup cache — resets on server restart) ─────────────
const seenIds = new Set<string>()
const SEEN_MAX = 50_000

// ─── Route ────────────────────────────────────────────────────────────────────

router.post('/', async (req: Request, res: Response) => {
  const { operations } = req.body as { operations?: SyncOperation[] }

  if (!Array.isArray(operations)) {
    return res.status(400).json({ success: false, error: 'operations must be an array' })
  }

  if (operations.length > 200) {
    return res.status(400).json({ success: false, error: 'max 200 operations per sync batch' })
  }

  const results: SyncResult[] = []

  for (const op of operations) {
    if (!op.id || !op.url || !op.method) {
      results.push({ operationId: op.id ?? '?', success: false, error: 'malformed operation' })
      continue
    }

    // Idempotency check
    if (seenIds.has(op.id)) {
      results.push({ operationId: op.id, success: true, data: { deduplicated: true } })
      continue
    }

    try {
      const result = await dispatch(op)
      results.push({ operationId: op.id, success: true, data: result })
      seenIds.add(op.id)
      if (seenIds.size > SEEN_MAX) {
        // Evict oldest entries — Set preserves insertion order
        const first = seenIds.values().next().value
        if (first) seenIds.delete(first)
      }
    } catch (err) {
      results.push({
        operationId: op.id,
        success:     false,
        error:       err instanceof Error ? err.message : 'dispatch error',
      })
    }
  }

  const processed = results.filter(r => r.success).length
  const failed    = results.filter(r => !r.success)

  return res.json({ success: true, data: { processed, total: operations.length, results, failed } })
})

// ─── Operation dispatcher ─────────────────────────────────────────────────────

async function dispatch(op: SyncOperation): Promise<unknown> {
  const segments = op.url.replace(/^\/api\//, '').split('/').filter(Boolean)
  const [resource, id, sub, subId] = segments

  // ── Projects ───────────────────────────────────────────────────────────────
  if (resource === 'projects') {
    if (op.method === 'POST' && !id) {
      const p = op.payload as Record<string, unknown>
      return db.createProject({
        name:        String(p.name        ?? 'Offline Project'),
        genre:       String(p.genre       ?? 'unknown'),
        bpm:         Number(p.bpm         ?? 140),
        key:         String(p.key         ?? 'C'),
        mood:        String(p.mood        ?? 'neutral'),
        tracks:      (p.tracks as [])     ?? [],
        duration:    Number(p.duration    ?? 0),
        isStarred:   Boolean(p.isStarred  ?? false),
        coverColor:  String(p.coverColor  ?? '#7c3aed'),
        tags:        (p.tags as string[]) ?? [],
        userId:      String(p.userId      ?? ''),
      })
    }
    if (op.method === 'PATCH' && id) {
      const updated = db.updateProject(id, op.payload as Record<string, unknown>)
      if (!updated) throw new Error(`Project ${id} not found`)
      return updated
    }
    if (op.method === 'DELETE' && id) {
      db.deleteProject(id)
      return { deleted: id }
    }
    // Save version
    if (op.method === 'POST' && id && sub === 'versions') {
      const p = op.payload as Record<string, unknown>
      return saveService.createVersion(id, String(p.label ?? 'Offline save'), p.data, 'auto')
    }
    if (op.method === 'DELETE' && id && sub === 'versions' && subId) {
      saveService.deleteVersion(id, subId)
      return { deleted: subId }
    }
  }

  throw new Error(`Unsupported operation: ${op.method} ${op.url}`)
}

// ─── Health / status endpoint ──────────────────────────────────────────────────
// GET /api/sync/status — lets clients check what the server considers pending
router.get('/status', (_req: Request, res: Response) => {
  res.json({ success: true, data: { seenCount: seenIds.size, ready: true } })
})

export default router
