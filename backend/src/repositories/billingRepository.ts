// ============================================================
// NEUROTEK AI — Billing Repository
// Covers: billing_history, invoices, payment_events,
//         webhook_events (idempotency), idempotency_keys
// All writes use withRetry for transient-error resilience.
// ============================================================
import { supabase, isSupabaseConfigured, withRetry } from '../lib/db'
import { v4 as uuidv4 } from 'uuid'

// ── Billing History ────────────────────────────────────────────

export interface BillingHistoryRow {
  id?: string
  user_id: string
  amount: number
  currency: string
  status: 'succeeded' | 'failed' | 'refunded' | 'pending'
  provider: 'stripe' | 'paypal' | 'manual'
  provider_payment_id?: string | null
  description: string
  plan?: string | null
  metadata?: Record<string, unknown>
}

export const billingRepository = {
  async insert(row: BillingHistoryRow): Promise<any> {
    if (!isSupabaseConfigured || !supabase) return null
    return withRetry(async () =>
      supabase!.from('billing_history')
        .insert([{ id: uuidv4(), ...row }]).select().single() as unknown as
        { data: any | null; error: { message: string; code?: string } | null },
      'billingRepo.insert'
    )
  },

  async listByUser(userId: string, limit = 50): Promise<any[]> {
    if (!isSupabaseConfigured || !supabase) return []
    const { data } = await supabase.from('billing_history').select('*')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(limit)
    return data ?? []
  },

  async listAll(opts: { limit?: number; offset?: number; status?: string } = {}): Promise<any[]> {
    if (!isSupabaseConfigured || !supabase) return []
    let q = supabase.from('billing_history').select('*')
    if (opts.status) q = q.eq('status', opts.status)
    const { data } = await q.order('created_at', { ascending: false })
      .range(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 100) - 1)
    return data ?? []
  },

  async updateStatus(id: string, status: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return
    await withRetry(async () =>
      supabase!.from('billing_history').update({ status }).eq('id', id) as unknown as
        { data: null; error: { message: string; code?: string } | null },
      'billingRepo.updateStatus'
    )
  },

  async totalRevenue(opts: { currency?: string; provider?: string } = {}): Promise<number> {
    if (!isSupabaseConfigured || !supabase) return 0
    let q = supabase.from('billing_history').select('amount').eq('status', 'succeeded')
    if (opts.currency) q = q.eq('currency', opts.currency)
    if (opts.provider) q = q.eq('provider', opts.provider)
    const { data } = await q
    return (data as any[] ?? []).reduce((sum: number, r: any) => sum + (r.amount ?? 0), 0)
  },
}

// ── Invoices ──────────────────────────────────────────────────

export interface InvoiceRow {
  id?: string
  number?: string
  user_id: string
  customer_name: string
  customer_email: string
  customer_address: Record<string, string>
  vat_number?: string | null
  line_items: Array<{
    description: string
    quantity: number
    unit_price_cents: number
    total_cents: number
  }>
  subtotal_cents: number
  vat_cents: number
  vat_rate: number
  total_cents: number
  currency: string
  status: 'paid' | 'pending' | 'void' | 'refunded'
  payment_method: 'stripe' | 'paypal'
  payment_intent_id?: string | null
  paypal_order_id?: string | null
  period_start?: number | null
  period_end?: number | null
  paid_at?: number | null
}

// Sequential invoice numbers — in-memory counter (reloads from DB on restart)
let _invoiceSeq = 0
let _invoiceSeqLoaded = false

async function nextInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear()
  if (isSupabaseConfigured && supabase) {
    // Use DB for sequence to avoid gaps/collisions
    const { data } = await supabase
      .from('invoices')
      .select('number')
      .like('number', `INV-${year}-%`)
      .order('number', { ascending: false })
      .limit(1)
    const last = (data?.[0] as any)?.number as string | undefined
    const seq = last ? parseInt(last.split('-')[2] ?? '0', 10) + 1 : 1
    return `INV-${year}-${String(seq).padStart(5, '0')}`
  }
  // Fallback: local counter
  if (!_invoiceSeqLoaded) { _invoiceSeq = Math.floor(Date.now() / 1000) % 100000; _invoiceSeqLoaded = true }
  return `INV-${year}-${String(++_invoiceSeq).padStart(5, '0')}`
}

export const invoiceRepository = {
  async create(row: InvoiceRow): Promise<any> {
    const number = await nextInvoiceNumber()
    const id = row.id ?? uuidv4()
    if (!isSupabaseConfigured || !supabase) {
      return { ...row, id, number, created_at: new Date().toISOString() }
    }
    return withRetry(async () =>
      supabase!.from('invoices')
        .insert([{ ...row, id, number }]).select().single() as unknown as
        { data: any | null; error: { message: string; code?: string } | null },
      'invoiceRepo.create'
    )
  },

  async findById(id: string): Promise<any | null> {
    if (!isSupabaseConfigured || !supabase) return null
    const { data } = await supabase.from('invoices').select('*').eq('id', id).maybeSingle()
    return data ?? null
  },

  async findByNumber(number: string): Promise<any | null> {
    if (!isSupabaseConfigured || !supabase) return null
    const { data } = await supabase.from('invoices').select('*').eq('number', number).maybeSingle()
    return data ?? null
  },

  async listByUser(userId: string, limit = 50): Promise<any[]> {
    if (!isSupabaseConfigured || !supabase) return []
    const { data } = await supabase.from('invoices').select('*')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(limit)
    return data ?? []
  },

  async updateStatus(id: string, status: string, extra: Record<string, unknown> = {}): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return
    await withRetry(async () =>
      supabase!.from('invoices').update({ status, ...extra }).eq('id', id) as unknown as
        { data: null; error: { message: string; code?: string } | null },
      'invoiceRepo.updateStatus'
    )
  },
}

// ── Payment Events ────────────────────────────────────────────

export interface PaymentEventRow {
  user_id?: string | null
  event_type: string
  amount_cents?: number | null
  currency?: string | null
  payment_method?: 'stripe' | 'paypal' | 'manual' | null
  plan_id?: string | null
  product_id?: string | null
  coupon_code?: string | null
  stripe_session_id?: string | null
  stripe_intent_id?: string | null
  paypal_order_id?: string | null
  ip_address?: string | null
  success: boolean
  error_message?: string | null
  metadata?: Record<string, unknown>
}

// In-memory fallback for tests / no-DB mode
const _eventsInMemory: Array<PaymentEventRow & { id: string; created_at: string }> = []

export const paymentEventRepository = {
  async insert(row: PaymentEventRow): Promise<void> {
    if (!isSupabaseConfigured || !supabase) {
      _eventsInMemory.push({ ...row, id: uuidv4(), created_at: new Date().toISOString() })
      // Keep last 1000 entries in memory
      if (_eventsInMemory.length > 1000) _eventsInMemory.splice(0, _eventsInMemory.length - 1000)
      return
    }
    // Fire-and-forget — never block payment flow on log write
    void supabase!.from('payment_events').insert([{ id: uuidv4(), ...row }])
  },

  async listByUser(userId: string, limit = 50): Promise<any[]> {
    if (!isSupabaseConfigured || !supabase) {
      return _eventsInMemory
        .filter(e => e.user_id === userId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, limit)
    }
    const { data } = await supabase.from('payment_events').select('*')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(limit)
    return data ?? []
  },

  async listRecentFailures(userId: string, windowMs: number): Promise<any[]> {
    if (!isSupabaseConfigured || !supabase) {
      const cutoff = new Date(Date.now() - windowMs).toISOString()
      return _eventsInMemory.filter(e => e.user_id === userId && !e.success && e.created_at >= cutoff)
    }
    const cutoff = new Date(Date.now() - windowMs).toISOString()
    const { data } = await supabase.from('payment_events').select('*')
      .eq('user_id', userId).eq('success', false).gte('created_at', cutoff)
    return data ?? []
  },
}

// ── Webhook Events (idempotency) ──────────────────────────────

export const webhookEventRepository = {
  /** Returns true if this event ID was already processed (replay attack) */
  async isProcessed(eventId: string): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false
    const { data } = await supabase.from('webhook_events').select('id').eq('id', eventId).maybeSingle()
    return !!data
  },

  async markProcessed(
    eventId: string,
    provider: 'stripe' | 'paypal',
    eventType: string,
    payload?: Record<string, unknown>,
    status: 'processed' | 'failed' | 'skipped' = 'processed',
    errorMessage?: string
  ): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return
    void supabase.from('webhook_events').insert([{
      id: eventId,
      provider,
      event_type: eventType,
      status,
      payload: payload ?? null,
      error_message: errorMessage ?? null,
    }])
  },
}

// ── Idempotency Keys (client double-click prevention) ─────────

export interface IdempotencyRecord {
  key: string
  user_id: string
  endpoint: string
  response_status: number
  response_body: Record<string, unknown>
}

export const idempotencyRepository = {
  async get(key: string, userId: string): Promise<IdempotencyRecord | null> {
    if (!isSupabaseConfigured || !supabase) return null
    const { data } = await supabase.from('idempotency_keys').select('*')
      .eq('key', key).eq('user_id', userId)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()
    return data as IdempotencyRecord | null
  },

  async set(record: IdempotencyRecord): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return
    void supabase.from('idempotency_keys').upsert([{
      ...record,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    }])
  },
}
