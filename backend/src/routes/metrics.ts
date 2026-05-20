// ─── Runtime Metrics API (admin-only) ────────────────────────────────────────
import { Router, Request, Response } from 'express'
import { requireAdmin } from '../middleware/adminAuth'
import { getMetricsSummary } from '../middleware/requestMetrics'
import { ok } from '../utils/response'

const router = Router()

router.get('/', requireAdmin, (_req: Request, res: Response) => {
  res.json(ok(getMetricsSummary()))
})

export default router
