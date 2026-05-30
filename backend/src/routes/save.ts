// ─── Save / Versioning / Recovery Routes ─────────────────────────────────────
import { Router, Request, Response } from 'express'
import { saveService } from '../services/saveService'
import { requireAuth } from '../middleware/auth'

const router = Router()

// POST /api/save/:projectId/versions  — create new version
router.post('/:projectId/versions', requireAuth, (req: Request, res: Response) => {
  const { projectId } = req.params
  const { label = 'Manual save', data, type = 'manual' } = req.body
  if (!data) return res.status(400).json({ success: false, error: 'data is required' })
  const meta = saveService.createVersion(projectId, String(label), data, type)
  return res.status(201).json({ success: true, data: meta })
})

// GET /api/save/:projectId/versions  — list all versions (no data payload)
router.get('/:projectId/versions', (req: Request, res: Response) => {
  const { projectId } = req.params
  return res.json({ success: true, data: saveService.listVersions(projectId) })
})

// GET /api/save/:projectId/versions/:versionId  — full version including data
router.get('/:projectId/versions/:versionId', (req: Request, res: Response) => {
  const { projectId, versionId } = req.params
  const version = saveService.getVersion(projectId, versionId)
  if (!version) return res.status(404).json({ success: false, error: 'Version not found' })
  return res.json({ success: true, data: version })
})

// DELETE /api/save/:projectId/versions/:versionId
router.delete('/:projectId/versions/:versionId', requireAuth, (req: Request, res: Response) => {
  const { projectId, versionId } = req.params
  if (!saveService.deleteVersion(projectId, versionId)) {
    return res.status(404).json({ success: false, error: 'Version not found' })
  }
  return res.json({ success: true })
})

// POST /api/save/:projectId/versions/:versionId/restore
// Returns the full version data so the client can apply it
router.post('/:projectId/versions/:versionId/restore', requireAuth, (req: Request, res: Response) => {
  const { projectId, versionId } = req.params
  const version = saveService.getVersion(projectId, versionId)
  if (!version) return res.status(404).json({ success: false, error: 'Version not found' })
  // Snapshot a backup of current state sent in body before restore
  if (req.body.currentData) {
    saveService.createVersion(projectId, 'Pre-restore backup', req.body.currentData, 'pre-action')
  }
  return res.json({ success: true, data: version })
})

// POST /api/save/validate  — validate project data integrity
router.post('/validate', requireAuth, (req: Request, res: Response) => {
  const result = saveService.validateData(req.body.data)
  return res.json({ success: true, data: result })
})

export default router
