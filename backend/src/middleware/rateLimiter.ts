// ============================================================
// NEUROTEK AI — Rate Limiter Middleware
// ============================================================
import rateLimit, { Options } from 'express-rate-limit';
import { Request, Response } from 'express';
import { AuthenticatedRequest } from './auth';
import { logSecurityEvent } from '../utils/securityLog';

// Per-plan AI rate limits (requests per minute)
const planLimits: Record<string, number> = {
  free: Number(process.env.RATE_LIMIT_MAX_FREE ?? 5),
  pro: Number(process.env.RATE_LIMIT_MAX_PRO ?? 30),
  studio: Number(process.env.RATE_LIMIT_MAX_STUDIO ?? 100),
};

function userOrIpKey(req: Request): string {
  return (req as AuthenticatedRequest).user?.id ?? req.ip ?? 'unknown';
}

function rateLimitedHandler(
  req: Request,
  res: Response,
  _next: unknown,
  options: Options
): void {
  logSecurityEvent({
    type: 'rate_limited',
    severity: 'warn',
    ip: req.ip,
    userId: (req as AuthenticatedRequest).user?.id,
    route: req.originalUrl,
    reason: `Limit ${options.max} exceeded`,
  });
  res.status(options.statusCode).json(options.message);
}

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
  handler: rateLimitedHandler,
});

// Auth brute-force protection
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many auth attempts. Try again later.', code: 'AUTH_RATE_LIMITED' },
  handler: rateLimitedHandler,
});

// General mutation rate limit — applied globally in index.ts.
export const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip ?? 'unknown',
  message: { success: false, error: 'Too many requests. Slow down.', code: 'RATE_LIMITED' },
  handler: rateLimitedHandler,
});

// Payments — strict, by user-or-IP.
export const paymentsRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  message: { success: false, error: 'Too many payment attempts. Slow down.', code: 'PAYMENTS_RATE_LIMITED' },
  handler: rateLimitedHandler,
});

// Marketplace — by user-or-IP.
export const marketplaceRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  message: { success: false, error: 'Too many marketplace requests. Slow down.', code: 'MARKETPLACE_RATE_LIMITED' },
  handler: rateLimitedHandler,
});

// Uploads — long window.
export const uploadRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  message: { success: false, error: 'Too many uploads this hour. Try again later.', code: 'UPLOAD_RATE_LIMITED' },
  handler: rateLimitedHandler,
});
