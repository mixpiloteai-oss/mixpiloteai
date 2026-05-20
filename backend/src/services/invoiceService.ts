// ============================================================
// NEUROTEK AI — Invoice Service
// ============================================================
import { randomUUID } from 'crypto';

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}

export interface Invoice {
  id: string;
  number: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  customerAddress: {
    line1: string;
    city: string;
    country: string;
    postalCode: string;
  };
  vatNumber?: string;
  lineItems: InvoiceLineItem[];
  subtotalCents: number;
  vatCents: number;
  vatRate: number;
  totalCents: number;
  currency: 'USD';
  status: 'paid' | 'pending' | 'void' | 'refunded';
  paymentMethod: 'stripe' | 'paypal';
  paymentIntentId?: string;
  createdAt: number;
  paidAt?: number;
  periodStart?: number;
  periodEnd?: number;
}

// ── In-memory store ───────────────────────────────────────────
const invoices = new Map<string, Invoice>();
let invoiceSequence = 0;

function generateInvoiceNumber(): string {
  invoiceSequence += 1;
  const year = new Date().getFullYear();
  const seq = invoiceSequence.toString().padStart(5, '0');
  return `INV-${year}-${seq}`;
}


// ── Public API ────────────────────────────────────────────────

export function createInvoice(data: Omit<Invoice, 'id' | 'number' | 'createdAt'>): Invoice {
  const id = randomUUID();
  const number = generateInvoiceNumber();
  const invoice: Invoice = {
    ...data,
    id,
    number,
    createdAt: Date.now(),
  };
  invoices.set(id, invoice);
  return invoice;
}

export function getInvoice(id: string): Invoice | null {
  return invoices.get(id) ?? null;
}

export function listUserInvoices(userId: string): Invoice[] {
  return Array.from(invoices.values())
    .filter((inv) => inv.userId === userId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function markPaid(invoiceId: string, paymentIntentId: string): Invoice | null {
  const inv = invoices.get(invoiceId);
  if (!inv) return null;
  inv.status = 'paid';
  inv.paymentIntentId = paymentIntentId;
  inv.paidAt = Date.now();
  return inv;
}

export function markRefunded(invoiceId: string): Invoice | null {
  const inv = invoices.get(invoiceId);
  if (!inv) return null;
  inv.status = 'refunded';
  return inv;
}

export function getInvoiceAsJSON(invoiceId: string): Record<string, unknown> | null {
  const inv = invoices.get(invoiceId);
  if (!inv) return null;

  return {
    id: inv.id,
    number: inv.number,
    status: inv.status,
    currency: inv.currency,
    customer: {
      name: inv.customerName,
      email: inv.customerEmail,
      address: inv.customerAddress,
      vatNumber: inv.vatNumber,
    },
    lineItems: inv.lineItems.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: `$${(item.unitPriceCents / 100).toFixed(2)}`,
      total: `$${(item.totalCents / 100).toFixed(2)}`,
    })),
    totals: {
      subtotal: `$${(inv.subtotalCents / 100).toFixed(2)}`,
      vat: `$${(inv.vatCents / 100).toFixed(2)}`,
      vatRate: `${Math.round(inv.vatRate * 100)}%`,
      total: `$${(inv.totalCents / 100).toFixed(2)}`,
    },
    payment: {
      method: inv.paymentMethod,
      intentId: inv.paymentIntentId,
    },
    dates: {
      created: new Date(inv.createdAt).toISOString(),
      paid: inv.paidAt ? new Date(inv.paidAt).toISOString() : null,
      periodStart: inv.periodStart ? new Date(inv.periodStart).toISOString() : null,
      periodEnd: inv.periodEnd ? new Date(inv.periodEnd).toISOString() : null,
    },
  };
}
