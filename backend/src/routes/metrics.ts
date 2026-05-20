// ─── Runtime Metrics API (admin-only) ────────────────────────────────────────
import { Router, Request, Response, NextFunction } from 'express'
import { requireAdmin, AdminRequest } from '../middleware/adminAuth'
import { getMetricsSummary } from '../middleware/requestMetrics'
import { ok } from '../utils/response'

const router = Router()

function asAdmin(req: Request): AdminRequest {
  return req as AdminRequest
}

// Wrap requireAdmin to handle the AdminRequest cast
function adminGuard(req: Request, res: Response, next: NextFunction): void {
  requireAdmin(asAdmin(req), res, next)
}

router.get('/', adminGuard, (_req: Request, res: Response) => {
  res.json(ok(getMetricsSummary()))
})

export default router
