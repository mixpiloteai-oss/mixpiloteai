// ============================================================
// NEUROTEK AI — Stripe REST API Wrapper (no SDK, native fetch)
// ============================================================
import { createHmac } from 'crypto';

const STRIPE_API = 'https://api.stripe.com/v1';
const SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder';

const IS_MOCK = !process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_placeholder';

/** Whether Stripe is properly configured with a real API key */
export const isStripeConfigured = !IS_MOCK;

// ── Price IDs ─────────────────────────────────────────────────
export const STRIPE_PRICES = {
  pro_monthly:    'price_pro_monthly_999',
  pro_annual:     'price_pro_annual_7999',
  studio_monthly: 'price_studio_monthly_2499',
  studio_annual:  'price_studio_annual_19999',
  label_monthly:  'price_label_monthly_7999',
  label_annual:   'price_label_annual_63999',
  credits_100:    'price_credits_100_499',
  credits_500:    'price_credits_500_1999',
  credits_2000:   'price_credits_2000_6999',
} as const;

// ── Stripe Types ──────────────────────────────────────────────
export interface StripeCustomer {
  id: string;
  object: 'customer';
  email: string;
  name: string;
  metadata: Record<string, string>;
  created: number;
  livemode: boolean;
}

export interface StripePaymentIntent {
  id: string;
  object: 'payment_intent';
  amount: number;
  currency: string;
  status: 'requires_payment_method' | 'requires_confirmation' | 'requires_action' | 'processing' | 'requires_capture' | 'canceled' | 'succeeded';
  client_secret: string;
  customer: string | null;
  metadata: Record<string, string>;
  created: number;
  livemode: boolean;
}

export interface StripeSubscription {
  id: string;
  object: 'subscription';
  customer: string;
  status: 'active' | 'past_due' | 'unpaid' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'trialing';
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
  cancel_at: number | null;
  trial_end: number | null;
  items: {
    data: Array<{
      id: string;
      price: { id: string; product: string; unit_amount: number; currency: string };
    }>;
  };
  metadata: Record<string, string>;
  created: number;
  livemode: boolean;
}

export interface StripeRefund {
  id: string;
  object: 'refund';
  amount: number;
  currency: string;
  payment_intent: string;
  reason: string | null;
  status: 'pending' | 'requires_action' | 'succeeded' | 'failed' | 'canceled';
  created: number;
}

// ── Core HTTP helper ──────────────────────────────────────────
async function stripeRequest<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: Record<string, string>,
  idempotencyKey?: string
): Promise<T> {
  const url =
    method === 'GET' && body
      ? `${STRIPE_API}${path}?${new URLSearchParams(body).toString()}`
      : `${STRIPE_API}${path}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${SECRET_KEY}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  // Idempotency key prevents duplicate charges on retry
  if (method === 'POST' && idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: method === 'POST' && body ? new URLSearchParams(body).toString() : undefined,
  });

  if (!res.ok) {
    const err = await res.json() as { error?: { message?: string } };
    throw new Error(`Stripe ${method} ${path} failed (${res.status}): ${err?.error?.message ?? 'unknown'}`);
  }

  return res.json() as Promise<T>;
}

// ── Mock helpers ──────────────────────────────────────────────
function mockId(prefix: string): string {
  return `${prefix}_mock_${Math.random().toString(36).slice(2, 12)}`;
}
const now = () => Math.floor(Date.now() / 1000);

// ── Public API ────────────────────────────────────────────────

export async function createCustomer(
  email: string,
  name: string,
  metadata?: Record<string, string>
): Promise<StripeCustomer> {
  if (IS_MOCK) {
    return {
      id: mockId('cus'),
      object: 'customer',
      email,
      name,
      metadata: metadata ?? {},
      created: now(),
      livemode: false,
    };
  }
  const params: Record<string, string> = { email, name };
  if (metadata) {
    for (const [k, v] of Object.entries(metadata)) {
      params[`metadata[${k}]`] = v;
    }
  }
  return stripeRequest<StripeCustomer>('POST', '/customers', params);
}

export async function createPaymentIntent(
  amountCents: number,
  currency: string,
  customerId: string,
  metadata?: Record<string, string>,
  idempotencyKey?: string
): Promise<StripePaymentIntent> {
  if (IS_MOCK) {
    return {
      id: mockId('pi'),
      object: 'payment_intent',
      amount: amountCents,
      currency: currency.toLowerCase(),
      status: 'requires_payment_method',
      client_secret: `${mockId('pi')}_secret_mock`,
      customer: customerId,
      metadata: metadata ?? {},
      created: now(),
      livemode: false,
    };
  }
  const params: Record<string, string> = {
    amount: String(amountCents),
    currency: currency.toLowerCase(),
    customer: customerId,
  };
  if (metadata) {
    for (const [k, v] of Object.entries(metadata)) {
      params[`metadata[${k}]`] = v;
    }
  }
  return stripeRequest<StripePaymentIntent>('POST', '/payment_intents', params, idempotencyKey);
}

export async function confirmPaymentIntent(
  intentId: string,
  paymentMethodId: string
): Promise<StripePaymentIntent> {
  if (IS_MOCK) {
    return {
      id: intentId,
      object: 'payment_intent',
      amount: 999,
      currency: 'usd',
      status: 'succeeded',
      client_secret: `${intentId}_secret_mock`,
      customer: null,
      metadata: {},
      created: now(),
      livemode: false,
    };
  }
  return stripeRequest<StripePaymentIntent>('POST', `/payment_intents/${intentId}/confirm`, {
    payment_method: paymentMethodId,
  });
}

export async function retrievePaymentIntent(intentId: string): Promise<StripePaymentIntent> {
  if (IS_MOCK) {
    return {
      id: intentId,
      object: 'payment_intent',
      amount: 999,
      currency: 'usd',
      status: 'succeeded',
      client_secret: `${intentId}_secret_mock`,
      customer: null,
      metadata: {},
      created: now(),
      livemode: false,
    };
  }
  return stripeRequest<StripePaymentIntent>('GET', `/payment_intents/${intentId}`);
}

export async function createSubscription(
  customerId: string,
  priceId: string,
  trialDays?: number,
  couponId?: string
): Promise<StripeSubscription> {
  if (IS_MOCK) {
    const periodStart = now();
    return {
      id: mockId('sub'),
      object: 'subscription',
      customer: customerId,
      status: trialDays ? 'trialing' : 'active',
      current_period_start: periodStart,
      current_period_end: periodStart + 30 * 86400,
      cancel_at_period_end: false,
      cancel_at: null,
      trial_end: trialDays ? periodStart + trialDays * 86400 : null,
      items: {
        data: [
          {
            id: mockId('si'),
            price: { id: priceId, product: 'prod_mock', unit_amount: 999, currency: 'usd' },
          },
        ],
      },
      metadata: {},
      created: periodStart,
      livemode: false,
    };
  }
  const params: Record<string, string> = {
    customer: customerId,
    'items[0][price]': priceId,
  };
  if (trialDays) params['trial_period_days'] = String(trialDays);
  if (couponId) params['coupon'] = couponId;
  return stripeRequest<StripeSubscription>('POST', '/subscriptions', params);
}

export async function cancelSubscription(
  subscriptionId: string,
  immediately = false
): Promise<StripeSubscription> {
  if (IS_MOCK) {
    const periodStart = now();
    return {
      id: subscriptionId,
      object: 'subscription',
      customer: 'cus_mock',
      status: immediately ? 'canceled' : 'active',
      current_period_start: periodStart,
      current_period_end: periodStart + 30 * 86400,
      cancel_at_period_end: !immediately,
      cancel_at: immediately ? null : periodStart + 30 * 86400,
      trial_end: null,
      items: { data: [] },
      metadata: {},
      created: periodStart,
      livemode: false,
    };
  }
  if (immediately) {
    return stripeRequest<StripeSubscription>('POST', `/subscriptions/${subscriptionId}/cancel`);
  }
  return stripeRequest<StripeSubscription>('POST', `/subscriptions/${subscriptionId}`, {
    cancel_at_period_end: 'true',
  });
}

export async function upgradeSubscription(
  subscriptionId: string,
  newPriceId: string
): Promise<StripeSubscription> {
  if (IS_MOCK) {
    const periodStart = now();
    return {
      id: subscriptionId,
      object: 'subscription',
      customer: 'cus_mock',
      status: 'active',
      current_period_start: periodStart,
      current_period_end: periodStart + 30 * 86400,
      cancel_at_period_end: false,
      cancel_at: null,
      trial_end: null,
      items: {
        data: [
          {
            id: mockId('si'),
            price: { id: newPriceId, product: 'prod_mock', unit_amount: 999, currency: 'usd' },
          },
        ],
      },
      metadata: {},
      created: periodStart,
      livemode: false,
    };
  }
  // Retrieve existing sub first to get item ID
  const sub = await stripeRequest<StripeSubscription>('GET', `/subscriptions/${subscriptionId}`);
  const itemId = sub.items.data[0]?.id;
  if (!itemId) throw new Error('Subscription has no items');
  return stripeRequest<StripeSubscription>('POST', `/subscriptions/${subscriptionId}`, {
    [`items[0][id]`]: itemId,
    [`items[0][price]`]: newPriceId,
    proration_behavior: 'create_prorations',
  });
}

export async function createRefund(
  paymentIntentId: string,
  amountCents?: number,
  reason?: string
): Promise<StripeRefund> {
  if (IS_MOCK) {
    return {
      id: mockId('re'),
      object: 'refund',
      amount: amountCents ?? 999,
      currency: 'usd',
      payment_intent: paymentIntentId,
      reason: reason ?? null,
      status: 'succeeded',
      created: now(),
    };
  }
  const params: Record<string, string> = { payment_intent: paymentIntentId };
  if (amountCents) params['amount'] = String(amountCents);
  if (reason) params['reason'] = reason;
  return stripeRequest<StripeRefund>('POST', '/refunds', params);
}

// ── Checkout Session ──────────────────────────────────────────

export interface CheckoutSessionParams {
  userId: string
  customerEmail: string
  mode: 'payment' | 'subscription'
  lineItems: Array<{
    priceId?: string
    amount?: number
    currency?: string
    name?: string
    description?: string
    quantity: number
  }>
  successUrl: string
  cancelUrl: string
  metadata?: Record<string, string>
  couponId?: string
  trialDays?: number
}

export interface CheckoutSessionResult {
  id: string
  url: string
  status?: string
}

export async function createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSessionResult> {
  if (IS_MOCK) {
    const id = mockId('cs')
    return {
      id,
      url: `${params.successUrl.replace('{CHECKOUT_SESSION_ID}', id)}&mock=1`,
      status: 'open',
    }
  }

  const bodyParams: Record<string, string> = {
    mode: params.mode,
    customer_email: params.customerEmail,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  }

  params.lineItems.forEach((item, i) => {
    if (item.priceId) {
      bodyParams[`line_items[${i}][price]`] = item.priceId
    } else {
      bodyParams[`line_items[${i}][price_data][currency]`] = item.currency ?? 'usd'
      bodyParams[`line_items[${i}][price_data][unit_amount]`] = String(item.amount)
      bodyParams[`line_items[${i}][price_data][product_data][name]`] = item.name ?? 'Neurotek AI'
      if (item.description) {
        bodyParams[`line_items[${i}][price_data][product_data][description]`] = item.description
      }
    }
    bodyParams[`line_items[${i}][quantity]`] = String(item.quantity)
  })

  bodyParams[`metadata[userId]`] = params.userId
  if (params.metadata) {
    for (const [k, v] of Object.entries(params.metadata)) {
      bodyParams[`metadata[${k}]`] = v
    }
  }

  if (params.trialDays && params.mode === 'subscription') {
    bodyParams['subscription_data[trial_period_days]'] = String(params.trialDays)
  }

  if (params.couponId) {
    bodyParams['discounts[0][coupon]'] = params.couponId
  }

  return stripeRequest<{ id: string; url: string; status: string }>('POST', '/checkout/sessions', bodyParams)
}

export async function retrieveCheckoutSession(sessionId: string): Promise<{
  id: string
  status: string
  payment_status: string
  customer_email: string | null
  metadata: Record<string, string>
  subscription?: string
  payment_intent?: string
  amount_total?: number
  currency?: string
}> {
  if (IS_MOCK) {
    return {
      id: sessionId,
      status: 'complete',
      payment_status: 'paid',
      customer_email: null,
      metadata: { userId: 'demo' },
    }
  }
  return stripeRequest(`GET`, `/checkout/sessions/${encodeURIComponent(sessionId)}`)
}

export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string
): boolean {
  try {
    // Stripe signature format: t=<timestamp>,v1=<sig>
    const parts = Object.fromEntries(
      signature.split(',').map((p) => p.split('=') as [string, string])
    );
    const timestamp = parts['t'];
    const expected = parts['v1'];
    if (!timestamp || !expected) return false;

    // Fix 5: Replay attack protection — reject events older than 5 minutes
    const ts = parseInt(timestamp, 10);
    const nowSec = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSec - ts) > 300) return false;

    const payload = `${timestamp}.${rawBody}`;
    const computed = createHmac('sha256', secret).update(payload).digest('hex');
    return computed === expected;
  } catch {
    return false;
  }
}
