// ─── In-memory request metrics ───────────────────────────────────────────────
// Tracks total requests, 5xx error count, and response times for
// P50/P95/P99 percentiles. Exposed via /health/detailed and /api/metrics.
// Uses a sliding window (ring buffer) of the last 1000 response times.

interface Metrics {
  startedAt:     number    // process start timestamp (ms)
  totalRequests: number
  errorRequests: number    // 5xx count
  responseTimes: number[]  // ring buffer — last 1000 values in ms
  rtIndex:       number    // current ring position
}

const RING_SIZE = 1000

export const metrics: Metrics = {
  startedAt:     Date.now(),
  totalRequests: 0,
  errorRequests: 0,
  responseTimes: new Array<number>(RING_SIZE).fill(0),
  rtIndex:       0,
}

function recordResponseTime(ms: number): void {
  metrics.responseTimes[metrics.rtIndex % RING_SIZE] = ms
  metrics.rtIndex++
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}

export function getMetricsSummary() {
  const filled = metrics.responseTimes.slice(0, Math.min(metrics.rtIndex, RING_SIZE))
  const sorted = [...filled].sort((a, b) => a - b)
  const uptimeSec = Math.floor((Date.now() - metrics.startedAt) / 1000)

  return {
    uptimeSeconds:  uptimeSec,
    totalRequests:  metrics.totalRequests,
    errorRate:      metrics.totalRequests > 0
      ? (metrics.errorRequests / metrics.totalRequests * 100).toFixed(2) + '%'
      : '0.00%',
    responseTime: {
      p50:     percentile(sorted, 50),
      p95:     percentile(sorted, 95),
      p99:     percentile(sorted, 99),
      samples: filled.length,
    },
    memory:      process.memoryUsage(),
    nodeVersion: process.version,
  }
}

import { Request, Response, NextFunction } from 'express'

export function requestMetrics(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now()
  metrics.totalRequests++

  res.on('finish', () => {
    const ms = Date.now() - start
    recordResponseTime(ms)
    if (res.statusCode >= 500) metrics.errorRequests++
  })

  next()
}
