// ============================================================
// NEUROTEK AI — Admin Realtime Endpoints
// ============================================================
// Live server health, activity feed, error logs, and stats.
// All endpoints require admin authentication.
// ============================================================

import { Router, Request, Response } from 'express';
import os from 'os';
import { requireAdmin, AdminRequest } from '../middleware/adminAuth';
import { activityFeed, ActivityType, ActivitySeverity } from '../lib/activityFeed';
import { getMetricsSummary } from '../middleware/requestMetrics';
import { logger } from '../utils/logger';
import { getStats as getAuthThrottleStats } from '../lib/authThrottle';

const router = Router();

// All routes are admin-protected
router.use(requireAdmin as unknown as (req: Request, res: Response, next: () => void) => void);

// ── GET /api/admin/realtime/health ──────────────────────────────────────────
// Server system health (CPU, memory, uptime, load).

router.get('/health', (_req: Request, res: Response) => {
  const mem = process.memoryUsage();
  const cpus = os.cpus();
  const loadAvg = os.loadavg();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const metricsSummary = getMetricsSummary();

  res.json({
    success: true,
    data: {
      timestamp: Date.now(),
      uptime: {
        process: Math.floor(process.uptime()),
        system:  Math.floor(os.uptime()),
      },
      process: {
        pid:     process.pid,
        version: process.version,
        platform: process.platform,
        arch:    process.arch,
        memory: {
          rssMB:        Math.round(mem.rss / 1024 / 1024),
          heapUsedMB:   Math.round(mem.heapUsed / 1024 / 1024),
          heapTotalMB:  Math.round(mem.heapTotal / 1024 / 1024),
          externalMB:   Math.round(mem.external / 1024 / 1024),
        },
      },
      system: {
        hostname: os.hostname(),
        cpus:     cpus.length,
        model:    cpus[0]?.model ?? 'unknown',
        load: {
          avg1m:  +loadAvg[0].toFixed(2),
          avg5m:  +loadAvg[1].toFixed(2),
          avg15m: +loadAvg[2].toFixed(2),
        },
        memory: {
          totalMB: Math.round(totalMem / 1024 / 1024),
          freeMB:  Math.round(freeMem / 1024 / 1024),
          usedPct: +(((totalMem - freeMem) / totalMem) * 100).toFixed(1),
        },
      },
      requests: metricsSummary,
      authThrottle: getAuthThrottleStats(),
    },
  });
});

// ── GET /api/admin/realtime/activity ────────────────────────────────────────
// Recent activity feed events.

router.get('/activity', (req: Request, res: Response) => {
  const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 200);
  const since = req.query.since ? parseInt(String(req.query.since), 10) : undefined;

  const types = typeof req.query.type === 'string'
    ? (req.query.type.split(',') as ActivityType[])
    : undefined;

  const severities = typeof req.query.severity === 'string'
    ? (req.query.severity.split(',') as ActivitySeverity[])
    : undefined;

  const events = types || severities
    ? activityFeed.filter({ types, severities, since, limit })
    : activityFeed.recent(limit, since);

  res.json({ success: true, data: { events, total: activityFeed.size() } });
});

// ── GET /api/admin/realtime/activity/stats ──────────────────────────────────
// Activity statistics over time window.

router.get('/activity/stats', (req: Request, res: Response) => {
  const window = Math.max(1, Math.min(60, parseInt(String(req.query.window ?? '5'), 10) || 5));
  res.json({ success: true, data: activityFeed.stats(window) });
});

// ── GET /api/admin/realtime/errors ──────────────────────────────────────────
// Recent error-level events (auth failures, suspicious requests, etc.).

router.get('/errors', (req: Request, res: Response) => {
  const limit = Math.min(parseInt(String(req.query.limit ?? '100'), 10) || 100, 500);
  const events = activityFeed.filter({
    severities: ['error', 'warn'],
    limit,
  });
  res.json({ success: true, data: { events, total: events.length } });
});

// ── GET /api/admin/realtime/stream ──────────────────────────────────────────
// Server-Sent Events stream of live activity.

router.get('/stream', (req: Request, res: Response) => {
  const aReq = req as AdminRequest;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  logger.info('admin realtime stream connected', { adminEmail: aReq.adminEmail });

  // Initial snapshot
  res.write(`event: snapshot\ndata: ${JSON.stringify(activityFeed.recent(30))}\n\n`);

  // Heartbeat every 20s to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(`: heartbeat ${Date.now()}\n\n`);
  }, 20_000);

  // Subscribe to events
  const unsubscribe = activityFeed.subscribe((evt) => {
    try {
      res.write(`event: activity\ndata: ${JSON.stringify(evt)}\n\n`);
    } catch {
      /* connection closed */
    }
  });

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
    logger.info('admin realtime stream disconnected', { adminEmail: aReq.adminEmail });
  });
});

// ── POST /api/admin/realtime/test-event ─────────────────────────────────────
// Generate a test event (admin-only, for development).

router.post('/test-event', (req: Request, res: Response) => {
  const aReq = req as AdminRequest;
  const evt = activityFeed.push({
    type:     'admin_action',
    severity: 'info',
    message:  'Test event from admin dashboard',
    email:    aReq.adminEmail,
    meta:     { source: 'test' },
  });
  res.json({ success: true, data: evt });
});

export default router;
