// ============================================================
// NEUROTEK AI — Structured Audit Log Service
// ============================================================
// Immutable audit trail for security-relevant actions.
// Entries are written to stdout (structured JSON) and optionally
// persisted to Supabase's audit_logs table.
// ============================================================
import { supabase, isSupabaseConfigured } from '../lib/db';

export type AuditAction =
  // Auth
  | 'user.login'        | 'user.logout'      | 'user.register'
  | 'user.password_reset_requested' | 'user.password_reset_completed'
  | 'user.email_verified'
  // Admin
  | 'admin.login'       | 'admin.logout'
  | 'admin.user.ban'    | 'admin.user.unban'  | 'admin.user.delete'
  | 'admin.plan.change' | 'admin.coupon.create' | 'admin.coupon.delete'
  | 'admin.settings.change'
  // Payments
  | 'payment.initiated' | 'payment.completed' | 'payment.failed'
  | 'payment.refunded'  | 'subscription.created' | 'subscription.cancelled'
  // Content
  | 'upload.started'    | 'upload.completed'  | 'upload.rejected'
  | 'project.created'   | 'project.deleted'   | 'project.exported'
  // Security
  | 'security.ip_blocked'    | 'security.token_revoked'
  | 'security.session_evicted' | 'security.anomaly_detected';

export interface AuditEntry {
  action: AuditAction;
  actorId?: string;       // user or admin who performed the action
  actorEmail?: string;
  actorRole?: string;
  targetId?: string;      // resource being acted upon
  targetType?: string;    // 'user' | 'project' | 'payment' | ...
  ip?: string;
  userAgent?: string;
  outcome: 'success' | 'failure' | 'blocked';
  reason?: string;
  meta?: Record<string, unknown>;
}

interface StoredAuditEntry extends AuditEntry {
  id: string;
  timestamp: string;
}

// In-memory ring buffer for recent audit entries (last 1000)
const MAX_RING_SIZE = 1000;
const auditRing: StoredAuditEntry[] = [];
let ringIndex = 0;

function generateId(): string {
  return `aud-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function writeAuditLog(entry: AuditEntry): StoredAuditEntry {
  const stored: StoredAuditEntry = {
    ...entry,
    id: generateId(),
    timestamp: new Date().toISOString(),
  };

  // Write to stdout as structured JSON (picked up by log aggregators)
  const log: Record<string, unknown> = {
    level: 'audit',
    ...stored,
  };
  // Remove undefined fields
  for (const k of Object.keys(log)) {
    if (log[k] === undefined) delete log[k];
  }
  process.stdout.write(JSON.stringify(log) + '\n');

  // Store in ring buffer
  auditRing[ringIndex % MAX_RING_SIZE] = stored;
  ringIndex++;

  // Async persistence to Supabase (fire-and-forget)
  if (isSupabaseConfigured && supabase) {
    const row: Record<string, unknown> = {
      action:       stored.action,
      actor_id:     stored.actorId ?? null,
      actor_email:  stored.actorEmail ?? null,
      actor_role:   stored.actorRole ?? null,
      target_id:    stored.targetId ?? null,
      target_type:  stored.targetType ?? null,
      ip:           stored.ip ?? null,
      user_agent:   stored.userAgent ?? null,
      outcome:      stored.outcome,
      reason:       stored.reason ?? null,
      meta:         stored.meta ?? null,
      created_at:   stored.timestamp,
    };
    Promise.resolve(
      supabase.from('audit_logs').insert(row)
    ).catch(() => { /* fire-and-forget */ });
  }

  return stored;
}

export function getRecentAuditLogs(limit = 100): StoredAuditEntry[] {
  const size = Math.min(ringIndex, MAX_RING_SIZE);
  const start = ringIndex > MAX_RING_SIZE ? ringIndex % MAX_RING_SIZE : 0;
  const result: StoredAuditEntry[] = [];
  for (let i = 0; i < size; i++) {
    const entry = auditRing[(start + i) % MAX_RING_SIZE];
    if (entry) result.push(entry);
  }
  return result.slice(-limit).reverse(); // most recent first
}

export function filterAuditLogs(opts: {
  actorId?: string;
  action?: AuditAction;
  outcome?: 'success' | 'failure' | 'blocked';
  since?: Date;
  limit?: number;
}): StoredAuditEntry[] {
  const all = getRecentAuditLogs(MAX_RING_SIZE);
  return all
    .filter(e => {
      if (opts.actorId && e.actorId !== opts.actorId) return false;
      if (opts.action && e.action !== opts.action) return false;
      if (opts.outcome && e.outcome !== opts.outcome) return false;
      if (opts.since && new Date(e.timestamp) < opts.since) return false;
      return true;
    })
    .slice(0, opts.limit ?? 100);
}
