// ============================================================
// NEUROTEK AI — Security Headers Middleware (manual, no helmet)
// ============================================================
import { Request, Response, NextFunction } from 'express';

/**
 * Sets a strict baseline of security headers for an API server.
 * No HTML is served, so the CSP is locked down to default-src 'none'.
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(self), geolocation=()'
  );
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; frame-ancestors 'none'"
  );

  // Cross-Origin isolation hardening (safe for APIs).
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');

  // HSTS only when the request is actually HTTPS.
  const xfProto = req.headers['x-forwarded-proto'];
  const isHttps =
    req.secure ||
    (typeof xfProto === 'string' && xfProto.split(',')[0]?.trim() === 'https');
  if (isHttps) {
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains'
    );
  }

  next();
}
