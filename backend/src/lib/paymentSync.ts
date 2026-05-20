// ============================================================
// NEUROTEK AI — Payment Sync helpers (Supabase)
// ============================================================
import { supabase } from './supabase'
import { logger } from '../utils/logger'

export interface SubscriptionRecord {
  user_id: string
  stripe_customer_id?: string
  stripe_subscription_id?: string
  plan_id: string
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete'
  current_period_start?: number
  current_period_end?: number
  cancel_at_period_end?: boolean
  payment_method: 'stripe' | 'paypal'
}

export async function syncSubscriptionToDb(record: SubscriptionRecord): Promise<void> {
  if (!supabase) return
  const { error } = await (supabase
    .from('subscriptions')
    .upsert({ ...record, updated_at: new Date().toISOString() }, { onConflict: 'user_id' }) as any)
  if (error) logger.error('[paymentSync] subscription upsert failed:', error.message)
}

export async function getSubscriptionFromDb(userId: string): Promise<SubscriptionRecord | null> {
  if (!supabase) return null
  const { data, error } = await (supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single() as any)
  if (error || !data) return null
  return data as SubscriptionRecord
}

export async function logPaymentEvent(event: {
  user_id: string
  event_type: string
  amount_cents?: number
  currency?: string
  payment_method?: string
  plan_id?: string
  stripe_session_id?: string
  stripe_intent_id?: string
  success: boolean
  error_message?: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  if (!supabase) return
  await (supabase.from('payment_events').insert({
    ...event,
    created_at: new Date().toISOString(),
  }) as any).catch((e: Error) => logger.error('[paymentSync] log failed:', { message: e.message }))
}
