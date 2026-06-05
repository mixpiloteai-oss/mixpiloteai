// ─── Cloud Sync Routes ────────────────────────────────────────────────────────
import { Router } from 'express'
import { cloudSyncService } from '../services/cloudSyncService'
import { requireAuth } from '../middleware/auth'
import type { AuthenticatedRequest } from '../middleware/auth'
import type { Response, NextFunction } from 'express'

const router = Router()

// POST /push/:projectId — push a new version (may conflict)
router.post(
  '/push/:projectId',
  requireAuth,
  (req: AuthenticatedRequest, res: Response, _next: NextFunction): void => {
    const { projectId } = req.params as { projectId: string }
    const body = req.body as {
      data: unknown
      baseVersion: number
      label?: string
      force?: boolean
    }

    const { data, baseVersion, label, force } = body

    if (baseVersion === undefined || baseVersion === null) {
      res.status(400).json({ success: false, error: 'baseVersion is required' })
      return
    }

    let result
    if (force === true) {
      result = cloudSyncService.forcePush(projectId, data, label)
    } else {
      result = cloudSyncService.push(projectId, data, baseVersion, label)
    }

    if (!result.ok) {
      if ('conflict' in result) {
        res.status(409).json({ success: false, conflict: result.conflict })
        return
      }
      res.status(500).json({ success: false, error: result.error })
      return
    }

    res.status(200).json({ success: true, data: result.version })
  },
)

// GET /pull/:projectId — get latest version
router.get(
  '/pull/:projectId',
  requireAuth,
  (req: AuthenticatedRequest, res: Response, _next: NextFunction): void => {
    const { projectId } = req.params as { projectId: string }
    const { version } = cloudSyncService.pull(projectId)
    res.status(200).json({ success: true, data: version })
  },
)

// GET /versions/:projectId — list all versions
router.get(
  '/versions/:projectId',
  requireAuth,
  (req: AuthenticatedRequest, res: Response, _next: NextFunction): void => {
    const { projectId } = req.params as { projectId: string }
    const versions = cloudSyncService.listVersions(projectId)
    res.status(200).json({ success: true, data: versions })
  },
)

export default router
