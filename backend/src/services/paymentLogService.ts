// ============================================================
// NEUROTEK AI — Payment Log Service
// ============================================================
import { randomUUID } from 'crypto';

export type PaymentEvent =
  | 'payment_intent_created'
  | 'payment_succeeded'
  | 'payment_failed'
  | 'subscription_created'
  | 'subscription_cancelled'
  | 'subscription_renewed'
  | 'refund_issued'
  | 'coupon_applied'
  | 'fraud_blocked';

export interface PaymentLogEntry {
  id: string;
  userId: string;
  event: PaymentEvent;
  amountCents?: number;
  currency?: string;
  paymentMethod?: 'stripe' | 'paypal';
  planId?: string;
  productId?: string;
  couponCode?: string;
  stripeIntentId?: string;
  paypalOrderId?: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
  success: boolean;
  errorMessage?: string;
}

// ── In-memory store ───────────────────────────────────────────
const logs: PaymentLogEntry[] = [];


// ── Public API ────────────────────────────────────────────────

export function log(entry: Omit<PaymentLogEntry, 'id' | 'createdAt'>): PaymentLogEntry {
  const record: PaymentLogEntry = {
    ...entry,
    id: randomUUID(),
    createdAt: Date.now(),
  };
  logs.push(record);
  return record;
}

export function getUserHistory(userId: string, limit = 50): PaymentLogEntry[] {
  return logs
    .filter((e) => e.userId === userId)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
}

export function getRecentFailures(userId: string, windowMs: number): PaymentLogEntry[] {
  const cutoff = Date.now() - windowMs;
  return logs.filter(
    (e) => e.userId === userId && !e.success && e.createdAt >= cutoff
  );
}

export function getStats(): { totalRevenue: number; successRate: number; todayRevenue: number } {
  const now = Date.now();
  const dayMs = 86_400_000;
  const todayCutoff = now - dayMs;

  const successful = logs.filter((e) => e.success && e.amountCents);
  const total = logs.length;
  const successCount = logs.filter((e) => e.success).length;

  const totalRevenue = successful.reduce((sum, e) => sum + (e.amountCents ?? 0), 0);
  const todayRevenue = successful
    .filter((e) => e.createdAt >= todayCutoff)
    .reduce((sum, e) => sum + (e.amountCents ?? 0), 0);

  return {
    totalRevenue,
    successRate: total > 0 ? Math.round((successCount / total) * 100) : 100,
    todayRevenue,
  };
}
