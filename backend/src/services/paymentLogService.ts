// ============================================================
// NEUROTEK AI — Payment Log Service (PostgreSQL-backed)
// Persists all payment events to the payment_events table.
// Falls back to in-memory when DB not configured (tests / dev).
// ============================================================
import { isSupabaseConfigured } from '../lib/supabase'
import { paymentEventRepository } from '../repositories/billingRepository'

export type PaymentEvent =
  | 'payment_intent_created'
  | 'payment_succeeded'
  | 'payment_failed'
  | 'subscription_created'
  | 'subscription_cancelled'
  | 'subscription_renewed'
  | 'refund_issued'
  | 'coupon_applied'
  | 'fraud_blocked'

export interface PaymentLogEntry {
  id: string
  userId: string
  event: PaymentEvent
  amountCents?: number
  currency?: string
  paymentMethod?: 'stripe' | 'paypal'
  planId?: string
  productId?: string
  couponCode?: string
  stripeIntentId?: string
  paypalOrderId?: string
  ipAddress?: string
  metadata?: Record<string, unknown>
  createdAt: number
  success: boolean
  errorMessage?: string
}

// ── In-memory fallback (fast getStats + tests) ─────────────────
const _logs: PaymentLogEntry[] = []

// ── Public API ────────────────────────────────────────────────

export function log(entry: Omit<PaymentLogEntry, 'id' | 'createdAt'>): PaymentLogEntry {
  const record: PaymentLogEntry = {
    ...entry,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  }
  _logs.push(record)
  // Keep last 500 entries in-memory for fast getStats/getRecentFailures
  if (_logs.length > 500) _logs.splice(0, _logs.length - 500)

  // Also persist to DB (fire-and-forget — never block payment flow)
  if (isSupabaseConfigured) {
    paymentEventRepository.insert({
      user_id:          entry.userId || null,
      event_type:       entry.event,
      amount_cents:     entry.amountCents ?? null,
      currency:         entry.currency ?? null,
      payment_method:   entry.paymentMethod ?? null,
      plan_id:          entry.planId ?? null,
      product_id:       entry.productId ?? null,
      coupon_code:      entry.couponCode ?? null,
      stripe_intent_id: entry.stripeIntentId ?? null,
      paypal_order_id:  entry.paypalOrderId ?? null,
      ip_address:       entry.ipAddress ?? null,
      success:          entry.success,
      error_message:    entry.errorMessage ?? null,
      metadata:         entry.metadata ?? {},
    }).catch(() => {}) // never throw — logging is best-effort
  }

  return record
}

export async function getUserHistory(userId: string, limit = 50): Promise<PaymentLogEntry[]> {
  // Try DB first for full cross-restart history
  if (isSupabaseConfigured) {
    try {
      const rows = await paymentEventRepository.listByUser(userId, limit)
      if (rows.length > 0) {
        return rows.map(r => ({
          id:             r.id,
          userId:         r.user_id ?? userId,
          event:          r.event_type as PaymentEvent,
          amountCents:    r.amount_cents ?? undefined,
          currency:       r.currency ?? undefined,
          paymentMethod:  r.payment_method ?? undefined,
          planId:         r.plan_id ?? undefined,
          productId:      r.product_id ?? undefined,
          couponCode:     r.coupon_code ?? undefined,
          stripeIntentId: r.stripe_intent_id ?? undefined,
          paypalOrderId:  r.paypal_order_id ?? undefined,
          ipAddress:      r.ip_address ?? undefined,
          metadata:       r.metadata ?? undefined,
          createdAt:      new Date(r.created_at).getTime(),
          success:        r.success,
          errorMessage:   r.error_message ?? undefined,
        }))
      }
    } catch {
      // fall through to in-memory
    }
  }
  return _logs
    .filter(e => e.userId === userId)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit)
}

export function getRecentFailures(userId: string, windowMs: number): PaymentLogEntry[] {
  const cutoff = Date.now() - windowMs
  return _logs.filter(e => e.userId === userId && !e.success && e.createdAt >= cutoff)
}

export function getStats(): { totalRevenue: number; successRate: number; todayRevenue: number } {
  const now = Date.now()
  const dayMs = 86_400_000
  const todayCutoff = now - dayMs
  const successful = _logs.filter(e => e.success && e.amountCents)
  const total = _logs.length
  const successCount = _logs.filter(e => e.success).length
  const totalRevenue = successful.reduce((sum, e) => sum + (e.amountCents ?? 0), 0)
  const todayRevenue = successful
    .filter(e => e.createdAt >= todayCutoff)
    .reduce((sum, e) => sum + (e.amountCents ?? 0), 0)
  return {
    totalRevenue,
    successRate: total > 0 ? Math.round((successCount / total) * 100) : 100,
    todayRevenue,
  }
}

/** Expose in-memory log for analytics aggregation. */
export function getLogs(): PaymentLogEntry[] {
  return [..._logs]
}
