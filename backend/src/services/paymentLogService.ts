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

// ── Seed mock data for 'demo' user ───────────────────────────
function seed(): void {
  const now = Date.now();
  const day = 86_400_000;

  const mockEntries: Omit<PaymentLogEntry, 'id' | 'createdAt'>[] = [
    {
      userId: 'demo',
      event: 'subscription_created',
      amountCents: 999,
      currency: 'usd',
      paymentMethod: 'stripe',
      planId: 'pro',
      stripeIntentId: 'pi_demo_001',
      success: true,
    },
    {
      userId: 'demo',
      event: 'payment_succeeded',
      amountCents: 999,
      currency: 'usd',
      paymentMethod: 'stripe',
      planId: 'pro',
      stripeIntentId: 'pi_demo_001',
      success: true,
    },
    {
      userId: 'demo',
      event: 'subscription_renewed',
      amountCents: 999,
      currency: 'usd',
      paymentMethod: 'stripe',
      planId: 'pro',
      stripeIntentId: 'pi_demo_002',
      success: true,
    },
    {
      userId: 'demo',
      event: 'coupon_applied',
      couponCode: 'LAUNCH50',
      planId: 'pro',
      success: true,
    },
    {
      userId: 'demo',
      event: 'payment_failed',
      amountCents: 2499,
      currency: 'usd',
      paymentMethod: 'stripe',
      planId: 'studio',
      stripeIntentId: 'pi_demo_003',
      success: false,
      errorMessage: 'Card declined',
    },
    {
      userId: 'demo',
      event: 'payment_intent_created',
      amountCents: 499,
      currency: 'usd',
      paymentMethod: 'stripe',
      productId: 'credits_100',
      success: true,
    },
    {
      userId: 'demo',
      event: 'payment_succeeded',
      amountCents: 499,
      currency: 'usd',
      paymentMethod: 'stripe',
      productId: 'credits_100',
      success: true,
    },
    {
      userId: 'demo',
      event: 'refund_issued',
      amountCents: 499,
      currency: 'usd',
      paymentMethod: 'stripe',
      stripeIntentId: 'pi_demo_004',
      success: true,
    },
    {
      userId: 'demo',
      event: 'subscription_cancelled',
      planId: 'pro',
      paymentMethod: 'stripe',
      success: true,
    },
    {
      userId: 'demo',
      event: 'subscription_created',
      amountCents: 2499,
      currency: 'usd',
      paymentMethod: 'paypal',
      planId: 'studio',
      paypalOrderId: 'PAYPAL_DEMO_001',
      success: true,
    },
  ];

  mockEntries.forEach((entry, i) => {
    logs.push({
      ...entry,
      id: randomUUID(),
      createdAt: now - (10 - i) * day,
    });
  });
}

seed();

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
