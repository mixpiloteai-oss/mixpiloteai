// ============================================================
// NEUROTEK AI — Suspicious IP Activity Tracker
// ============================================================
// In-memory behavior tracker per IP. Counts auth failures, distinct
// emails, and distinct paths inside a sliding 10-minute window. When
// thresholds are exceeded the IP is quarantined for 1 hour and any
// further hits on protected entry points (mounted via blockSuspicious)
// are rejected with 429.
// ============================================================
import { Request, Response, NextFunction } from 'express';
import { logSecurityEvent } from '../utils/securityLog';

interface IPRecord {
  windowStart: number;
  authFailures: number;
  emails: Set<string>;
  paths: Set<string>;
}

interface Suspicion {
  until: number;
  reason: string;
}

const WINDOW_MS = 10 * 60 * 1000;          // 10 min sliding window
const SUSPICION_MS = 60 * 60 * 1000;       // 1 hour quarantine
const MAX_AUTH_FAILURES = 20;
const MAX_DISTINCT_EMAILS = 10;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 min cleanup

const records = new Map<string, IPRecord>();
const suspicious = new Map<string, Suspicion>();

function getClientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    const first = xff.split(',')[0];
    if (first) return first.trim();
  }
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

function getOrCreateRecord(ip: string): IPRecord {
  const now = Date.now();
  let rec = records.get(ip);
  if (!rec || now - rec.windowStart > WINDOW_MS) {
    rec = {
      windowStart: now,
      authFailures: 0,
      emails: new Set(),
      paths: new Set(),
    };
    records.set(ip, rec);
  }
  return rec;
}

function markSuspicious(ip: string, reason: string, route?: string): void {
  if (suspicious.has(ip)) return;
  suspicious.set(ip, { until: Date.now() + SUSPICION_MS, reason });
  logSecurityEvent({
    type: 'suspicious_request',
    severity: 'critical',
    ip,
    route,
    reason,
  });
}

export function isSuspicious(ip: string): boolean {
  const entry = suspicious.get(ip);
  if (!entry) return false;
  if (Date.now() > entry.until) {
    suspicious.delete(ip);
    return false;
  }
  return true;
}

/**
 * Mounted globally. Observes the final response status code and
 * increments per-IP counters. Promotes the IP to "suspicious" once
 * thresholds are crossed.
 */
export function trackResponse(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const ip = getClientIp(req);
  const path = req.path;
  const bodyEmail = (req.body as { email?: unknown } | undefined)?.email;
  const email = typeof bodyEmail === 'string' ? bodyEmail.toLowerCase() : undefined;

  res.on('finish', () => {
    const status = res.statusCode;
    const rec = getOrCreateRecord(ip);
    rec.paths.add(path);

    if (status === 401 || status === 403) {
      rec.authFailures += 1;
      if (email) rec.emails.add(email);

      if (rec.authFailures >= MAX_AUTH_FAILURES) {
        markSuspicious(
          ip,
          `Exceeded ${MAX_AUTH_FAILURES} auth failures in 10 min`,
          path
        );
      } else if (rec.emails.size >= MAX_DISTINCT_EMAILS) {
        markSuspicious(
          ip,
          `Tried ${rec.emails.size} distinct emails in 10 min`,
          path
        );
      }
    }
  });

  next();
}

/**
 * Mount this in front of high-value entry points (e.g. /api/auth,
 * /api/admin/auth) — NOT globally — to bounce known bad IPs early.
 */
export function blockSuspicious(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const ip = getClientIp(req);
  if (isSuspicious(ip)) {
    const entry = suspicious.get(ip);
    logSecurityEvent({
      type: 'rate_limited',
      severity: 'warn',
      ip,
      route: req.path,
      reason: entry?.reason ?? 'suspicious ip',
    });
    res.status(429).json({
      success: false,
      error: 'Too many suspicious requests. Try again later.',
      code: 'IP_QUARANTINED',
    });
    return;
  }
  next();
}

// Periodic cleanup of stale windows and expired quarantines.
const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of records.entries()) {
    if (now - rec.windowStart > WINDOW_MS) records.delete(ip);
  }
  for (const [ip, s] of suspicious.entries()) {
    if (now > s.until) suspicious.delete(ip);
  }
}, CLEANUP_INTERVAL_MS);

// Avoid keeping the event loop alive in test environments.
if (typeof cleanup.unref === 'function') cleanup.unref();
