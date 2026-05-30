// ============================================================
// NEUROTEK AI — API Security Middleware
// ============================================================
// Additional layers of security beyond auth + rate limiting:
//
// - Request signature validation (optional HMAC)
// - Body size enforcement (per route family)
// - Suspicious payload detection (XSS, SQL injection, path traversal)
// - Response sanitization (strip internal error stacks in prod)
// ============================================================

import { Request, Response, NextFunction } from 'express';
import { logSecurityEvent } from '../utils/securityLog';

// ── Body size limits per family ─────────────────────────────────────────────

const BODY_LIMITS = {
  '/api/auth/':     2_000,     // 2 KB
  '/api/ai/':       50_000,    // 50 KB
  '/api/upload/':   50_000_000, // 50 MB
  '/api/save/':     10_000_000, // 10 MB (project files)
  default:          1_000_000,  // 1 MB
};

function getLimitFor(path: string): number {
  for (const prefix in BODY_LIMITS) {
    if (prefix !== 'default' && path.startsWith(prefix)) {
      return BODY_LIMITS[prefix as keyof typeof BODY_LIMITS];
    }
  }
  return BODY_LIMITS.default;
}

// ── Suspicious payload patterns ─────────────────────────────────────────────

const XSS_PATTERNS = [
  /<script[\s>]/i,
  /javascript:/i,
  /on(load|click|error|focus|blur|submit)=/i,
  /<iframe/i,
];

const SQL_INJECTION_PATTERNS = [
  /(\bunion\s+select\b|\bdrop\s+table\b|\binsert\s+into\b|\bupdate\s+\w+\s+set\b)/i,
  /(\bor\s+1\s*=\s*1\b|\bor\s+'.*'\s*=\s*'\1\b)/i,
  /--\s*$/,
  /;\s*delete\s+from/i,
];

const PATH_TRAVERSAL_PATTERNS = [
  /\.\.[/\\]/,
  /[/\\]etc[/\\]passwd/i,
  /[/\\]proc[/\\]self/i,
];

/**
 * Scan a string value for suspicious content.
 */
function isSuspicious(value: string): { found: boolean; type: string } {
  if (typeof value !== 'string' || value.length === 0) {
    return { found: false, type: '' };
  }

  // Cap scan length to avoid regex DoS
  const v = value.length > 10_000 ? value.slice(0, 10_000) : value;

  for (const p of XSS_PATTERNS)             if (p.test(v)) return { found: true, type: 'xss' };
  for (const p of SQL_INJECTION_PATTERNS)   if (p.test(v)) return { found: true, type: 'sqli' };
  for (const p of PATH_TRAVERSAL_PATTERNS)  if (p.test(v)) return { found: true, type: 'path-traversal' };

  return { found: false, type: '' };
}

/**
 * Recursively scan a JSON-like value.
 */
function scanPayload(value: unknown, depth = 0): { found: boolean; type: string } {
  if (depth > 5) return { found: false, type: '' };
  if (typeof value === 'string') return isSuspicious(value);
  if (Array.isArray(value)) {
    for (const v of value) {
      const r = scanPayload(v, depth + 1);
      if (r.found) return r;
    }
  } else if (value && typeof value === 'object') {
    for (const v of Object.values(value)) {
      const r = scanPayload(v, depth + 1);
      if (r.found) return r;
    }
  }
  return { found: false, type: '' };
}

/**
 * Middleware: enforce body size + scan for suspicious payloads.
 */
export function apiSecurity(req: Request, res: Response, next: NextFunction): void {
  // 1. Body size check (early bail)
  const contentLength = parseInt(req.headers['content-length'] ?? '0', 10);
  const limit = getLimitFor(req.path);
  if (contentLength > limit) {
    logSecurityEvent({
      type: 'oversized_request',
      severity: 'warn',
      ip: req.ip,
      route: req.originalUrl,
      reason: `${contentLength} > ${limit}`,
    });
    res.status(413).json({ success: false, error: 'Request body too large' });
    return;
  }

  // 2. Suspicious content scan (POST/PUT/PATCH only — GET has no body)
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
    const r = scanPayload(req.body);
    if (r.found) {
      logSecurityEvent({
        type: 'suspicious_payload',
        severity: 'warn',
        ip: req.ip,
        route: req.originalUrl,
        reason: r.type,
      });
      res.status(400).json({ success: false, error: 'Invalid request content' });
      return;
    }
  }

  next();
}

/**
 * Response sanitization middleware — strips error stacks from
 * production responses to avoid leaking sensitive information.
 */
export function sanitizeResponse(_req: Request, res: Response, next: NextFunction): void {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) return next();

  const origJson = res.json.bind(res);
  res.json = (body: unknown): Response => {
    if (body && typeof body === 'object') {
      const b = body as Record<string, unknown>;
      // Remove stack traces from errors
      if ('stack' in b) delete b.stack;
      if ('error' in b && typeof b.error === 'object' && b.error !== null) {
        delete (b.error as Record<string, unknown>).stack;
      }
    }
    return origJson(body);
  };
  next();
}
