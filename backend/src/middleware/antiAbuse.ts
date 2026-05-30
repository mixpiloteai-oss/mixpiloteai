// ============================================================
// NEUROTEK AI — Anti-Abuse Detection Middleware
// ============================================================
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

interface AbuseRecord {
  count: number;
  firstSeen: number;
  blocked: boolean;
}

const suspiciousActivity: Map<string, AbuseRecord> = new Map();

const ABUSE_WINDOW_MS   = 60 * 1000;
 const ABUSE_THRESHOLD   = 30;
const BLOCK_DURATION_MS = 15 * 60 * 1000;

function getClientKey(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  const ip =
    (Array.isArray(forwarded) ? forwarded[0] : forwarded)
      ?.split(',')[0] ??
    req.socket.remoteAddress ??
    'unknown';
  return ip.trim();
}

function isKnownAbusivePattern(body: unknown): boolean {
  if (typeof body !== 'object' || !body) return false;
  const obj = body as Record<string, unknown>;
  const msg = String(obj.message ?? '').toLowerCase();
  const injectionPatterns = [
    'ignore previous', 'ignore all instructions', 'you are now',
    'system:', 'act as', 'jailbreak', 'dan mode', 'developer mode',
    'sudo ', 'base64', 'eval(',
  ];
  return injectionPatterns.some((pattern) => msg.includes(pattern));
}

export function antiAbuse(req: Request, res: Response, next: NextFunction): void {
  const key = getClientKey(req);
  const now = Date.now();

  let record = suspiciousActivity.get(key);

  if (record && !record.blocked && now - record.firstSeen > ABUSE_WINDOW_MS) {
    suspiciousActivity.delete(key);
    record = undefined;
  }

  if (record?.blocked) {
    const elapsed = now - record.firstSeen;
    if (elapsed < BLOCK_DURATION_MS) {
      res.status(429).json({
        success: false,
        error: 'Too many requests. Please try again later.',
        code: 'RATE_LIMITED',
        retryAfter: Math.ceil((BLOCK_DURATION_MS - elapsed) / 1000),
      });
      return;
    }
    suspiciousActivity.delete(key);
  }

  if (isKnownAbusivePattern(req.body)) {
    logger.warn('[AntiAbuse] Prompt injection attempt', { ip: key });
    res.status(400).json({ success: false, error: 'Invalid request content', code: 'INVALID_CONTENT' });
    return;
  }

  const current = suspiciousActivity.get(key);
  if (!current) {
    suspiciousActivity.set(key, { count: 1, firstSeen: now, blocked: false });
  } else {
    current.count++;
    if (current.count > ABUSE_THRESHOLD) {
      current.blocked = true;
      current.firstSeen = now;
      logger.warn('[AntiAbuse] Blocking IP — abuse threshold exceeded', { ip: key, count: current.count });
      res.status(429).json({
        success: false,
        error: 'Rate limit exceeded. Your IP has been temporarily blocked.',
        code: 'ABUSE_DETECTED',
        retryAfter: BLOCK_DURATION_MS / 1000,
      });
      return;
    }
  }

  next();
}
