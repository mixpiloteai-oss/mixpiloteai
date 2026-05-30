// ============================================================
// NEUROTEK AI — Resilience primitives
// ============================================================
// retryWithBackoff:   exponential-backoff retry with jitter and
//                     a predicate to skip "permanent" failures.
// CircuitBreaker:     open/half-open/closed states for upstream
//                     services (Stripe, PayPal). Prevents thundering
//                     herds during an outage and exposes health to
//                     the admin monitoring endpoint.
// ============================================================

import { logger } from '../utils/logger';

export interface RetryOptions {
  attempts?: number;
  baseMs?: number;
  maxMs?: number;
  jitter?: boolean;
  /** Return true to abort early (e.g. 4xx responses). */
  isPermanent?: (err: unknown) => boolean;
  label?: string;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const {
    attempts = 3,
    baseMs = 250,
    maxMs = 4000,
    jitter = true,
    isPermanent,
    label = 'op',
  } = opts;

  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (isPermanent?.(err)) throw err;
      if (i === attempts - 1) break;
      const exp = Math.min(maxMs, baseMs * 2 ** i);
      const delay = jitter ? exp / 2 + Math.random() * (exp / 2) : exp;
      logger.warn(`[retry] ${label} attempt ${i + 1}/${attempts} failed, retrying in ${Math.round(delay)}ms`, {
        error: err instanceof Error ? err.message : String(err),
      });
      await sleep(delay);
    }
  }
  throw lastErr;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Circuit breaker ─────────────────────────────────────────

export type BreakerState = 'closed' | 'open' | 'half-open';

export interface BreakerOptions {
  failureThreshold?: number;   // trips after N consecutive failures
  openMs?: number;             // how long to stay open before half-open probe
  halfOpenMax?: number;        // probes allowed in half-open
  label?: string;
}

export class CircuitBreaker {
  private state: BreakerState = 'closed';
  private failures = 0;
  private openedAt = 0;
  private halfOpenInFlight = 0;
  private readonly threshold: number;
  private readonly openMs: number;
  private readonly halfOpenMax: number;
  readonly label: string;

  constructor(opts: BreakerOptions = {}) {
    this.threshold = opts.failureThreshold ?? 5;
    this.openMs = opts.openMs ?? 30_000;
    this.halfOpenMax = opts.halfOpenMax ?? 1;
    this.label = opts.label ?? 'breaker';
  }

  async exec<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.openedAt >= this.openMs) {
        this.state = 'half-open';
        this.halfOpenInFlight = 0;
      } else {
        throw new Error(`Circuit open for ${this.label}; upstream unavailable`);
      }
    }
    if (this.state === 'half-open') {
      if (this.halfOpenInFlight >= this.halfOpenMax) {
        throw new Error(`Circuit half-open for ${this.label}; probe in flight`);
      }
      this.halfOpenInFlight++;
    }

    try {
      const out = await fn();
      this.onSuccess();
      return out;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    if (this.state !== 'closed') {
      logger.info(`[breaker] ${this.label} closed after recovery`);
    }
    this.state = 'closed';
    this.halfOpenInFlight = 0;
  }

  private onFailure(): void {
    this.failures++;
    if (this.state === 'half-open') {
      this.trip();
      return;
    }
    if (this.failures >= this.threshold) this.trip();
  }

  private trip(): void {
    this.state = 'open';
    this.openedAt = Date.now();
    logger.error(`[breaker] ${this.label} OPEN after ${this.failures} failures`);
  }

  status(): { label: string; state: BreakerState; failures: number; openedAt: number } {
    return { label: this.label, state: this.state, failures: this.failures, openedAt: this.openedAt };
  }
}

// ── Singletons used by stripe/paypal admin services ─────────

export const stripeBreaker = new CircuitBreaker({ label: 'stripe', failureThreshold: 5, openMs: 30_000 });
export const paypalBreaker = new CircuitBreaker({ label: 'paypal', failureThreshold: 5, openMs: 30_000 });

export function getBreakerStatuses() {
  return [stripeBreaker.status(), paypalBreaker.status()];
}
