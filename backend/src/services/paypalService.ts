// ============================================================
// NEUROTEK AI — PayPal REST API v2 Wrapper (no SDK, native fetch)
// ============================================================

const PAYPAL_BASE =
  process.env.PAYPAL_SANDBOX === 'false'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

const IS_MOCK =
  !process.env.PAYPAL_CLIENT_ID || process.env.PAYPAL_CLIENT_ID === '';

/** Whether PayPal is properly configured with real credentials */
export const isPayPalConfigured = !IS_MOCK;

// ── Token cache ───────────────────────────────────────────────
let _cachedToken: string | null = null;
let _tokenExpiry = 0;

// ── Types ─────────────────────────────────────────────────────
export interface PayPalOrder {
  id: string;
  status: 'CREATED' | 'SAVED' | 'APPROVED' | 'VOIDED' | 'COMPLETED' | 'PAYER_ACTION_REQUIRED';
  links: Array<{ href: string; rel: string; method: string }>;
}

export interface PayPalCapture {
  id: string;
  status: 'COMPLETED' | 'DECLINED' | 'PARTIALLY_REFUNDED' | 'PENDING' | 'REFUNDED' | 'FAILED';
  purchase_units: Array<{
    payments?: {
      captures?: Array<{ id: string; status: string; amount: { value: string; currency_code: string } }>;
    };
  }>;
  links: Array<{ href: string; rel: string; method: string }>;
}

export interface PayPalRefund {
  id: string;
  status: 'CANCELLED' | 'PENDING' | 'COMPLETED' | 'FAILED';
  amount?: { value: string; currency_code: string };
  note_to_payer?: string;
}

export interface PayPalSubscription {
  id: string;
  status: 'APPROVAL_PENDING' | 'APPROVED' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | 'EXPIRED';
  plan_id: string;
  links: Array<{ href: string; rel: string; method: string }>;
}

// ── Mock helper ───────────────────────────────────────────────
function mockId(prefix: string): string {
  return `${prefix}MOCK${Math.random().toString(36).slice(2, 12).toUpperCase()}`;
}

// ── Access token ──────────────────────────────────────────────
export async function getAccessToken(): Promise<string> {
  if (_cachedToken && Date.now() < _tokenExpiry) return _cachedToken;

  if (IS_MOCK) {
    _cachedToken = 'mock_paypal_access_token';
    _tokenExpiry = Date.now() + 3600_000;
    return _cachedToken;
  }

  const clientId = process.env.PAYPAL_CLIENT_ID ?? '';
  const secret = process.env.PAYPAL_SECRET ?? '';
  const credentials = Buffer.from(`${clientId}:${secret}`).toString('base64');

  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    throw new Error(`PayPal token error: ${res.status}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  _cachedToken = data.access_token;
  _tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return _cachedToken;
}

// ── Authenticated request ─────────────────────────────────────
async function paypalRequest<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown
): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${PAYPAL_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (method === 'DELETE' || res.status === 204) {
    return undefined as unknown as T;
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PayPal ${method} ${path} failed (${res.status}): ${err}`);
  }

  return res.json() as Promise<T>;
}

// ── Public API ────────────────────────────────────────────────

export async function createOrder(
  amountUSD: string,
  currency: string,
  description: string
): Promise<PayPalOrder> {
  if (IS_MOCK) {
    const id = mockId('');
    return {
      id,
      status: 'CREATED',
      links: [
        { href: `https://www.sandbox.paypal.com/checkoutnow?token=${id}`, rel: 'approve', method: 'GET' },
        { href: `${PAYPAL_BASE}/v2/checkout/orders/${id}`, rel: 'self', method: 'GET' },
        { href: `${PAYPAL_BASE}/v2/checkout/orders/${id}/capture`, rel: 'capture', method: 'POST' },
      ],
    };
  }

  return paypalRequest<PayPalOrder>('POST', '/v2/checkout/orders', {
    intent: 'CAPTURE',
    purchase_units: [
      {
        description,
        amount: {
          currency_code: currency.toUpperCase(),
          value: amountUSD,
        },
      },
    ],
  });
}

export async function captureOrder(orderId: string): Promise<PayPalCapture> {
  if (IS_MOCK) {
    return {
      id: orderId,
      status: 'COMPLETED',
      purchase_units: [
        {
          payments: {
            captures: [
              {
                id: mockId('CAP'),
                status: 'COMPLETED',
                amount: { value: '9.99', currency_code: 'USD' },
              },
            ],
          },
        },
      ],
      links: [],
    };
  }
  return paypalRequest<PayPalCapture>('POST', `/v2/checkout/orders/${orderId}/capture`);
}

export async function refundCapture(
  captureId: string,
  amountUSD?: string,
  note?: string
): Promise<PayPalRefund> {
  if (IS_MOCK) {
    return {
      id: mockId('REF'),
      status: 'COMPLETED',
      amount: amountUSD ? { value: amountUSD, currency_code: 'USD' } : undefined,
      note_to_payer: note,
    };
  }

  const body: Record<string, unknown> = {};
  if (amountUSD) body['amount'] = { value: amountUSD, currency_code: 'USD' };
  if (note) body['note_to_payer'] = note;

  return paypalRequest<PayPalRefund>('POST', `/v2/payments/captures/${captureId}/refund`, body);
}

export async function createSubscription(
  planId: string,
  returnUrl: string,
  cancelUrl: string
): Promise<PayPalSubscription> {
  if (IS_MOCK) {
    const id = mockId('SUB');
    return {
      id,
      status: 'APPROVAL_PENDING',
      plan_id: planId,
      links: [
        { href: `https://www.sandbox.paypal.com/webapps/billing/subscriptions/activate?ba_token=${id}`, rel: 'approve', method: 'GET' },
        { href: `${PAYPAL_BASE}/v1/billing/subscriptions/${id}`, rel: 'self', method: 'GET' },
      ],
    };
  }

  return paypalRequest<PayPalSubscription>('POST', '/v1/billing/subscriptions', {
    plan_id: planId,
    application_context: {
      return_url: returnUrl,
      cancel_url: cancelUrl,
    },
  });
}

export async function cancelSubscription(
  subscriptionId: string,
  reason: string
): Promise<void> {
  if (IS_MOCK) return;
  await paypalRequest<void>('POST', `/v1/billing/subscriptions/${subscriptionId}/cancel`, { reason });
}

export async function verifyWebhookEvent(
  headers: Record<string, string>,
  rawBody: string
): Promise<boolean> {
  if (IS_MOCK) return true;

  try {
    const token = await getAccessToken();
    const webhookId = process.env.PAYPAL_WEBHOOK_ID ?? '';

    const res = await fetch(`${PAYPAL_BASE}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        auth_algo: headers['paypal-auth-algo'],
        cert_url: headers['paypal-cert-url'],
        transmission_id: headers['paypal-transmission-id'],
        transmission_sig: headers['paypal-transmission-sig'],
        transmission_time: headers['paypal-transmission-time'],
        webhook_id: webhookId,
        webhook_event: JSON.parse(rawBody),
      }),
    });

    if (!res.ok) return false;
    const data = await res.json() as { verification_status: string };
    return data.verification_status === 'SUCCESS';
  } catch {
    return false;
  }
}
