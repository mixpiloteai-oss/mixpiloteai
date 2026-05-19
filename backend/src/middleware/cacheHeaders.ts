import { Request, Response, NextFunction } from 'express'

// ─── Cache-Control middleware for offline-first clients ────────────────────────
// Safe GET-only caching; mutations are never cached.

const CACHE_RULES: { pattern: RegExp; directive: string }[] = [
  { pattern: /^\/api\/packs/,      directive: 'public, max-age=300, stale-while-revalidate=3600' },
  { pattern: /^\/api\/templates/,  directive: 'public, max-age=120, stale-while-revalidate=600'  },
  { pattern: /^\/api\/subscriptions\/plans/, directive: 'public, max-age=3600' },
  { pattern: /^\/health/,          directive: 'no-store' },
  { pattern: /^\/api\/ai/,         directive: 'no-store' },
  { pattern: /^\/api\/sync/,       directive: 'no-store' },
  { pattern: /^\/api\/auth/,       directive: 'no-store' },
]

export function cacheHeaders(req: Request, res: Response, next: NextFunction): void {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Cache-Control', 'no-store')
    next()
    return
  }

  let directive = 'private, no-cache'  // safe default
  for (const rule of CACHE_RULES) {
    if (rule.pattern.test(req.path)) {
      directive = rule.directive
      break
    }
  }

  res.setHeader('Cache-Control', directive)
  res.setHeader('Vary', 'Authorization')
  next()
}
