// ─── Client-side Error Collection ────────────────────────────────────────────
// Accepts error reports from the website's unhandledError listeners.
// Stores in Supabase if configured, otherwise just logs them.
// No auth required (errors happen before/outside auth contexts).

import { Router, Request, Response } from 'express'
import { logger } from '../utils/logger'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { generalRateLimiter } from '../middleware/rateLimiter'

const router = Router()

interface ErrorReport {
  message: string
  stack?:  string
  url?:    string
  ua?:     string
  ts?:     number
  kind?:   string
}

router.post('/report', generalRateLimiter, (req: Request, res: Response) => {
  const body = req.body as ErrorReport
  if (!body || typeof body.message !== 'string') {
    res.status(400).json({ ok: false })
    return
  }

  const report = {
    message:      String(body.message).slice(0, 1000),
    stack:        typeof body.stack  === 'string' ? body.stack.slice(0, 3000)  : null,
    url:          typeof body.url    === 'string' ? body.url.slice(0, 500)     : null,
    ua:           typeof body.ua     === 'string' ? body.ua.slice(0, 300)      : null,
    kind:         typeof body.kind   === 'string' ? body.kind.slice(0, 50)     : 'uncaught',
    ts:           typeof body.ts     === 'number' ? body.ts                    : Date.now(),
    ip:           req.ip ?? null,
    reported_at:  new Date().toISOString(),
  }

  // Log at warn level — these are client JS errors, not server failures
  logger.warn('client error reported', {
    message: report.message,
    kind:    report.kind,
    url:     report.url,
  })

  // Fire-and-forget to Supabase if configured
  if (isSupabaseConfigured && supabase) {
    Promise.resolve(supabase.from('client_errors').insert([report]))
      .then(({ error }) => {
        if (error) logger.warn('client_errors insert failed', { error: error.message })
      })
      .catch(() => { /* ignore */ })
  }

  res.status(202).json({ ok: true })
})

export default router
