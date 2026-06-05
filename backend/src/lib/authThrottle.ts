// ============================================================
// NEUROTEK AI — Per-Account Auth Throttling
// ============================================================
// Prevents brute-force attacks targeted at a specific account.
// Complements the IP-based rate limiter (authRateLimiter) which
// only stops attackers coming from a single IP.
//
// Strategy: track failed attempts per email address with sliding
// window. Lock out account after N failures within the window.
// ============================================================

interface AttemptRecord {
  failures:    number;
  firstAt:     number;
  lockedUntil: number;
}

const records = new Map<string, AttemptRecord>();

const MAX_FAILURES = 8;
const WINDOW_MS    = 15 * 60 * 1000;  // 15 minutes
const LOCK_MS      = 30 * 60 * 1000;  // 30 minutes

// Cleanup expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [email, r] of records) {
    if (r.lockedUntil > 0 && now > r.lockedUntil) {
      records.delete(email);
    } else if (now - r.firstAt > WINDOW_MS && r.lockedUntil === 0) {
      records.delete(email);
    }
  }
}, 5 * 60 * 1000).unref?.();

export interface ThrottleStatus {
  locked:             boolean;
  remainingAttempts:  number;
  lockedUntilMs:      number;
}

function key(email: string): string {
  return email.trim().toLowerCase();
}

export function checkAccountLock(email: string): ThrottleStatus {
  const r = records.get(key(email));
  if (!r) {
    return { locked: false, remainingAttempts: MAX_FAILURES, lockedUntilMs: 0 };
  }

  const now = Date.now();
  if (r.lockedUntil > 0 && now < r.lockedUntil) {
    return { locked: true, remainingAttempts: 0, lockedUntilMs: r.lockedUntil };
  }

  // Lock expired
  if (r.lockedUntil > 0 && now >= r.lockedUntil) {
    records.delete(key(email));
    return { locked: false, remainingAttempts: MAX_FAILURES, lockedUntilMs: 0 };
  }

  // Window expired
  if (now - r.firstAt > WINDOW_MS) {
    records.delete(key(email));
    return { locked: false, remainingAttempts: MAX_FAILURES, lockedUntilMs: 0 };
  }

  return {
    locked: false,
    remainingAttempts: Math.max(0, MAX_FAILURES - r.failures),
    lockedUntilMs: 0,
  };
}

export function recordFailure(email: string): ThrottleStatus {
  const k = key(email);
  const now = Date.now();
  let r = records.get(k);

  if (!r || now - r.firstAt > WINDOW_MS) {
    r = { failures: 0, firstAt: now, lockedUntil: 0 };
  }

  r.failures++;

  if (r.failures >= MAX_FAILURES) {
    r.lockedUntil = now + LOCK_MS;
    records.set(k, r);
    return { locked: true, remainingAttempts: 0, lockedUntilMs: r.lockedUntil };
  }

  records.set(k, r);
  return {
    locked: false,
    remainingAttempts: MAX_FAILURES - r.failures,
    lockedUntilMs: 0,
  };
}

export function recordSuccess(email: string): void {
  records.delete(key(email));
}

/**
 * Stats for monitoring (admin endpoints).
 */
export function getStats(): { tracked: number; locked: number } {
  let locked = 0;
  const now = Date.now();
  for (const r of records.values()) {
    if (r.lockedUntil > 0 && now < r.lockedUntil) locked++;
  }
  return { tracked: records.size, locked };
}
