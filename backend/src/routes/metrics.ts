// ─── Runtime Metrics API ─────────────────────────────────────────────────────
// GET /api/metrics          — JSON metrics (admin-protected)
// GET /api/metrics/prometheus — Prometheus text format (admin-protected)
import { Router, Request, Response, NextFunction } from 'express'
import os from 'node:os'
import { requireAdmin, AdminRequest } from '../middleware/adminAuth'
import { getMetricsSummary, metrics } from '../middleware/requestMetrics'
import { ok } from '../utils/response'

const router = Router()

function asAdmin(req: Request): AdminRequest {
  return req as AdminRequest
}

function adminGuard(req: Request, res: Response, next: NextFunction): void {
  requireAdmin(asAdmin(req), res, next)
}

// ── JSON metrics (existing) ───────────────────────────────────
router.get('/', adminGuard, (_req: Request, res: Response) => {
  res.json(ok(getMetricsSummary()))
})

// ── Prometheus text format ────────────────────────────────────
// Compatible with Prometheus scrape / Grafana Prometheus datasource.
// Scrape interval: 15s recommended.
router.get('/prometheus', adminGuard, (_req: Request, res: Response) => {
  const summary = getMetricsSummary()
  const mem = process.memoryUsage()
  const totalMem = os.totalmem()
  const freeMem = os.freemem()

  const lines: string[] = [
    '# HELP neurotek_uptime_seconds Server uptime in seconds',
    '# TYPE neurotek_uptime_seconds gauge',
    `neurotek_uptime_seconds ${summary.uptimeSeconds}`,

    '# HELP neurotek_requests_total Total HTTP requests',
    '# TYPE neurotek_requests_total counter',
    `neurotek_requests_total ${metrics.totalRequests}`,

    '# HELP neurotek_errors_total Total 5xx errors',
    '# TYPE neurotek_errors_total counter',
    `neurotek_errors_total ${metrics.errorRequests}`,

    '# HELP neurotek_response_time_p50_ms Median response time in ms',
    '# TYPE neurotek_response_time_p50_ms gauge',
    `neurotek_response_time_p50_ms ${summary.responseTime.p50}`,

    '# HELP neurotek_response_time_p95_ms P95 response time in ms',
    '# TYPE neurotek_response_time_p95_ms gauge',
    `neurotek_response_time_p95_ms ${summary.responseTime.p95}`,

    '# HELP neurotek_response_time_p99_ms P99 response time in ms',
    '# TYPE neurotek_response_time_p99_ms gauge',
    `neurotek_response_time_p99_ms ${summary.responseTime.p99}`,

    '# HELP neurotek_heap_used_bytes Node.js heap used',
    '# TYPE neurotek_heap_used_bytes gauge',
    `neurotek_heap_used_bytes ${mem.heapUsed}`,

    '# HELP neurotek_heap_total_bytes Node.js heap total',
    '# TYPE neurotek_heap_total_bytes gauge',
    `neurotek_heap_total_bytes ${mem.heapTotal}`,

    '# HELP neurotek_rss_bytes Resident set size',
    '# TYPE neurotek_rss_bytes gauge',
    `neurotek_rss_bytes ${mem.rss}`,

    '# HELP neurotek_system_memory_total_bytes Total system RAM',
    '# TYPE neurotek_system_memory_total_bytes gauge',
    `neurotek_system_memory_total_bytes ${totalMem}`,

    '# HELP neurotek_system_memory_free_bytes Free system RAM',
    '# TYPE neurotek_system_memory_free_bytes gauge',
    `neurotek_system_memory_free_bytes ${freeMem}`,

    '',
  ]

  res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  res.send(lines.join('\n'))
})

export default router
