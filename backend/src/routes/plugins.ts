// ============================================================
// NEUROTEK AI — Plugin Telemetry Routes
// ============================================================
import { Router, Request, Response } from 'express'
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth'
import { pluginRateLimiter } from '../middleware/rateLimiter'
import { validate } from '../utils/validate'
import { ok, fail, HTTP } from '../utils/response'
import { logger } from '../utils/logger'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

const router = Router()

interface CrashReportBody {
  pluginName: string
  pluginPath?: string
  message: string
  stack?: string
  appVersion?: string
  platform?: string
}

// POST /api/plugins/crash-report
router.post(
  '/crash-report',
  requireAuth,
  pluginRateLimiter,
  (req: Request, res: Response) => {
    if (!validate(req, res, {
      pluginName: { required: true, type: 'string', min: 1, max: 200 },
      pluginPath: { type: 'string', max: 1024 },
      message:    { required: true, type: 'string', min: 1, max: 4000 },
      stack:      { type: 'string', max: 16000 },
      appVersion: { type: 'string', max: 64 },
      platform:   { type: 'string', max: 64 },
    })) return

    const body = req.body as CrashReportBody
    const userId = (req as AuthenticatedRequest).user?.id ?? null

    const payload = {
      userId,
      pluginName: body.pluginName,
      pluginPath: body.pluginPath ?? null,
      message: body.message,
      stack: body.stack ?? null,
      appVersion: body.appVersion ?? null,
      platform: body.platform ?? null,
    }

    logger.warn('plugin.crash', payload as unknown as Record<string, unknown>)

    if (isSupabaseConfigured && supabase) {
      try {
        const p = supabase
          .from('plugin_crashes')
          .insert({
            user_id: userId,
            plugin_name: body.pluginName,
            plugin_path: body.pluginPath ?? null,
            message: body.message,
            stack: body.stack ?? null,
            app_version: body.appVersion ?? null,
            platform: body.platform ?? null,
          }) as unknown as Promise<unknown>
        Promise.resolve(p).then(() => undefined, () => undefined)
      } catch {
        // never let telemetry take down the request
      }
    }

    res.status(HTTP.CREATED).json(ok({ received: true }))
  }
)

interface CrashRow {
  plugin_name: string
  created_at: string
}

interface BlacklistEntry {
  name: string
  crashes: number
  lastCrashAt: string
}

// GET /api/plugins/blacklist
router.get(
  '/blacklist',
  requireAuth,
  async (_req: Request, res: Response) => {
    if (!isSupabaseConfigured || !supabase) {
      return res.json(ok<BlacklistEntry[]>([]))
    }

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    try {
      const query = supabase
        .from('plugin_crashes')
        .select('plugin_name, created_at')
        .gte('created_at', since) as unknown as Promise<{
          data: CrashRow[] | null
          error: { message: string } | null
        }>
      const { data, error } = await query
      if (error) {
        return res.status(HTTP.SERVER_ERROR).json(fail(error.message))
      }
      const rows = data ?? []
      const agg = new Map<string, { crashes: number; lastCrashAt: string }>()
      for (const row of rows) {
        const cur = agg.get(row.plugin_name)
        if (!cur) {
          agg.set(row.plugin_name, { crashes: 1, lastCrashAt: row.created_at })
        } else {
          cur.crashes += 1
          if (row.created_at > cur.lastCrashAt) cur.lastCrashAt = row.created_at
        }
      }
      const result: BlacklistEntry[] = Array.from(agg.entries())
        .filter(([, v]) => v.crashes >= 3)
        .map(([name, v]) => ({ name, crashes: v.crashes, lastCrashAt: v.lastCrashAt }))
        .sort((a, b) => b.crashes - a.crashes)
      res.json(ok(result))
    } catch (err) {
      res.status(HTTP.SERVER_ERROR).json(fail((err as Error).message))
    }
  }
)

export default router
