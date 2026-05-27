// ============================================================
// NEUROTEK AI — Invoice Service (PostgreSQL-backed)
// Replaces in-memory Map with invoiceRepository.
// Falls back to ephemeral in-memory store when DB not configured.
// ============================================================
import { randomUUID } from 'crypto'
import { isSupabaseConfigured } from '../lib/supabase'
import { invoiceRepository, type InvoiceRow } from '../repositories/billingRepository'

export interface InvoiceLineItem {
  description: string
  quantity: number
  unitPriceCents: number
  totalCents: number
}

export interface Invoice {
  id: string
  number: string
  userId: string
  customerName: string
  customerEmail: string
  customerAddress: {
    line1: string
    city: string
    country: string
    postalCode: string
  }
  vatNumber?: string
  lineItems: InvoiceLineItem[]
  subtotalCents: number
  vatCents: number
  vatRate: number
  totalCents: number
  currency: 'USD'
  status: 'paid' | 'pending' | 'void' | 'refunded'
  paymentMethod: 'stripe' | 'paypal'
  paymentIntentId?: string
  paypalOrderId?: string
  createdAt: number  // unix ms
  paidAt?: number
  periodStart?: number
  periodEnd?: number
}

// ── In-memory fallback (tests / no-DB mode) ───────────────────
const _invoicesInMemory = new Map<string, Invoice>()
let _invoiceSeq = 0

function generateNumber(): string {
  _invoiceSeq += 1
  const year = new Date().getFullYear()
  return `INV-${year}-${_invoiceSeq.toString().padStart(5, '0')}`
}

// ── Domain ↔ Row mappers ──────────────────────────────────────
function rowToInvoice(r: any): Invoice {
  return {
    id:              r.id,
    number:          r.number,
    userId:          r.user_id,
    customerName:    r.customer_name ?? '',
    customerEmail:   r.customer_email ?? '',
    customerAddress: r.customer_address ?? { line1: '', city: '', country: '', postalCode: '' },
    vatNumber:       r.vat_number ?? undefined,
    lineItems:       (r.line_items ?? []).map((li: any) => ({
      description:    li.description,
      quantity:       li.quantity,
      unitPriceCents: li.unit_price_cents,
      totalCents:     li.total_cents,
    })),
    subtotalCents:   r.subtotal_cents ?? 0,
    vatCents:        r.vat_cents ?? 0,
    vatRate:         Number(r.vat_rate ?? 0),
    totalCents:      r.total_cents ?? 0,
    currency:        (r.currency ?? 'USD') as 'USD',
    status:          r.status as Invoice['status'],
    paymentMethod:   r.payment_method as Invoice['paymentMethod'],
    paymentIntentId: r.payment_intent_id ?? undefined,
    paypalOrderId:   r.paypal_order_id ?? undefined,
    createdAt:       typeof r.created_at === 'string'
                       ? new Date(r.created_at).getTime()
                       : (r.created_at ?? Date.now()),
    paidAt:          r.paid_at ?? undefined,
    periodStart:     r.period_start ?? undefined,
    periodEnd:       r.period_end ?? undefined,
  }
}

function invoiceToRow(inv: Invoice): InvoiceRow {
  return {
    id:                inv.id,
    user_id:           inv.userId,
    customer_name:     inv.customerName,
    customer_email:    inv.customerEmail,
    customer_address:  inv.customerAddress as Record<string, string>,
    vat_number:        inv.vatNumber ?? null,
    line_items:        inv.lineItems.map(li => ({
      description:      li.description,
      quantity:         li.quantity,
      unit_price_cents: li.unitPriceCents,
      total_cents:      li.totalCents,
    })),
    subtotal_cents:    inv.subtotalCents,
    vat_cents:         inv.vatCents,
    vat_rate:          inv.vatRate,
    total_cents:       inv.totalCents,
    currency:          inv.currency,
    status:            inv.status,
    payment_method:    inv.paymentMethod,
    payment_intent_id: inv.paymentIntentId ?? null,
    paypal_order_id:   inv.paypalOrderId ?? null,
    period_start:      inv.periodStart ?? null,
    period_end:        inv.periodEnd ?? null,
    paid_at:           inv.paidAt ?? null,
  }
}

// ── Public API ────────────────────────────────────────────────

export async function createInvoice(
  data: Omit<Invoice, 'id' | 'number' | 'createdAt'>
): Promise<Invoice> {
  const id = randomUUID()
  if (!isSupabaseConfigured) {
    const number = generateNumber()
    const invoice: Invoice = { ...data, id, number, createdAt: Date.now() }
    _invoicesInMemory.set(id, invoice)
    return invoice
  }
  const row = invoiceToRow({ ...data, id, number: '', createdAt: Date.now() })
  const result = await invoiceRepository.create(row)
  const dbRow = (result as any)?.data ?? result
  return rowToInvoice(dbRow)
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  if (!isSupabaseConfigured) return _invoicesInMemory.get(id) ?? null
  const row = await invoiceRepository.findById(id)
  return row ? rowToInvoice(row) : null
}

export async function listUserInvoices(userId: string): Promise<Invoice[]> {
  if (!isSupabaseConfigured) {
    return Array.from(_invoicesInMemory.values())
      .filter(inv => inv.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt)
  }
  const rows = await invoiceRepository.listByUser(userId)
  return rows.map(rowToInvoice)
}

export async function markPaid(invoiceId: string, paymentIntentId: string): Promise<Invoice | null> {
  if (!isSupabaseConfigured) {
    const inv = _invoicesInMemory.get(invoiceId)
    if (!inv) return null
    inv.status = 'paid'
    inv.paymentIntentId = paymentIntentId
    inv.paidAt = Date.now()
    return inv
  }
  await invoiceRepository.updateStatus(invoiceId, 'paid', {
    payment_intent_id: paymentIntentId,
    paid_at: Date.now(),
  })
  return getInvoice(invoiceId)
}

export async function markRefunded(invoiceId: string): Promise<Invoice | null> {
  if (!isSupabaseConfigured) {
    const inv = _invoicesInMemory.get(invoiceId)
    if (!inv) return null
    inv.status = 'refunded'
    return inv
  }
  await invoiceRepository.updateStatus(invoiceId, 'refunded')
  return getInvoice(invoiceId)
}

export async function findByPaymentIntent(paymentIntentId: string): Promise<Invoice | null> {
  if (!isSupabaseConfigured) {
    for (const inv of _invoicesInMemory.values()) {
      if (inv.paymentIntentId === paymentIntentId) return inv
    }
    return null
  }
  const { supabase } = await import('../lib/supabase')
  if (!supabase) return null
  const { data } = await supabase.from('invoices').select('*')
    .eq('payment_intent_id', paymentIntentId).maybeSingle()
  return data ? rowToInvoice(data) : null
}

export function getInvoiceAsJSON(invoice: Invoice): Record<string, unknown> {
  return {
    invoice_number:    invoice.number,
    date:              new Date(invoice.createdAt).toISOString().split('T')[0],
    status:            invoice.status,
    customer: {
      name:            invoice.customerName,
      email:           invoice.customerEmail,
      address:         invoice.customerAddress,
      vat_number:      invoice.vatNumber ?? null,
    },
    line_items:        invoice.lineItems.map(li => ({
      description:     li.description,
      quantity:        li.quantity,
      unit_price:      `$${(li.unitPriceCents / 100).toFixed(2)}`,
      total:           `$${(li.totalCents / 100).toFixed(2)}`,
    })),
    subtotal:          `$${(invoice.subtotalCents / 100).toFixed(2)}`,
    vat:               `$${(invoice.vatCents / 100).toFixed(2)} (${(invoice.vatRate * 100).toFixed(0)}%)`,
    total:             `$${(invoice.totalCents / 100).toFixed(2)}`,
    currency:          invoice.currency,
    payment_method:    invoice.paymentMethod,
    payment_intent_id: invoice.paymentIntentId ?? null,
    ...(invoice.periodStart && {
      period: {
        start: new Date(invoice.periodStart).toISOString().split('T')[0],
        end:   invoice.periodEnd ? new Date(invoice.periodEnd).toISOString().split('T')[0] : null,
      },
    }),
  }
}
