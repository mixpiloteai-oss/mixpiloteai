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

// ── Seed mock invoices for 'demo' user ────────────────────────
function seed(): void {
  const now = Date.now();
  const day = 86_400_000;

  const mockInvoices: Omit<Invoice, 'id' | 'number' | 'createdAt'>[] = [
    {
      userId: 'demo',
      customerName: 'Demo User',
      customerEmail: 'demo@neurotek.ai',
      customerAddress: { line1: '123 Main St', city: 'Berlin', country: 'DE', postalCode: '10115' },
      lineItems: [
        { description: 'NeuroTek AI Pro — Monthly', quantity: 1, unitPriceCents: 999, totalCents: 999 },
      ],
      subtotalCents: 999,
      vatCents: 190,
      vatRate: 0.19,
      totalCents: 1189,
      currency: 'USD',
      status: 'paid',
      paymentMethod: 'stripe',
      paymentIntentId: 'pi_demo_001',
      paidAt: now - 10 * day,
      periodStart: now - 10 * day,
      periodEnd: now + 20 * day,
    },
    {
      userId: 'demo',
      customerName: 'Demo User',
      customerEmail: 'demo@neurotek.ai',
      customerAddress: { line1: '123 Main St', city: 'Berlin', country: 'DE', postalCode: '10115' },
      lineItems: [
        { description: 'NeuroTek AI Pro — Monthly (renewal)', quantity: 1, unitPriceCents: 999, totalCents: 999 },
      ],
      subtotalCents: 999,
      vatCents: 190,
      vatRate: 0.19,
      totalCents: 1189,
      currency: 'USD',
      status: 'paid',
      paymentMethod: 'stripe',
      paymentIntentId: 'pi_demo_002',
      paidAt: now - 9 * day,
      periodStart: now - 9 * day,
      periodEnd: now + 21 * day,
    },
    {
      userId: 'demo',
      customerName: 'Demo User',
      customerEmail: 'demo@neurotek.ai',
      customerAddress: { line1: '123 Main St', city: 'Berlin', country: 'DE', postalCode: '10115' },
      lineItems: [
        { description: 'AI Credits Package — 100 credits', quantity: 1, unitPriceCents: 499, totalCents: 499 },
      ],
      subtotalCents: 499,
      vatCents: 95,
      vatRate: 0.19,
      totalCents: 594,
      currency: 'USD',
      status: 'refunded',
      paymentMethod: 'stripe',
      paymentIntentId: 'pi_demo_004',
      paidAt: now - 7 * day,
    },
    {
      userId: 'demo',
      customerName: 'Demo User',
      customerEmail: 'demo@neurotek.ai',
      customerAddress: { line1: '123 Main St', city: 'Berlin', country: 'DE', postalCode: '10115' },
      lineItems: [
        { description: 'NeuroTek AI Studio — Monthly', quantity: 1, unitPriceCents: 2499, totalCents: 2499 },
      ],
      subtotalCents: 2499,
      vatCents: 475,
      vatRate: 0.19,
      totalCents: 2974,
      currency: 'USD',
      status: 'paid',
      paymentMethod: 'paypal',
      paypalOrderId: 'PAYPAL_DEMO_001',
      paidAt: now - 3 * day,
      periodStart: now - 3 * day,
      periodEnd: now + 27 * day,
    } as Invoice & { paypalOrderId: string },
    {
      userId: 'demo',
      customerName: 'Demo User',
      customerEmail: 'demo@neurotek.ai',
      customerAddress: { line1: '123 Main St', city: 'Berlin', country: 'DE', postalCode: '10115' },
      lineItems: [
        { description: 'Marketplace Plugin — Acid Bass Synthesizer', quantity: 1, unitPriceCents: 1999, totalCents: 1999 },
      ],
      subtotalCents: 1999,
      vatCents: 380,
      vatRate: 0.19,
      totalCents: 2379,
      currency: 'USD',
      status: 'pending',
      paymentMethod: 'stripe',
    },
  ];

  mockInvoices.forEach((inv, i) => {
    const id = randomUUID();
    const number = generateInvoiceNumber();
    invoices.set(id, {
      ...inv,
      id,
      number,
      createdAt: now - (10 - i) * day,
    });
  });
}

seed();

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
