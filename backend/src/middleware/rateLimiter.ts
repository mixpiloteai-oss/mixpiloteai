// ============================================================
// NEUROTEK AI — Rate Limiter Middleware
// ============================================================
import rateLimit from 'express-rate-limit';
import { AuthenticatedRequest } from './auth';

// Per-plan AI rate limits (requests per minute)
const planLimits: Record<string, number> = {
  free: Number(process.env.RATE_LIMIT_MAX_FREE ?? 5),
  pro: Number(process.env.RATE_LIMIT_MAX_PRO ?? 30),
  studio: Number(process.env.RATE_LIMIT_MAX_STUDIO ?? 100),
};

export const aiRateLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
  max: (req) => {
    const plan = (req as AuthenticatedRequest).user?.plan ?? 'free';
    return planLimits[plan] ?? planLimits.free;
  },
  keyGenerator: (req) => (req as AuthenticatedRequest).user?.id ?? req.ip ?? 'unknown',
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Rate limit exceeded. Slow down.', code: 'RATE_LIMITED' },
});

// Auth brute-force protection
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many auth attempts. Try again later.', code: 'AUTH_RATE_LIMITED' },
});
