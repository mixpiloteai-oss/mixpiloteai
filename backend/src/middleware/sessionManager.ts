// ============================================================
// NEUROTEK AI — Session / Device Manager
// ============================================================
// Tracks active sessions per user. Enforces concurrent session limits.
// Provides device fingerprinting and session revocation.
// ============================================================
import { Request, Response, NextFunction } from 'express';
import { createHash } from 'node:crypto';
import { logSecurityEvent } from '../utils/securityLog';
import { AuthenticatedRequest } from './auth';

interface SessionEntry {
  userId: string;
  deviceId: string;
  userAgent: string;
  ip: string;
  createdAt: number;
  lastSeenAt: number;
}

// In-memory session store (replace with Redis/Supabase in production)
const activeSessions = new Map<string, SessionEntry>(); // sessionKey → entry
const userSessions = new Map<string, Set<string>>();     // userId → Set<sessionKey>

const MAX_SESSIONS_FREE   = 2;
const MAX_SESSIONS_PRO    = 5;
const MAX_SESSIONS_STUDIO = 10;
const SESSION_TTL_MS      = 24 * 60 * 60 * 1000; // 24h

function getPlanLimit(plan: string): number {
  if (plan === 'studio') return MAX_SESSIONS_STUDIO;
  if (plan === 'pro')    return MAX_SESSIONS_PRO;
  return MAX_SESSIONS_FREE;
}

function makeDeviceId(req: Request): string {
  const ua = req.headers['user-agent'] ?? 'unknown';
  const ip = req.ip ?? 'unknown';
  const accept = req.headers['accept-language'] ?? '';
  return createHash('sha256').update(`${ua}:${ip}:${accept}`).digest('hex').slice(0, 16);
}

function makeSessionKey(userId: string, deviceId: string): string {
  return `${userId}:${deviceId}`;
}

function cleanupStaleSessions(): void {
  const now = Date.now();
  for (const [key, session] of activeSessions.entries()) {
    if (now - session.lastSeenAt > SESSION_TTL_MS) {
      activeSessions.delete(key);
      const userSet = userSessions.get(session.userId);
      if (userSet) {
        userSet.delete(key);
        if (userSet.size === 0) userSessions.delete(session.userId);
      }
    }
  }
}

// Cleanup every 30 minutes; unref() to not block process exit.
const _cleanupTimer = setInterval(cleanupStaleSessions, 30 * 60 * 1000);
if (typeof _cleanupTimer.unref === 'function') _cleanupTimer.unref();

export function registerSession(userId: string, plan: string, req: Request): {
  accepted: boolean;
  evicted?: string;
  sessionKey: string;
} {
  cleanupStaleSessions();

  const deviceId = makeDeviceId(req);
  const sessionKey = makeSessionKey(userId, deviceId);
  const limit = getPlanLimit(plan);

  let userSet = userSessions.get(userId);
  if (!userSet) {
    userSet = new Set();
    userSessions.set(userId, userSet);
  }

  // If this exact session already exists, just refresh it
  if (userSet.has(sessionKey)) {
    const existing = activeSessions.get(sessionKey);
    if (existing) existing.lastSeenAt = Date.now();
    return { accepted: true, sessionKey };
  }

  // Check limit
  if (userSet.size >= limit) {
    // Evict oldest session
    let oldestKey = '';
    let oldestTime = Infinity;
    for (const k of userSet) {
      const s = activeSessions.get(k);
      if (s && s.lastSeenAt < oldestTime) {
        oldestTime = s.lastSeenAt;
        oldestKey = k;
      }
    }
    if (oldestKey) {
      activeSessions.delete(oldestKey);
      userSet.delete(oldestKey);
      logSecurityEvent({
        type: 'auth_success',
        severity: 'info',
        userId,
        ip: req.ip,
        reason: `Evicted oldest session (limit ${limit} reached)`,
      });
    }
  }

  // Register new session
  activeSessions.set(sessionKey, {
    userId,
    deviceId,
    userAgent: req.headers['user-agent'] ?? '',
    ip: req.ip ?? '',
    createdAt: Date.now(),
    lastSeenAt: Date.now(),
  });
  userSet.add(sessionKey);

  return { accepted: true, sessionKey };
}

export function revokeSession(userId: string, sessionKey: string): boolean {
  const userSet = userSessions.get(userId);
  if (!userSet?.has(sessionKey)) return false;
  activeSessions.delete(sessionKey);
  userSet.delete(sessionKey);
  if (userSet.size === 0) userSessions.delete(userId);
  return true;
}

export function revokeAllUserSessions(userId: string): number {
  const userSet = userSessions.get(userId);
  if (!userSet) return 0;
  const count = userSet.size;
  for (const key of userSet) activeSessions.delete(key);
  userSessions.delete(userId);
  return count;
}

export function getActiveSessions(userId: string): SessionEntry[] {
  const userSet = userSessions.get(userId);
  if (!userSet) return [];
  return [...userSet].map(k => activeSessions.get(k)).filter(Boolean) as SessionEntry[];
}

export function getSessionStats(): { totalSessions: number; totalUsers: number } {
  return { totalSessions: activeSessions.size, totalUsers: userSessions.size };
}

/**
 * Middleware: refresh session heartbeat on every authenticated request.
 * Mount after requireAuth.
 */
export function sessionHeartbeat(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const user = (req as AuthenticatedRequest).user;
  if (!user?.id) { next(); return; }

  const deviceId = makeDeviceId(req);
  const sessionKey = makeSessionKey(user.id, deviceId);
  const session = activeSessions.get(sessionKey);
  if (session) session.lastSeenAt = Date.now();

  next();
}
