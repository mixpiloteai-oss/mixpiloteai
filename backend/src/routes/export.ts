// ─── Export Routes ────────────────────────────────────────────────────────────
// REST endpoints for export job tracking and history sync.
// Desktop offline export is client-side; these routes handle audit + history.

import { Router, Request, Response } from 'express'
import {
  createExportJob,
  updateExportJob,
  getExportJob,
  listExportJobs,
  deleteExportJob,
  type ExportFormat,
} from '../services/exportService'
import { requireAuth, AuthenticatedRequest } from '../middleware/auth'
import { requirePlan } from '../middleware/requirePlan'

const router = Router()

// Use a simple userId placeholder — replace with real auth middleware
function getUserId(req: Request): string {
  const authed = (req as AuthenticatedRequest).user?.id
  if (authed) return authed
  return (req.headers['x-user-id'] as string) ?? 'anonymous'
}

// POST /api/export/jobs — register a new export job (pro+ only)
router.post('/jobs', requireAuth, requirePlan('pro'), (req: Request, res: Response) => {
  const { projectId, projectName, format, preset } = req.body
  if (!projectId || !format || !preset) {
    return res.status(400).json({ success: false, error: 'projectId, format and preset are required' })
  }
  const validFormats: ExportFormat[] = ['wav', 'mp3', 'flac']
  if (!validFormats.includes(format)) {
    return res.status(400).json({ success: false, error: `format must be one of: ${validFormats.join(', ')}` })
  }
  const job = createExportJob(
    getUserId(req),
    projectId,
    projectName ?? 'Untitled',
    format as ExportFormat,
    preset,
  )
  res.status(201).json({ success: true, data: job })
})

// PATCH /api/export/jobs/:id — update job result (called after client-side render completes)
router.patch('/jobs/:id', requireAuth, (req: Request, res: Response) => {
  const { status, sizeMB, lufs, truePeakDB, renderMs, gpuUsed, errorMsg } = req.body
  const job = updateExportJob(req.params.id!, { status, sizeMB, lufs, truePeakDB, renderMs, gpuUsed, errorMsg })
  if (!job) return res.status(404).json({ success: false, error: 'Job not found' })
  res.json({ success: true, data: job })
})

// GET /api/export/jobs/:id — get job status
router.get('/jobs/:id', (req: Request, res: Response) => {
  const job = getExportJob(req.params.id!)
  if (!job) return res.status(404).json({ success: false, error: 'Job not found' })
  res.json({ success: true, data: job })
})

// GET /api/export/jobs — list user's export history
router.get('/jobs', (req: Request, res: Response) => {
  const jobs = listExportJobs(getUserId(req))
  res.json({ success: true, data: jobs, count: jobs.length })
})

// DELETE /api/export/jobs/:id
router.delete('/jobs/:id', requireAuth, (req: Request, res: Response) => {
  const ok = deleteExportJob(req.params.id!, getUserId(req))
  if (!ok) return res.status(404).json({ success: false, error: 'Job not found' })
  res.json({ success: true })
})

export default router
