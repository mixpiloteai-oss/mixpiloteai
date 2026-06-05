// ============================================================
// NEUROTEK AI — Live Activity Feed
// ============================================================
// In-memory circular buffer of recent platform events for the
// admin dashboard's live feed. Captures auth, payments, uploads,
// admin actions, and significant system events.
// ============================================================

export type ActivityType =
  | 'auth'
  | 'signup'
  | 'payment'
  | 'subscription'
  | 'upload'
  | 'ai_request'
  | 'admin_action'
  | 'error'
  | 'system';

export type ActivitySeverity = 'info' | 'success' | 'warn' | 'error';

export interface ActivityEvent {
  id:         string;
  type:       ActivityType;
  severity:   ActivitySeverity;
  message:    string;
  userId?:    string;
  email?:     string;
  ip?:        string;
  meta?:      Record<string, unknown>;
  timestamp:  number;  // ms epoch
}

const BUFFER_SIZE = 500;

class ActivityFeed {
  private buffer: ActivityEvent[] = [];
  private listeners: Array<(evt: ActivityEvent) => void> = [];

  push(evt: Omit<ActivityEvent, 'id' | 'timestamp'>): ActivityEvent {
    const full: ActivityEvent = {
      ...evt,
      id:        `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
    };

    this.buffer.push(full);
    if (this.buffer.length > BUFFER_SIZE) {
      this.buffer.shift();
    }

    // Notify subscribers (fire-and-forget)
    for (const l of this.listeners) {
      try { l(full); } catch { /* ignore */ }
    }

    return full;
  }

  /** Get most recent events (newest first). */
  recent(limit = 50, since?: number): ActivityEvent[] {
    let events = this.buffer;
    if (since !== undefined) {
      events = events.filter(e => e.timestamp > since);
    }
    return events.slice(-Math.max(1, limit)).reverse();
  }

  /** Filter events by type and/or severity. */
  filter(opts: {
    types?:     ActivityType[];
    severities?: ActivitySeverity[];
    since?:     number;
    limit?:     number;
  }): ActivityEvent[] {
    let out = this.buffer;
    if (opts.types && opts.types.length > 0) {
      out = out.filter(e => opts.types!.includes(e.type));
    }
    if (opts.severities && opts.severities.length > 0) {
      out = out.filter(e => opts.severities!.includes(e.severity));
    }
    if (opts.since !== undefined) {
      out = out.filter(e => e.timestamp > opts.since!);
    }
    return out.slice(-Math.max(1, opts.limit ?? 50)).reverse();
  }

  /** Statistics for the recent window (last N minutes). */
  stats(windowMinutes = 5): {
    total:   number;
    byType:  Record<string, number>;
    bySev:   Record<string, number>;
    errorRate: number;
  } {
    const cutoff = Date.now() - windowMinutes * 60 * 1000;
    const recent = this.buffer.filter(e => e.timestamp > cutoff);

    const byType: Record<string, number> = {};
    const bySev:  Record<string, number> = {};
    let errors = 0;

    for (const e of recent) {
      byType[e.type] = (byType[e.type] ?? 0) + 1;
      bySev[e.severity] = (bySev[e.severity] ?? 0) + 1;
      if (e.severity === 'error') errors++;
    }

    return {
      total: recent.length,
      byType,
      bySev,
      errorRate: recent.length > 0 ? (errors / recent.length) * 100 : 0,
    };
  }

  /** Subscribe to live events. Returns unsubscribe fn. */
  subscribe(listener: (evt: ActivityEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const i = this.listeners.indexOf(listener);
      if (i >= 0) this.listeners.splice(i, 1);
    };
  }

  clear(): void {
    this.buffer = [];
  }

  size(): number {
    return this.buffer.length;
  }
}

export const activityFeed = new ActivityFeed();

// Convenience wrappers ─────────────────────────────────────────────────────────

export function logActivity(
  type: ActivityType,
  message: string,
  opts: Partial<Omit<ActivityEvent, 'id' | 'timestamp' | 'type' | 'message'>> = {},
): ActivityEvent {
  return activityFeed.push({
    type,
    severity: opts.severity ?? 'info',
    message,
    userId: opts.userId,
    email: opts.email,
    ip: opts.ip,
    meta: opts.meta,
  });
}
