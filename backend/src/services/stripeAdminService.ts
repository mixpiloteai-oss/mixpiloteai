// ============================================================
// NEUROTEK AI — Stripe Admin Analytics Service
// Provides revenue analytics, webhook log management,
// customer portal creation, coupon management, and more.
// ============================================================

const STRIPE_API = 'https://api.stripe.com/v1';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? '';
const IS_MOCK = !STRIPE_SECRET_KEY || STRIPE_SECRET_KEY === 'sk_test_placeholder';

// ── Types ─────────────────────────────────────────────────────

export interface StripeCharge {
  id: string;
  amount: number;
  currency: string;
  status: string;
  customer: string | null;
  customer_email: string | null;
  description: string | null;
  created: number;
  refunded: boolean;
  refund_id: string | null;
  payment_intent: string | null;
}

export interface StripeSubscription {
  id: string;
  customer: string;
  customer_email: string | null;
  status: string;
  plan_name: string | null;
  amount: number;
  currency: string;
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
  trial_end: number | null;
  created: number;
}

export interface StripeCoupon {
  id: string;
  name: string | null;
  percent_off: number | null;
  amount_off: number | null;
  currency: string | null;
  duration: string;
  duration_in_months: number | null;
  times_redeemed: number;
  max_redemptions: number | null;
  valid: boolean;
  created: number;
}

export interface StripeInvoice {
  id: string;
  customer: string;
  customer_email: string | null;
  amount_paid: number;
  amount_due: number;
  currency: string;
  status: string | null;
  created: number;
  period_start: number;
  period_end: number;
  subscription: string | null;
  hosted_invoice_url: string | null;
}

export interface StripeWebhookLog {
  id: string;
  type: string;
  created: number;
  livemode: boolean;
  status: 'success' | 'failed';
  error?: string;
}

export interface RevenueDataPoint {
  date: string;
  revenue: number;
}

export interface StripeAnalytics {
  mrr: number;
  arr: number;
  totalRevenue: number;
  todayRevenue: number;
  revenue7d: RevenueDataPoint[];
  revenue30d: RevenueDataPoint[];
  activeSubscriptions: number;
  canceledThisMonth: number;
  newThisMonth: number;
  churnRate: number;
  avgRevenuePerUser: number;
  successRate: number;
  failedPayments: number;
  refundCount: number;
  refundAmount: number;
  balance: { available: number; pending: number; currency: string };
}

// ── HTTP helpers ──────────────────────────────────────────────

async function stripeGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = params
    ? `${STRIPE_API}${path}?${new URLSearchParams(params).toString()}`
    : `${STRIPE_API}${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
  });
  if (!res.ok) {
    const err = await res.json() as { error?: { message?: string } };
    throw new Error(`Stripe GET ${path} failed (${res.status}): ${err?.error?.message ?? 'unknown'}`);
  }
  return res.json() as Promise<T>;
}

async function stripePost<T>(path: string, body?: Record<string, string>): Promise<T> {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body ? new URLSearchParams(body).toString() : undefined,
  });
  if (!res.ok) {
    const err = await res.json() as { error?: { message?: string } };
    throw new Error(`Stripe POST ${path} failed (${res.status}): ${err?.error?.message ?? 'unknown'}`);
  }
  return res.json() as Promise<T>;
}

async function stripeDelete<T>(path: string): Promise<T> {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
  });
  if (!res.ok) {
    const err = await res.json() as { error?: { message?: string } };
    throw new Error(`Stripe DELETE ${path} failed (${res.status}): ${err?.error?.message ?? 'unknown'}`);
  }
  return res.json() as Promise<T>;
}

// ── Webhook Event Log ─────────────────────────────────────────

const webhookEventLog: StripeWebhookLog[] = [];
const MAX_WEBHOOK_LOG = 200;

export function recordWebhookEvent(
  type: string,
  status: 'success' | 'failed',
  error?: string,
  eventId?: string,
  livemode?: boolean,
): void {
  const entry: StripeWebhookLog = {
    id: eventId ?? `wh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    created: Math.floor(Date.now() / 1000),
    livemode: livemode ?? !IS_MOCK,
    status,
    ...(error ? { error } : {}),
  };
  webhookEventLog.unshift(entry);
  if (webhookEventLog.length > MAX_WEBHOOK_LOG) {
    webhookEventLog.splice(MAX_WEBHOOK_LOG);
  }
}

export function getWebhookLogs(limit = 50): StripeWebhookLog[] {
  if (IS_MOCK && webhookEventLog.length === 0) {
    const now = Math.floor(Date.now() / 1000);
    const eventTypes = [
      'checkout.session.completed',
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'invoice.payment_succeeded',
      'invoice.payment_failed',
      'charge.refunded',
      'payment_intent.succeeded',
    ];
    const statuses: Array<'success' | 'failed'> = ['success', 'success', 'success', 'success', 'failed'];
    return Array.from({ length: Math.min(limit, 20) }, (_, i) => ({
      id: `wh_mock_${(i + 1).toString().padStart(4, '0')}`,
      type: eventTypes[i % eventTypes.length]!,
      created: now - i * 3600,
      livemode: false,
      status: statuses[i % statuses.length]!,
      ...(statuses[i % statuses.length] === 'failed' ? { error: 'Handler threw: connection timeout' } : {}),
    }));
  }
  return webhookEventLog.slice(0, limit);
}

// ── Mock Data Generators ──────────────────────────────────────

function generateRevenuePoints(days: number): RevenueDataPoint[] {
  const points: RevenueDataPoint[] = [];
  const base = days === 7 ? 1200 : 950;
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const dateStr = d.toISOString().slice(0, 10);
    const jitter = Math.floor(Math.random() * 400) - 200;
    points.push({ date: dateStr, revenue: Math.max(0, base + jitter) });
  }
  return points;
}

function getMockAnalytics(): StripeAnalytics {
  return {
    mrr: 485000,        // $4,850.00 in cents
    arr: 5820000,       // $58,200.00 in cents
    totalRevenue: 2435000,
    todayRevenue: 32000,
    revenue7d: generateRevenuePoints(7),
    revenue30d: generateRevenuePoints(30),
    activeSubscriptions: 312,
    canceledThisMonth: 14,
    newThisMonth: 38,
    churnRate: 4.3,
    avgRevenuePerUser: 1554,
    successRate: 96.8,
    failedPayments: 7,
    refundCount: 3,
    refundAmount: 8997,
    balance: { available: 2450000, pending: 320000, currency: 'usd' },
  };
}

function getMockCharges(limit: number): StripeCharge[] {
  const now = Math.floor(Date.now() / 1000);
  const emails = [
    'alex.rivera@example.com', 'jordan.lee@example.com', 'morgan.chen@example.com',
    'taylor.kim@example.com', 'sam.patel@example.com', 'chris.wu@example.com',
    'drew.santos@example.com', 'quinn.murphy@example.com', 'avery.brooks@example.com',
    'blake.torres@example.com',
  ];
  const amounts = [999, 2499, 7999, 19999, 9999, 499, 1999, 4999, 12999, 2999];
  const statuses = ['succeeded', 'succeeded', 'succeeded', 'succeeded', 'succeeded', 'failed', 'succeeded', 'succeeded', 'refunded', 'succeeded'];
  const descriptions = [
    'Pro Monthly', 'Studio Monthly', 'Pro Annual', 'Studio Annual', 'Label Monthly',
    'Pro Monthly', 'Studio Annual', 'Pro Annual', 'Studio Monthly', 'Pro Monthly',
  ];

  return Array.from({ length: Math.min(limit, 10) }, (_, i) => ({
    id: `ch_mock_${(i + 1).toString().padStart(4, '0')}`,
    amount: amounts[i]!,
    currency: 'usd',
    status: statuses[i]!,
    customer: `cus_mock_${(i + 1).toString().padStart(4, '0')}`,
    customer_email: emails[i]!,
    description: descriptions[i]!,
    created: now - i * 86400,
    refunded: statuses[i] === 'refunded',
    refund_id: statuses[i] === 'refunded' ? `re_mock_${(i + 1).toString().padStart(4, '0')}` : null,
    payment_intent: `pi_mock_${(i + 1).toString().padStart(4, '0')}`,
  }));
}

function getMockSubscriptions(limit: number): StripeSubscription[] {
  const now = Math.floor(Date.now() / 1000);
  const periodStart = now - 15 * 86400;
  const periodEnd = now + 15 * 86400;
  const data = [
    { email: 'alex.rivera@example.com', plan: 'Pro Monthly', amount: 999, status: 'active' },
    { email: 'jordan.lee@example.com', plan: 'Studio Monthly', amount: 2499, status: 'active' },
    { email: 'morgan.chen@example.com', plan: 'Pro Annual', amount: 7999, status: 'active' },
    { email: 'taylor.kim@example.com', plan: 'Studio Annual', amount: 19999, status: 'active' },
    { email: 'sam.patel@example.com', plan: 'Label Monthly', amount: 9999, status: 'trialing' },
    { email: 'chris.wu@example.com', plan: 'Pro Monthly', amount: 999, status: 'past_due' },
    { email: 'drew.santos@example.com', plan: 'Studio Monthly', amount: 2499, status: 'canceled' },
    { email: 'quinn.murphy@example.com', plan: 'Pro Annual', amount: 7999, status: 'active' },
  ];
  return data.slice(0, Math.min(limit, data.length)).map((d, i) => ({
    id: `sub_mock_${(i + 1).toString().padStart(4, '0')}`,
    customer: `cus_mock_${(i + 1).toString().padStart(4, '0')}`,
    customer_email: d.email,
    status: d.status,
    plan_name: d.plan,
    amount: d.amount,
    currency: 'usd',
    current_period_start: periodStart,
    current_period_end: periodEnd,
    cancel_at_period_end: d.status === 'canceled',
    trial_end: d.status === 'trialing' ? now + 7 * 86400 : null,
    created: now - (i + 1) * 7 * 86400,
  }));
}

function getMockCoupons(): StripeCoupon[] {
  const now = Math.floor(Date.now() / 1000);
  return [
    {
      id: 'LAUNCH20',
      name: 'Launch Promo 20%',
      percent_off: 20,
      amount_off: null,
      currency: null,
      duration: 'repeating',
      duration_in_months: 3,
      times_redeemed: 47,
      max_redemptions: 100,
      valid: true,
      created: now - 30 * 86400,
    },
    {
      id: 'ANNUAL15',
      name: 'Annual Plan 15% Off',
      percent_off: 15,
      amount_off: null,
      currency: null,
      duration: 'once',
      duration_in_months: null,
      times_redeemed: 23,
      max_redemptions: null,
      valid: true,
      created: now - 60 * 86400,
    },
    {
      id: 'STUDENT50',
      name: 'Student Discount 50%',
      percent_off: 50,
      amount_off: null,
      currency: null,
      duration: 'repeating',
      duration_in_months: 12,
      times_redeemed: 8,
      max_redemptions: 50,
      valid: true,
      created: now - 90 * 86400,
    },
  ];
}

function getMockInvoices(limit: number): StripeInvoice[] {
  const now = Math.floor(Date.now() / 1000);
  const data = [
    { email: 'alex.rivera@example.com', amount: 999, status: 'paid' },
    { email: 'jordan.lee@example.com', amount: 2499, status: 'paid' },
    { email: 'morgan.chen@example.com', amount: 7999, status: 'paid' },
    { email: 'taylor.kim@example.com', amount: 19999, status: 'paid' },
    { email: 'sam.patel@example.com', amount: 9999, status: 'open' },
    { email: 'chris.wu@example.com', amount: 999, status: 'uncollectible' },
    { email: 'drew.santos@example.com', amount: 2499, status: 'paid' },
    { email: 'quinn.murphy@example.com', amount: 7999, status: 'paid' },
  ];
  return data.slice(0, Math.min(limit, data.length)).map((d, i) => ({
    id: `in_mock_${(i + 1).toString().padStart(4, '0')}`,
    customer: `cus_mock_${(i + 1).toString().padStart(4, '0')}`,
    customer_email: d.email,
    amount_paid: d.status === 'paid' ? d.amount : 0,
    amount_due: d.amount,
    currency: 'usd',
    status: d.status,
    created: now - i * 86400 * 3,
    period_start: now - (i + 1) * 86400 * 30,
    period_end: now - i * 86400 * 30,
    subscription: `sub_mock_${(i + 1).toString().padStart(4, '0')}`,
    hosted_invoice_url: `https://invoice.stripe.com/i/acct_mock/invst_mock_${i}`,
  }));
}

// ── Public API ────────────────────────────────────────────────

export async function getStripeAnalytics(): Promise<StripeAnalytics & { isMock: boolean }> {
  if (IS_MOCK) {
    return { ...getMockAnalytics(), isMock: true };
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = now - 30 * 86400;
    const monthStart = Math.floor(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000);
    const todayStart = now - (now % 86400);
    const sevenDaysAgo = now - 7 * 86400;

    const [balance, chargesMonth, activeSubs, canceledSubs] = await Promise.all([
      stripeGet<{
        available: Array<{ amount: number; currency: string }>;
        pending: Array<{ amount: number; currency: string }>;
      }>('/balance'),
      stripeGet<{ data: Array<{ amount: number; status: string; created: number; refunded: boolean }> }>('/charges', {
        limit: '100',
        'created[gte]': String(thirtyDaysAgo),
        expand: 'data.refunds',
      }),
      stripeGet<{
        data: Array<{ items: { data: Array<{ price: { unit_amount: number } }> }; created: number }>;
      }>('/subscriptions', { status: 'active', limit: '100' }),
      stripeGet<{ data: Array<{ canceled_at: number | null }> }>('/subscriptions', {
        status: 'canceled',
        limit: '100',
        'canceled_at[gte]': String(monthStart),
      }),
    ]);

    const succeeded = chargesMonth.data.filter((c) => c.status === 'succeeded');
    const failed = chargesMonth.data.filter((c) => c.status !== 'succeeded' && c.status !== 'refunded');
    const refunded = chargesMonth.data.filter((c) => c.refunded);

    const totalRevenue = succeeded.reduce((s, c) => s + c.amount, 0);
    const todayRevenue = succeeded
      .filter((c) => c.created >= todayStart)
      .reduce((s, c) => s + c.amount, 0);

    const mrr = activeSubs.data.reduce((s, sub) => {
      return s + (sub.items.data[0]?.price?.unit_amount ?? 0);
    }, 0);

    const newThisMonth = activeSubs.data.filter((s) => s.created >= monthStart).length;
    const canceledThisMonth = canceledSubs.data.length;
    const churnRate = activeSubs.data.length > 0
      ? Math.round((canceledThisMonth / (activeSubs.data.length + canceledThisMonth)) * 1000) / 10
      : 0;

    // Build revenue7d and revenue30d
    function buildRevenueSeries(days: number): RevenueDataPoint[] {
      const cutoff = now - days * 86400;
      const map: Record<string, number> = {};
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date((now - i * 86400) * 1000);
        map[d.toISOString().slice(0, 10)] = 0;
      }
      for (const c of succeeded) {
        if (c.created >= cutoff) {
          const d = new Date(c.created * 1000).toISOString().slice(0, 10);
          if (d in map) map[d] = (map[d] ?? 0) + c.amount;
        }
      }
      return Object.entries(map).map(([date, revenue]) => ({ date, revenue }));
    }

    const availableBalance = balance.available[0]?.amount ?? 0;
    const pendingBalance = balance.pending[0]?.amount ?? 0;
    const balanceCurrency = balance.available[0]?.currency ?? 'usd';

    return {
      mrr,
      arr: mrr * 12,
      totalRevenue,
      todayRevenue,
      revenue7d: buildRevenueSeries(7),
      revenue30d: buildRevenueSeries(30),
      activeSubscriptions: activeSubs.data.length,
      canceledThisMonth,
      newThisMonth,
      churnRate,
      avgRevenuePerUser: activeSubs.data.length > 0 ? Math.round(mrr / activeSubs.data.length) : 0,
      successRate: chargesMonth.data.length > 0
        ? Math.round((succeeded.length / chargesMonth.data.length) * 1000) / 10
        : 100,
      failedPayments: failed.length,
      refundCount: refunded.length,
      refundAmount: refunded.reduce((s, c) => s + c.amount, 0),
      balance: { available: availableBalance, pending: pendingBalance, currency: balanceCurrency },
      isMock: false,
    };
  } catch (err) {
    throw new Error(`Failed to fetch Stripe analytics: ${(err as Error).message}`);
  }
}

export async function listCharges(
  limit = 25,
  startingAfter?: string
): Promise<{ data: StripeCharge[]; has_more: boolean; isMock: boolean }> {
  if (IS_MOCK) {
    return { data: getMockCharges(limit), has_more: false, isMock: true };
  }

  const params: Record<string, string> = {
    limit: String(Math.min(limit, 100)),
    expand: 'data.customer',
  };
  if (startingAfter) params['starting_after'] = startingAfter;

  const result = await stripeGet<{
    data: Array<{
      id: string;
      amount: number;
      currency: string;
      status: string;
      customer: { id: string; email?: string } | string | null;
      description: string | null;
      created: number;
      refunded: boolean;
      refunds?: { data: Array<{ id: string }> };
      payment_intent: string | null;
    }>;
    has_more: boolean;
  }>('/charges', params);

  const data: StripeCharge[] = result.data.map((c) => ({
    id: c.id,
    amount: c.amount,
    currency: c.currency,
    status: c.status,
    customer: typeof c.customer === 'string' ? c.customer : (c.customer?.id ?? null),
    customer_email: typeof c.customer === 'object' && c.customer !== null
      ? (c.customer.email ?? null)
      : null,
    description: c.description,
    created: c.created,
    refunded: c.refunded,
    refund_id: c.refunds?.data[0]?.id ?? null,
    payment_intent: c.payment_intent,
  }));

  return { data, has_more: result.has_more, isMock: false };
}

export async function listSubscriptions(
  limit = 25,
  status?: string
): Promise<{ data: StripeSubscription[]; has_more: boolean; isMock: boolean }> {
  if (IS_MOCK) {
    const subs = getMockSubscriptions(limit);
    const filtered = status ? subs.filter((s) => s.status === status) : subs;
    return { data: filtered, has_more: false, isMock: true };
  }

  const params: Record<string, string> = {
    limit: String(Math.min(limit, 100)),
    expand: 'data.customer,data.items.data.price.product',
  };
  if (status) params['status'] = status;

  const result = await stripeGet<{
    data: Array<{
      id: string;
      customer: { id: string; email?: string } | string;
      status: string;
      items: { data: Array<{ price: { unit_amount: number; currency: string; product: { name?: string } | string } }> };
      current_period_start: number;
      current_period_end: number;
      cancel_at_period_end: boolean;
      trial_end: number | null;
      created: number;
    }>;
    has_more: boolean;
  }>('/subscriptions', params);

  const data: StripeSubscription[] = result.data.map((s) => {
    const priceItem = s.items.data[0];
    return {
      id: s.id,
      customer: typeof s.customer === 'string' ? s.customer : s.customer.id,
      customer_email: typeof s.customer === 'object' ? (s.customer.email ?? null) : null,
      status: s.status,
      plan_name: priceItem
        ? (typeof priceItem.price.product === 'object'
          ? ((priceItem.price.product as { name?: string }).name ?? null)
          : null)
        : null,
      amount: priceItem?.price?.unit_amount ?? 0,
      currency: priceItem?.price?.currency ?? 'usd',
      current_period_start: s.current_period_start,
      current_period_end: s.current_period_end,
      cancel_at_period_end: s.cancel_at_period_end,
      trial_end: s.trial_end,
      created: s.created,
    };
  });

  return { data, has_more: result.has_more, isMock: false };
}

export async function listCoupons(limit = 25): Promise<{ data: StripeCoupon[]; isMock: boolean }> {
  if (IS_MOCK) {
    return { data: getMockCoupons(), isMock: true };
  }

  const result = await stripeGet<{
    data: Array<{
      id: string;
      name: string | null;
      percent_off: number | null;
      amount_off: number | null;
      currency: string | null;
      duration: string;
      duration_in_months: number | null;
      times_redeemed: number;
      max_redemptions: number | null;
      valid: boolean;
      created: number;
    }>;
  }>('/coupons', { limit: String(Math.min(limit, 100)) });

  return { data: result.data, isMock: false };
}

export async function createCoupon(params: {
  name?: string;
  percentOff?: number;
  amountOff?: number;
  currency?: string;
  duration: string;
  durationInMonths?: number;
  maxRedemptions?: number;
  expiresAt?: number;
}): Promise<{ data: StripeCoupon; isMock: boolean }> {
  if (IS_MOCK) {
    const coupon: StripeCoupon = {
      id: `mock_${Date.now()}`,
      name: params.name ?? null,
      percent_off: params.percentOff ?? null,
      amount_off: params.amountOff ?? null,
      currency: params.currency ?? null,
      duration: params.duration,
      duration_in_months: params.durationInMonths ?? null,
      times_redeemed: 0,
      max_redemptions: params.maxRedemptions ?? null,
      valid: true,
      created: Math.floor(Date.now() / 1000),
    };
    return { data: coupon, isMock: true };
  }

  const body: Record<string, string> = { duration: params.duration };
  if (params.name) body['name'] = params.name;
  if (params.percentOff !== undefined) body['percent_off'] = String(params.percentOff);
  if (params.amountOff !== undefined) {
    body['amount_off'] = String(params.amountOff);
    body['currency'] = params.currency ?? 'usd';
  }
  if (params.durationInMonths !== undefined) body['duration_in_months'] = String(params.durationInMonths);
  if (params.maxRedemptions !== undefined) body['max_redemptions'] = String(params.maxRedemptions);
  if (params.expiresAt !== undefined) body['redeem_by'] = String(params.expiresAt);

  const coupon = await stripePost<StripeCoupon>('/coupons', body);
  return { data: coupon, isMock: false };
}

export async function deleteCoupon(couponId: string): Promise<{ id: string; deleted: boolean; isMock: boolean }> {
  if (IS_MOCK) {
    return { id: couponId, deleted: true, isMock: true };
  }
  const result = await stripeDelete<{ id: string; deleted: boolean }>(`/coupons/${encodeURIComponent(couponId)}`);
  return { ...result, isMock: false };
}

export async function listInvoices(
  limit = 25,
  customerId?: string
): Promise<{ data: StripeInvoice[]; has_more: boolean; isMock: boolean }> {
  if (IS_MOCK) {
    const invoices = getMockInvoices(limit);
    const filtered = customerId
      ? invoices.filter((inv) => inv.customer === customerId)
      : invoices;
    return { data: filtered, has_more: false, isMock: true };
  }

  const params: Record<string, string> = {
    limit: String(Math.min(limit, 100)),
    expand: 'data.customer',
  };
  if (customerId) params['customer'] = customerId;

  const result = await stripeGet<{
    data: Array<{
      id: string;
      customer: { id: string; email?: string } | string;
      customer_email: string | null;
      amount_paid: number;
      amount_due: number;
      currency: string;
      status: string | null;
      created: number;
      period_start: number;
      period_end: number;
      subscription: string | null;
      hosted_invoice_url: string | null;
    }>;
    has_more: boolean;
  }>('/invoices', params);

  const data: StripeInvoice[] = result.data.map((inv) => ({
    id: inv.id,
    customer: typeof inv.customer === 'string' ? inv.customer : inv.customer.id,
    customer_email: inv.customer_email
      ?? (typeof inv.customer === 'object' ? (inv.customer.email ?? null) : null),
    amount_paid: inv.amount_paid,
    amount_due: inv.amount_due,
    currency: inv.currency,
    status: inv.status,
    created: inv.created,
    period_start: inv.period_start,
    period_end: inv.period_end,
    subscription: inv.subscription,
    hosted_invoice_url: inv.hosted_invoice_url,
  }));

  return { data, has_more: result.has_more, isMock: false };
}

export async function createCustomerPortalSession(
  customerId: string,
  returnUrl: string
): Promise<{ url: string; isMock: boolean }> {
  if (IS_MOCK) {
    return {
      url: `${returnUrl}?mock_portal=1&customer=${customerId}`,
      isMock: true,
    };
  }

  const result = await stripePost<{ url: string }>('/billing_portal/sessions', {
    customer: customerId,
    return_url: returnUrl,
  });

  return { url: result.url, isMock: false };
}
