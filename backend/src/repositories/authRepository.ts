// ============================================================
// NEUROTEK AI — Auth Repository
// PostgreSQL-backed storage for:
//   - Password reset tokens
//   - Email verification tokens
//   - User sessions (multi-device)
// In-memory fallback when Supabase not configured.
// ============================================================

import crypto from 'crypto';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { logger } from '../utils/logger';

// ── Helpers ───────────────────────────────────────────────────

/** Hash a plaintext token for safe DB storage */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** Generate 32-byte URL-safe hex token (256 bits entropy) */
export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// ── In-memory fallbacks ───────────────────────────────────────

interface ResetTokenRecord {
  id: string;
  userId: string;
  email: string;
  tokenHash: string;
  expiresAt: number;
  used: boolean;
  usedAt?: number;
  ipAddress?: string;
  createdAt: number;
}

interface VerifyTokenRecord {
  id: string;
  userId: string;
  email: string;
  tokenHash: string;
  expiresAt: number;
  used: boolean;
  usedAt?: number;
  createdAt: number;
}

export interface SessionRecord {
  id: string;
  userId: string;
  refreshTokenHash: string;
  familyId: string;
  deviceName?: string;
  deviceType: 'browser' | 'mobile' | 'desktop' | 'api';
  ipAddress?: string;
  userAgent?: string;
  lastSeenAt: number;
  createdAt: number;
  expiresAt: number;
  revoked: boolean;
  revokedAt?: number;
  revokedReason?: string;
}

const _resetTokens: ResetTokenRecord[]  = [];
const _verifyTokens: VerifyTokenRecord[] = [];
const _sessions: SessionRecord[]         = [];

// ── Password Reset Token Repository ──────────────────────────

export const passwordResetRepository = {
  /** Create a new password reset token (hash stored, plaintext returned to caller for email) */
  async create(userId: string, email: string, ipAddress?: string): Promise<string> {
    const token = generateSecureToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    if (isSupabaseConfigured && supabase) {
      const insertResult = supabase.from('password_reset_tokens').insert({
        user_id:    userId,
        email:      email.toLowerCase().trim(),
        token_hash: tokenHash,
        expires_at: expiresAt.toISOString(),
        ip_address: ipAddress ?? null,
      });
      await Promise.resolve(insertResult).catch((e: Error) => {
        logger.error('[authRepo] prt insert failed', { error: e.message });
      });
    } else {
      _resetTokens.push({
        id: crypto.randomUUID(),
        userId,
        email: email.toLowerCase().trim(),
        tokenHash,
        expiresAt: expiresAt.getTime(),
        used: false,
        ipAddress,
        createdAt: Date.now(),
      });
      // Keep last 500 in memory
      if (_resetTokens.length > 500) _resetTokens.splice(0, _resetTokens.length - 500);
    }

    return token; // plaintext — send in email URL
  },

  /** Find a valid (unexpired, unused) reset token record by plaintext token */
  async findValid(token: string): Promise<ResetTokenRecord | null> {
    const tokenHash = hashToken(token);
    const now = new Date().toISOString();

    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase
        .from('password_reset_tokens')
        .select('*')
        .eq('token_hash', tokenHash)
        .eq('used', false)
        .gt('expires_at', now)
        .maybeSingle();
      if (!data) return null;
      return {
        id: data.id,
        userId: data.user_id,
        email: data.email,
        tokenHash: data.token_hash,
        expiresAt: new Date(data.expires_at).getTime(),
        used: data.used,
        ipAddress: data.ip_address ?? undefined,
        createdAt: new Date(data.created_at).getTime(),
      };
    }

    const record = _resetTokens.find(r =>
      r.tokenHash === tokenHash &&
      !r.used &&
      r.expiresAt > Date.now()
    );
    return record ?? null;
  },

  /** Mark a token as used (one-time use) */
  async markUsed(tokenHash: string): Promise<void> {
    const now = new Date().toISOString();
    if (isSupabaseConfigured && supabase) {
      void supabase
        .from('password_reset_tokens')
        .update({ used: true, used_at: now })
        .eq('token_hash', tokenHash);
    } else {
      const record = _resetTokens.find(r => r.tokenHash === tokenHash);
      if (record) { record.used = true; record.usedAt = Date.now(); }
    }
  },

  /** Count valid (unused, unexpired) tokens for an email in the last hour */
  async countRecentForEmail(email: string, windowMs = 60 * 60 * 1000): Promise<number> {
    const cutoff = new Date(Date.now() - windowMs).toISOString();
    if (isSupabaseConfigured && supabase) {
      const { count } = await (supabase
        .from('password_reset_tokens')
        .select('*', { count: 'exact', head: true })
        .eq('email', email.toLowerCase().trim())
        .eq('used', false)
        .gt('created_at', cutoff) as any);
      return (count as number) ?? 0;
    }
    const cutoffMs = Date.now() - windowMs;
    return _resetTokens.filter(r =>
      r.email === email.toLowerCase().trim() &&
      !r.used &&
      r.createdAt > cutoffMs
    ).length;
  },
};

// ── Email Verification Token Repository ──────────────────────

export const emailVerificationRepository = {
  /** Create a new email verification token */
  async create(userId: string, email: string): Promise<string> {
    const token = generateSecureToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    if (isSupabaseConfigured && supabase) {
      // Invalidate previous tokens for this user
      void supabase.from('email_verification_tokens')
        .update({ used: true, used_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('used', false);

      const evtResult = supabase.from('email_verification_tokens').insert({
        user_id:    userId,
        email:      email.toLowerCase().trim(),
        token_hash: tokenHash,
        expires_at: expiresAt.toISOString(),
      });
      await Promise.resolve(evtResult).catch((e: Error) => {
        logger.error('[authRepo] evt insert failed', { error: e.message });
      });
    } else {
      // Invalidate previous in-memory tokens
      _verifyTokens.filter(r => r.userId === userId && !r.used)
        .forEach(r => { r.used = true; });

      _verifyTokens.push({
        id: crypto.randomUUID(),
        userId,
        email: email.toLowerCase().trim(),
        tokenHash,
        expiresAt: expiresAt.getTime(),
        used: false,
        createdAt: Date.now(),
      });
      if (_verifyTokens.length > 500) _verifyTokens.splice(0, _verifyTokens.length - 500);
    }

    return token;
  },

  /** Find a valid verification token */
  async findValid(token: string): Promise<VerifyTokenRecord | null> {
    const tokenHash = hashToken(token);
    const now = new Date().toISOString();

    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase
        .from('email_verification_tokens')
        .select('*')
        .eq('token_hash', tokenHash)
        .eq('used', false)
        .gt('expires_at', now)
        .maybeSingle();
      if (!data) return null;
      return {
        id: data.id,
        userId: data.user_id,
        email: data.email,
        tokenHash: data.token_hash,
        expiresAt: new Date(data.expires_at).getTime(),
        used: data.used,
        createdAt: new Date(data.created_at).getTime(),
      };
    }

    const record = _verifyTokens.find(r =>
      r.tokenHash === tokenHash &&
      !r.used &&
      r.expiresAt > Date.now()
    );
    return record ?? null;
  },

  /** Mark a verification token as used */
  async markUsed(tokenHash: string): Promise<void> {
    const now = new Date().toISOString();
    if (isSupabaseConfigured && supabase) {
      void supabase.from('email_verification_tokens')
        .update({ used: true, used_at: now })
        .eq('token_hash', tokenHash);
    } else {
      const record = _verifyTokens.find(r => r.tokenHash === tokenHash);
      if (record) { record.used = true; record.usedAt = Date.now(); }
    }
  },

  /** Count recent verification sends for an email (flood protection) */
  async countRecentForUser(userId: string, windowMs = 60 * 60 * 1000): Promise<number> {
    const cutoff = new Date(Date.now() - windowMs).toISOString();
    if (isSupabaseConfigured && supabase) {
      const { count } = await (supabase
        .from('email_verification_tokens')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gt('created_at', cutoff) as any);
      return (count as number) ?? 0;
    }
    const cutoffMs = Date.now() - windowMs;
    return _verifyTokens.filter(r => r.userId === userId && r.createdAt > cutoffMs).length;
  },
};

// ── Session Repository (multi-device) ────────────────────────

export const sessionRepository = {
  /** Create a new session (call after login / token rotation) */
  async create(params: {
    userId: string;
    refreshTokenHash: string;
    familyId: string;
    deviceName?: string;
    deviceType?: 'browser' | 'mobile' | 'desktop' | 'api';
    ipAddress?: string;
    userAgent?: string;
    expiresAt: Date;
  }): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    if (isSupabaseConfigured && supabase) {
      const sessionResult = supabase.from('user_sessions').insert({
        id,
        user_id:             params.userId,
        refresh_token_hash:  params.refreshTokenHash,
        family_id:           params.familyId,
        device_name:         params.deviceName ?? null,
        device_type:         params.deviceType ?? 'browser',
        ip_address:          params.ipAddress ?? null,
        user_agent:          params.userAgent ?? null,
        last_seen_at:        now,
        created_at:          now,
        expires_at:          params.expiresAt.toISOString(),
        revoked:             false,
      });
      await Promise.resolve(sessionResult).catch((e: Error) => {
        logger.error('[authRepo] session insert failed', { error: e.message });
      });
    } else {
      _sessions.push({
        id,
        userId:            params.userId,
        refreshTokenHash:  params.refreshTokenHash,
        familyId:          params.familyId,
        deviceName:        params.deviceName,
        deviceType:        params.deviceType ?? 'browser',
        ipAddress:         params.ipAddress,
        userAgent:         params.userAgent,
        lastSeenAt:        Date.now(),
        createdAt:         Date.now(),
        expiresAt:         params.expiresAt.getTime(),
        revoked:           false,
      });
      if (_sessions.length > 2000) _sessions.splice(0, _sessions.length - 2000);
    }

    return id;
  },

  /** Find session by refresh token hash */
  async findByTokenHash(hash: string): Promise<SessionRecord | null> {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('refresh_token_hash', hash)
        .eq('revoked', false)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();
      if (!data) return null;
      return mapDbSession(data);
    }
    const s = _sessions.find(s =>
      s.refreshTokenHash === hash &&
      !s.revoked &&
      s.expiresAt > Date.now()
    );
    return s ?? null;
  },

  /** Find all active sessions for a user */
  async findByUser(userId: string): Promise<SessionRecord[]> {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('revoked', false)
        .gt('expires_at', new Date().toISOString())
        .order('last_seen_at', { ascending: false });
      return (data ?? []).map(mapDbSession);
    }
    const now = Date.now();
    return _sessions.filter(s =>
      s.userId === userId &&
      !s.revoked &&
      s.expiresAt > now
    ).sort((a, b) => b.lastSeenAt - a.lastSeenAt);
  },

  /** Find all sessions in the same family (for theft detection) */
  async findByFamily(familyId: string): Promise<SessionRecord[]> {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('family_id', familyId)
        .eq('revoked', false);
      return (data ?? []).map(mapDbSession);
    }
    return _sessions.filter(s => s.familyId === familyId && !s.revoked);
  },

  /** Revoke a specific session by ID */
  async revokeById(id: string, reason = 'logout'): Promise<void> {
    const now = new Date().toISOString();
    if (isSupabaseConfigured && supabase) {
      void supabase.from('user_sessions')
        .update({ revoked: true, revoked_at: now, revoked_reason: reason })
        .eq('id', id);
    } else {
      const s = _sessions.find(s => s.id === id);
      if (s) { s.revoked = true; s.revokedAt = Date.now(); s.revokedReason = reason; }
    }
  },

  /** Revoke a session by refresh token hash */
  async revokeByTokenHash(hash: string, reason = 'logout'): Promise<void> {
    const now = new Date().toISOString();
    if (isSupabaseConfigured && supabase) {
      void supabase.from('user_sessions')
        .update({ revoked: true, revoked_at: now, revoked_reason: reason })
        .eq('refresh_token_hash', hash);
    } else {
      const s = _sessions.find(s => s.refreshTokenHash === hash);
      if (s) { s.revoked = true; s.revokedAt = Date.now(); s.revokedReason = reason; }
    }
  },

  /** Revoke all sessions for a user (logout-all) */
  async revokeAll(userId: string, reason = 'logout-all'): Promise<number> {
    const now = new Date().toISOString();
    if (isSupabaseConfigured && supabase) {
      const { count } = await (supabase
        .from('user_sessions')
        .update({ revoked: true, revoked_at: now, revoked_reason: reason })
        .eq('user_id', userId)
        .eq('revoked', false) as any);
      return (count as number) ?? 0;
    }
    let count = 0;
    _sessions.filter(s => s.userId === userId && !s.revoked).forEach(s => {
      s.revoked = true; s.revokedAt = Date.now(); s.revokedReason = reason;
      count++;
    });
    return count;
  },

  /** Revoke all sessions in a family (token theft response) */
  async revokeFamily(familyId: string): Promise<void> {
    const now = new Date().toISOString();
    if (isSupabaseConfigured && supabase) {
      void supabase.from('user_sessions')
        .update({ revoked: true, revoked_at: now, revoked_reason: 'theft' })
        .eq('family_id', familyId);
    } else {
      _sessions.filter(s => s.familyId === familyId).forEach(s => {
        s.revoked = true; s.revokedAt = Date.now(); s.revokedReason = 'theft';
      });
    }
  },

  /** Update last_seen_at for a session */
  async touch(hash: string): Promise<void> {
    const now = new Date().toISOString();
    if (isSupabaseConfigured && supabase) {
      void supabase.from('user_sessions')
        .update({ last_seen_at: now })
        .eq('refresh_token_hash', hash);
    } else {
      const s = _sessions.find(s => s.refreshTokenHash === hash);
      if (s) s.lastSeenAt = Date.now();
    }
  },
};

// ── DB row → SessionRecord mapper ─────────────────────────────
function mapDbSession(data: Record<string, unknown>): SessionRecord {
  return {
    id:               data.id as string,
    userId:           data.user_id as string,
    refreshTokenHash: data.refresh_token_hash as string,
    familyId:         data.family_id as string,
    deviceName:       (data.device_name as string | null) ?? undefined,
    deviceType:       (data.device_type as SessionRecord['deviceType']) ?? 'browser',
    ipAddress:        (data.ip_address as string | null) ?? undefined,
    userAgent:        (data.user_agent as string | null) ?? undefined,
    lastSeenAt:       new Date(data.last_seen_at as string).getTime(),
    createdAt:        new Date(data.created_at as string).getTime(),
    expiresAt:        new Date(data.expires_at as string).getTime(),
    revoked:          data.revoked as boolean,
    revokedAt:        data.revoked_at ? new Date(data.revoked_at as string).getTime() : undefined,
    revokedReason:    (data.revoked_reason as string | null) ?? undefined,
  };
}
