// ============================================================
// NEUROTEK AI — Security Event Logger
// ============================================================
import { logger } from './logger';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export type SecurityEventType =
  | 'auth_failure'
  | 'auth_success'
  | 'admin_login'
  | 'rate_limited'
  | 'forbidden'
  | 'invalid_token'
  | 'suspicious_request'
  | 'payment_attempt'
  | 'file_rejected'
  | 'cors_blocked'
  | 'account_locked'
  | 'logout'
  | 'logout_all'
  | 'oversized_request'
  | 'suspicious_payload';

export type SecuritySeverity = 'info' | 'warn' | 'critical';

export interface SecurityEvent {
  type: SecurityEventType;
  severity: SecuritySeverity;
  ip?: string | undefined;
  userId?: string | undefined;
  email?: string | undefined;
  route?: string | undefined;
  reason?: string | undefined;
  meta?: Record<string, unknown> | undefined;
}

/**
 * Logs a security event via the structured logger and, when Supabase is
 * configured, asynchronously persists it to the `security_events` table.
 * The Supabase write is fire-and-forget — failures are swallowed so that
 * a logging path never blocks or crashes a request.
 */
export function logSecurityEvent(event: SecurityEvent): void {
  const payload: Record<string, unknown> = {
    type: event.type,
    severity: event.severity,
  };
  if (event.ip !== undefined) payload['ip'] = event.ip;
  if (event.userId !== undefined) payload['userId'] = event.userId;
  if (event.email !== undefined) payload['email'] = event.email;
  if (event.route !== undefined) payload['route'] = event.route;
  if (event.reason !== undefined) payload['reason'] = event.reason;
  if (event.meta !== undefined) payload['meta'] = event.meta;

  // Always log via structured logger (stderr for warn/critical).
  if (event.severity === 'critical') {
    logger.error('security.event', payload);
  } else if (event.severity === 'warn') {
    logger.warn('security.event', payload);
  } else {
    logger.info('security.event', payload);
  }

  // Optionally persist to Supabase (fire-and-forget).
  if (isSupabaseConfigured && supabase) {
    try {
      const p = supabase
        .from('security_events')
        .insert({
          type: event.type,
          severity: event.severity,
          ip: event.ip ?? null,
          user_id: event.userId ?? null,
          email: event.email ?? null,
          route: event.route ?? null,
          reason: event.reason ?? null,
          meta: event.meta ?? null,
        }) as unknown as Promise<unknown>;
      Promise.resolve(p).then(() => undefined, () => undefined);
    } catch {
      // never let logging take down a request
    }
  }
}
