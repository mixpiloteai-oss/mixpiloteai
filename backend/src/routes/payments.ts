// ============================================================
// NEUROTEK AI — Payment REST API
// ============================================================
// Raw body needed for Stripe webhook signature verification.
// Register the raw body route BEFORE express.json() in index.ts:
//   app.post('/api/payments/stripe/webhook', express.raw({ type: '*/*' }), ...)
// ============================================================
import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { paymentsRateLimiter } from '../middleware/rateLimiter';
import { logSecurityEvent } from '../utils/securityLog';

import {
  createPaymentIntent,
  confirmPaymentIntent,
  createSubscription as stripeCreateSub,
  cancelSubscription as stripeCancelSub,
  upgradeSubscription as stripeUpgradeSub,
  createRefund as stripeCreateRefund,
  verifyWebhookSignature,
  STRIPE_PRICES,
  createCheckoutSession,
  retrieveCheckoutSession,
} from '../services/stripeService';

import {
  syncSubscriptionToDb,
  getSubscriptionFromDb,
  logPaymentEvent,
} from '../lib/paymentSync';

import { asyncHandler } from '../middleware/asyncHandler';
import { getCreditPack } from '../lib/creditPackManager';

import {
  createOrder as ppCreateOrder,
  captureOrder as ppCaptureOrder,
  createSubscription as ppCreateSub,
  cancelSubscription as ppCancelSub,
  refundCapture as ppRefundCapture,
  verifyWebhookEvent,
} from '../services/paypalService';

import { calculateVAT } from '../services/vatService';

import { checkFraud, recordPaymentFailure } from '../services/fraudService';

import {
  validateCoupon,
  redeemCoupon,
  applyCouponToAmount,
} from '../services/couponService';

import {
  createInvoice,
  getInvoice,
  listUserInvoices,
  markPaid,
  markRefunded,
  getInvoiceAsJSON,
} from '../services/invoiceService';

import { log, getUserHistory } from '../services/paymentLogService';
import { recordWebhookEvent } from '../services/stripeAdminService';
import { recordPayPalWebhookEvent } from '../services/paypalAdminService';
import { logger } from '../utils/logger';

const router = Router();

// Apply strict per-user/IP rate limit to all payment endpoints
// EXCEPT webhook callbacks, which originate from Stripe / PayPal.
router.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/stripe/webhook' || req.path === '/paypal/webhook') {
    return next();
  }
  return paymentsRateLimiter(req, res, next);
});

// ── Helper: get IP address ─────────────────────────────────────
function getIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim() ?? '0.0.0.0';
  return req.socket.remoteAddress ?? '0.0.0.0';
}


// ── Plan to Stripe price mapping ──────────────────────────────
const PLAN_TO_STRIPE: Record<string, string> = {
  pro:            STRIPE_PRICES.pro_monthly,
  pro_monthly:    STRIPE_PRICES.pro_monthly,
  pro_annual:     STRIPE_PRICES.pro_annual,
  studio:         STRIPE_PRICES.studio_monthly,
  studio_monthly: STRIPE_PRICES.studio_monthly,
  studio_annual:  STRIPE_PRICES.studio_annual,
  label:          STRIPE_PRICES.label_monthly,
  label_monthly:  STRIPE_PRICES.label_monthly,
  label_annual:   STRIPE_PRICES.label_annual,
};

// ── In-memory "current subscription" state (demo) ─────────────
interface SubRecord {
  subscriptionId: string;
  planId: string;
  status: string;
  renewsAt: number;
  cancelAt: number | null;
  paymentMethod: 'stripe' | 'paypal';
}
const userSubscriptions = new Map<string, SubRecord>();

// ══════════════════════════════════════════════════════════════
// STRIPE ROUTES
// ══════════════════════════════════════════════════════════════

// POST /stripe/session — create Stripe Hosted Checkout session
router.post('/stripe/session', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const userEmail = req.user!.email;

  const {
    type = 'plan',
    planId,
    pkg,
    productId,
    productName,
    amountCents,
    annual = false,
    currency = 'usd',
    couponCode,
    successUrl,
    cancelUrl,
  } = req.body as {
    type?: string;
    planId?: string;
    pkg?: string;
    productId?: string;
    productName?: string;
    amountCents?: number;
    annual?: boolean;
    currency?: string;
    couponCode?: string;
    successUrl?: string;
    cancelUrl?: string;
  };

  let mode: 'payment' | 'subscription' = 'payment';
  let priceId: string | undefined;
  let customAmount: number | undefined;
  let description = 'Neurotek AI';
  let metaPlanId = '';

  if (type === 'plan' && planId) {
    mode = 'subscription';
    const priceKey = `${planId}_${annual ? 'annual' : 'monthly'}` as keyof typeof STRIPE_PRICES;
    priceId = STRIPE_PRICES[priceKey] ?? STRIPE_PRICES.pro_monthly;
    metaPlanId = planId;
    description = `Neurotek AI ${planId.charAt(0).toUpperCase() + planId.slice(1)} ${annual ? 'Annual' : 'Monthly'}`;
  } else if (type === 'credits' && pkg) {
    const pack = getCreditPack(pkg);
    if (!pack) {
      res.status(400).json({ error: 'Invalid credit package' });
      return;
    }
    customAmount = pack.amountCents;
    description = `${pack.credits} AI Credits`;
    metaPlanId = `credits_${pkg}`;
  } else if (type === 'marketplace' && amountCents) {
    customAmount = amountCents;
    description = productName ?? 'Marketplace Item';
    metaPlanId = `marketplace_${productId ?? 'item'}`;
  } else {
    res.status(400).json({ error: 'Invalid payment parameters' });
    return;
  }

  const baseUrl = process.env.FRONTEND_URL ?? 'https://app.neurotek.ai';
  const session = await createCheckoutSession({
    userId,
    customerEmail: userEmail,
    mode,
    lineItems: [{
      priceId,
      amount: customAmount,
      currency,
      name: description,
      quantity: 1,
    }],
    successUrl: successUrl ?? `${baseUrl}/checkout?success=1&session_id={CHECKOUT_SESSION_ID}&type=${type}`,
    cancelUrl:  cancelUrl  ?? `${baseUrl}/checkout?canceled=1&type=${type}`,
    metadata: {
      userId,
      type,
      planId: metaPlanId,
    },
    couponId: couponCode,
  });

  await logPaymentEvent({
    user_id: userId,
    event_type: 'checkout_session_created',
    payment_method: 'stripe',
    plan_id: metaPlanId,
    stripe_session_id: session.id,
    success: true,
  });

  res.json({ success: true, url: session.url, sessionId: session.id });
}));

// GET /stripe/session/:id — retrieve session status (for success page)
router.get('/stripe/session/:id', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const sessionId = req.params['id'];
  if (!sessionId) {
    res.status(400).json({ error: 'Session ID required' });
    return;
  }

  const session = await retrieveCheckoutSession(sessionId);

  if (session.metadata?.userId && session.metadata.userId !== userId) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  res.json({
    success: true,
    status: session.status,
    paymentStatus: session.payment_status,
    planId: session.metadata?.planId,
    type: session.metadata?.type,
  });
}));

// POST /stripe/intent
router.post('/stripe/intent', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const ip = getIP(req);
  const {
    amountCents,
    currency = 'usd',
    productType = 'marketplace',
    planId,
    country = 'US',
    vatNumber,
  } = req.body as {
    amountCents: number;
    currency?: string;
    productType?: 'subscription' | 'marketplace' | 'credits' | 'plugin';
    planId?: string;
    country?: string;
    vatNumber?: string;
  };

  if (!amountCents || typeof amountCents !== 'number') {
    res.status(400).json({ success: false, error: 'amountCents is required' });
    return;
  }

  logSecurityEvent({
    type: 'payment_attempt',
    severity: 'info',
    ip,
    userId,
    route: '/api/payments/stripe/intent',
    meta: { amountCents, currency, productType, planId, country },
  });

  // Fraud check
  const fraud = checkFraud({
    userId,
    email: req.user!.email,
    amountCents,
    ipAddress: ip,
    countryCode: country,
    productType,
  });

  if (fraud.decision === 'block') {
    log({ userId, event: 'fraud_blocked', amountCents, ipAddress: ip, success: false, errorMessage: fraud.reasons.join('; ') });
    res.status(403).json({ success: false, error: 'Transaction blocked', reasons: fraud.reasons });
    return;
  }

  // VAT calculation
  const vatCalc = calculateVAT(amountCents, country, vatNumber);

  // Create payment intent
  try {
    const intent = await createPaymentIntent(vatCalc.total, currency, userId, {
      userId,
      planId: planId ?? '',
      productType,
    });

    log({ userId, event: 'payment_intent_created', amountCents: vatCalc.total, currency, paymentMethod: 'stripe', planId, ipAddress: ip, success: true });

    res.json({
      success: true,
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      vatCalculation: vatCalc,
      total: vatCalc.total,
      fraudDecision: fraud.decision,
      requiresCaptcha: fraud.requiresCaptcha,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    logger.error('[payments] stripe/intent', { error: err instanceof Error ? err.message : String(err) });
    recordPaymentFailure(userId);
    log({ userId, event: 'payment_failed', amountCents, currency, paymentMethod: 'stripe', planId, ipAddress: ip, success: false, errorMessage: msg });
    res.status(500).json({ success: false, error: 'Payment processing failed' });
  }
});

// POST /stripe/confirm
router.post('/stripe/confirm', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { paymentIntentId, paymentMethodId } = req.body as {
    paymentIntentId: string;
    paymentMethodId: string;
  };

  if (!paymentIntentId || !paymentMethodId) {
    res.status(400).json({ success: false, error: 'paymentIntentId and paymentMethodId required' });
    return;
  }

  try {
    const intent = await confirmPaymentIntent(paymentIntentId, paymentMethodId);

    log({ userId, event: 'payment_succeeded', amountCents: intent.amount, currency: intent.currency, paymentMethod: 'stripe', stripeIntentId: intent.id, success: true });

    const invoice = createInvoice({
      userId,
      customerName: req.user!.name,
      customerEmail: req.user!.email,
      customerAddress: { line1: '', city: '', country: 'US', postalCode: '' },
      lineItems: [{ description: 'NeuroTek AI Purchase', quantity: 1, unitPriceCents: intent.amount, totalCents: intent.amount }],
      subtotalCents: intent.amount,
      vatCents: 0,
      vatRate: 0,
      totalCents: intent.amount,
      currency: 'USD',
      status: 'paid',
      paymentMethod: 'stripe',
      paymentIntentId: intent.id,
      paidAt: Date.now(),
    });

    res.json({ success: true, invoiceId: invoice.id, status: intent.status });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    logger.error('[payments] stripe/confirm', { error: err instanceof Error ? err.message : String(err) });
    recordPaymentFailure(userId);
    log({ userId, event: 'payment_failed', paymentMethod: 'stripe', stripeIntentId: paymentIntentId, success: false, errorMessage: msg });
    res.status(500).json({ success: false, error: 'Payment processing failed' });
  }
});

// POST /stripe/webhook (raw body — registered in index.ts before JSON parser)
router.post('/stripe/webhook', asyncHandler(async (req: Request, res: Response) => {
  const signature = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET ?? '';

  type RawBodyRequest = Request & { rawBody?: Buffer };
  const rawBodyReq = req as RawBodyRequest;

  // rawBody may be attached by the pre-handler in index.ts, or req.body is the Buffer
  const rawBody = rawBodyReq.rawBody ?? (Buffer.isBuffer(req.body) ? req.body : null);

  if (secret && typeof signature === 'string' && rawBody) {
    const valid = verifyWebhookSignature(rawBody.toString('utf8'), signature, secret);
    if (!valid) {
      recordWebhookEvent('signature_verification', 'failed', 'Invalid signature');
      res.status(400).json({ error: 'Invalid signature' });
      return;
    }
  }

  let event: { id?: string; type: string; livemode?: boolean; data: { object: Record<string, unknown> } };
  try {
    const bodyStr = rawBody ? rawBody.toString('utf8') : JSON.stringify(req.body);
    event = JSON.parse(bodyStr) as typeof event;
  } catch {
    recordWebhookEvent('unknown', 'failed', 'Invalid JSON');
    res.status(400).json({ error: 'Invalid JSON' });
    return;
  }

  const eventType = event.type as string;
  const eventData = event.data?.object as Record<string, unknown>;

  if (eventType === 'checkout.session.completed') {
    const sessionObj = eventData;
    const userId = (sessionObj['metadata'] as Record<string, string>)?.['userId'];
    const planId  = (sessionObj['metadata'] as Record<string, string>)?.['planId'] ?? '';
    const sessionStatus = sessionObj['payment_status'] as string;
    const subId   = sessionObj['subscription'] as string | undefined;
    const amountTotal = sessionObj['amount_total'] as number | undefined;

    if (userId && sessionStatus === 'paid') {
      await syncSubscriptionToDb({
        user_id: userId,
        stripe_subscription_id: subId,
        plan_id: planId.split('_')[0] ?? 'pro',
        status: 'active',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end:   Math.floor(Date.now() / 1000) + 30 * 86400,
        payment_method: 'stripe',
      });

      await logPaymentEvent({
        user_id: userId,
        event_type: 'checkout_completed',
        amount_cents: amountTotal,
        currency: (sessionObj['currency'] as string) ?? 'usd',
        payment_method: 'stripe',
        plan_id: planId,
        stripe_session_id: sessionObj['id'] as string,
        success: true,
      });
    }
  } else if (eventType === 'payment_intent.succeeded') {
    const obj = eventData;
    const userId = (obj['metadata'] as Record<string, string>)?.['userId'] ?? 'unknown';
    const intentId = obj['id'] as string;
    const amount = obj['amount'] as number;
    log({ userId, event: 'payment_succeeded', amountCents: amount, currency: obj['currency'] as string, paymentMethod: 'stripe', stripeIntentId: intentId, success: true });
  } else if (eventType === 'customer.subscription.deleted') {
    const subObj = eventData;
    const userId = (subObj['metadata'] as Record<string, string>)?.['userId'];
    if (userId) {
      await syncSubscriptionToDb({
        user_id: userId,
        stripe_subscription_id: subObj['id'] as string,
        plan_id: 'free',
        status: 'canceled',
        payment_method: 'stripe',
      });
      await logPaymentEvent({ user_id: userId, event_type: 'subscription_canceled', payment_method: 'stripe', success: true });
    } else {
      const customerId = subObj['customer'] as string;
      log({ userId: customerId, event: 'subscription_cancelled', paymentMethod: 'stripe', success: true });
    }
  } else if (eventType === 'invoice.payment_succeeded') {
    const invObj = eventData;
    const userId = (invObj['subscription_details'] as Record<string, unknown>)?.['metadata']
      ? ((invObj['subscription_details'] as Record<string, unknown>)['metadata'] as Record<string, string>)?.['userId']
      : undefined;
    if (userId) {
      const periodEnd = invObj['lines']
        ? ((invObj['lines'] as { data: Array<{ period: { end: number } }> }).data[0]?.period?.end)
        : undefined;
      await syncSubscriptionToDb({
        user_id: userId,
        plan_id: 'pro',
        status: 'active',
        current_period_end: periodEnd,
        payment_method: 'stripe',
      });
      await logPaymentEvent({
        user_id: userId,
        event_type: 'subscription_renewed',
        amount_cents: invObj['amount_paid'] as number,
        payment_method: 'stripe',
        success: true,
      });
    } else {
      const customerId = invObj['customer'] as string;
      const amount = invObj['amount_paid'] as number;
      log({ userId: customerId, event: 'subscription_renewed', amountCents: amount, paymentMethod: 'stripe', success: true });
    }
  } else if (eventType === 'invoice.payment_failed') {
    const invObj = eventData;
    const userId = (invObj['metadata'] as Record<string, string>)?.['userId'];
    if (userId) {
      await syncSubscriptionToDb({
        user_id: userId,
        plan_id: 'unknown',
        status: 'past_due',
        payment_method: 'stripe',
      });
      await logPaymentEvent({ user_id: userId, event_type: 'payment_failed', payment_method: 'stripe', success: false });
    }
  }

  recordWebhookEvent(eventType, 'success', undefined, event.id, event.livemode);
  res.json({ received: true });
}));

// ══════════════════════════════════════════════════════════════
// PAYPAL ROUTES
// ══════════════════════════════════════════════════════════════

// Map PayPal plan IDs to internal plan names
function resolvePlanIdFromPayPal(paypalPlanId: string): string {
  const env = process.env
  const map: Record<string, string> = {
    [env['PAYPAL_PLAN_PRO_MONTHLY']     ?? 'P-pro-monthly']:    'pro',
    [env['PAYPAL_PLAN_STUDIO_MONTHLY']  ?? 'P-studio-monthly']: 'studio',
    [env['PAYPAL_PLAN_LABEL_MONTHLY']   ?? 'P-label-monthly']:  'label',
  }
  return map[paypalPlanId] ?? 'pro'
}

// POST /paypal/create-order
router.post('/paypal/create-order', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const ip = getIP(req);
  const { amountUSD, description = 'NeuroTek AI Purchase', productType = 'marketplace' } = req.body as {
    amountUSD: string;
    description?: string;
    productType?: 'subscription' | 'marketplace' | 'credits' | 'plugin';
  };

  if (!amountUSD) {
    res.status(400).json({ success: false, error: 'amountUSD is required' });
    return;
  }

  const amountCents = Math.round(parseFloat(amountUSD) * 100);

  const fraud = checkFraud({
    userId,
    email: req.user!.email,
    amountCents,
    ipAddress: ip,
    countryCode: 'US',
    productType,
  });

  if (fraud.decision === 'block') {
    log({ userId, event: 'fraud_blocked', amountCents, ipAddress: ip, success: false, errorMessage: fraud.reasons.join('; ') });
    res.status(403).json({ success: false, error: 'Transaction blocked', reasons: fraud.reasons });
    return;
  }

  try {
    const order = await ppCreateOrder(amountUSD, 'USD', description);
    const approvalLink = order.links.find((l) => l.rel === 'approve')?.href ?? '';

    log({ userId, event: 'payment_intent_created', amountCents, paymentMethod: 'paypal', paypalOrderId: order.id, ipAddress: ip, success: true });

    res.json({ success: true, orderId: order.id, approvalUrl: approvalLink });
  } catch (err) {
    logger.error('[payments] paypal/create-order', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ success: false, error: 'Payment processing failed' });
  }
});

// POST /paypal/capture
router.post('/paypal/capture', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { orderId } = req.body as { orderId: string };

  if (!orderId) {
    res.status(400).json({ success: false, error: 'orderId is required' });
    return;
  }

  try {
    const capture = await ppCaptureOrder(orderId);
    const captureData = capture.purchase_units[0]?.payments?.captures?.[0];
    const amountCents = captureData?.amount
      ? Math.round(parseFloat(captureData.amount.value) * 100)
      : 0;

    log({ userId, event: 'payment_succeeded', amountCents, currency: 'usd', paymentMethod: 'paypal', paypalOrderId: orderId, success: true });

    await logPaymentEvent({
      user_id: userId,
      event_type: 'paypal_order_captured',
      amount_cents: amountCents,
      currency: 'usd',
      payment_method: 'paypal',
      success: true,
      metadata: { orderId },
    })

    const invoice = createInvoice({
      userId,
      customerName: req.user!.name,
      customerEmail: req.user!.email,
      customerAddress: { line1: '', city: '', country: 'US', postalCode: '' },
      lineItems: [{ description: 'NeuroTek AI Purchase (PayPal)', quantity: 1, unitPriceCents: amountCents, totalCents: amountCents }],
      subtotalCents: amountCents,
      vatCents: 0,
      vatRate: 0,
      totalCents: amountCents,
      currency: 'USD',
      status: 'paid',
      paymentMethod: 'paypal',
      paidAt: Date.now(),
    });

    res.json({ success: true, invoiceId: invoice.id, captureStatus: capture.status });
  } catch (err) {
    logger.error('[payments] paypal/capture', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ success: false, error: 'Payment processing failed' });
  }
});

// POST /paypal/webhook
router.post('/paypal/webhook', asyncHandler(async (req: Request, res: Response) => {
  // Verify signature
  const headerMap = {
    'paypal-auth-algo':         req.headers['paypal-auth-algo'] as string ?? '',
    'paypal-cert-url':          req.headers['paypal-cert-url'] as string ?? '',
    'paypal-transmission-id':   req.headers['paypal-transmission-id'] as string ?? '',
    'paypal-transmission-sig':  req.headers['paypal-transmission-sig'] as string ?? '',
    'paypal-transmission-time': req.headers['paypal-transmission-time'] as string ?? '',
  }
  const rawBody = req.body instanceof Buffer ? req.body.toString('utf8') : JSON.stringify(req.body)

  const valid = await verifyWebhookEvent(headerMap, rawBody)
  if (!valid) {
    logger.warn('[paypal-webhook] invalid signature')
    recordPayPalWebhookEvent('signature_verification', 'failed', 'Invalid signature')
    // Still return 200 to avoid PayPal retries on signature issues
    res.json({ received: true })
    return
  }

  // Parse event
  let event: { event_type: string; resource: Record<string, unknown>; id: string; resource_type?: string }
  try {
    event = JSON.parse(rawBody) as typeof event
  } catch {
    recordPayPalWebhookEvent('unknown', 'failed', 'Invalid JSON')
    res.status(400).json({ error: 'Invalid JSON' })
    return
  }

  const { event_type, resource } = event
  const eventId = event.id ?? 'unknown'

  logger.info(`[paypal-webhook] event: ${event_type} id: ${eventId}`)

  try {
    if (event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      // One-time purchase completed
      const captureId = resource['id'] as string
      const orderId   = (resource['supplementary_data'] as Record<string, unknown>)?.['related_ids']
        ? ((resource['supplementary_data'] as Record<string,unknown>)['related_ids'] as Record<string,string>)?.['order_id']
        : undefined
      const amount    = (resource['amount'] as { value?: string })?.value
      const userId    = (resource['custom_id'] as string | undefined)
                      ?? (resource['note_to_payer'] as string | undefined)

      if (userId) {
        await logPaymentEvent({
          user_id: userId,
          event_type: 'paypal_capture_completed',
          amount_cents: amount ? Math.round(parseFloat(amount) * 100) : undefined,
          currency: (resource['amount'] as { currency_code?: string })?.currency_code?.toLowerCase() ?? 'usd',
          payment_method: 'paypal',
          stripe_session_id: orderId,  // reusing field for PayPal order ID
          success: true,
          metadata: { captureId, eventId },
        })
      }

    } else if (event_type === 'PAYMENT.CAPTURE.DENIED' || event_type === 'PAYMENT.CAPTURE.DECLINED') {
      const userId = (resource['custom_id'] as string | undefined)
      if (userId) {
        await logPaymentEvent({
          user_id: userId,
          event_type: 'paypal_capture_failed',
          payment_method: 'paypal',
          success: false,
          error_message: event_type,
          metadata: { eventId },
        })
      }

    } else if (event_type === 'BILLING.SUBSCRIPTION.ACTIVATED') {
      // Recurring subscription activated after user approval
      const subId  = resource['id'] as string
      const planId = (resource['plan_id'] as string | undefined) ?? ''
      const userId = (resource['custom_id'] as string | undefined)
                   ?? ((resource['subscriber'] as Record<string,unknown>)?.['email_address'] as string | undefined)
      const nextBilling = resource['billing_info']
        ? ((resource['billing_info'] as Record<string,unknown>)?.['next_billing_time'] as string | undefined)
        : undefined
      const periodEnd = nextBilling ? Math.floor(new Date(nextBilling).getTime() / 1000) : Math.floor(Date.now() / 1000) + 30 * 86400

      if (userId) {
        await syncSubscriptionToDb({
          user_id: userId,
          paypal_subscription_id: subId,
          plan_id: resolvePlanIdFromPayPal(planId),
          status: 'active',
          current_period_start: Math.floor(Date.now() / 1000),
          current_period_end:   periodEnd,
          payment_method: 'paypal',
        })
        await logPaymentEvent({
          user_id: userId,
          event_type: 'paypal_subscription_activated',
          payment_method: 'paypal',
          plan_id: planId,
          success: true,
          metadata: { subId, eventId },
        })
      }

    } else if (event_type === 'BILLING.SUBSCRIPTION.CANCELLED' || event_type === 'BILLING.SUBSCRIPTION.EXPIRED') {
      const subId  = resource['id'] as string
      const userId = (resource['custom_id'] as string | undefined)

      if (userId) {
        await syncSubscriptionToDb({
          user_id: userId,
          paypal_subscription_id: subId,
          plan_id: 'free',
          status: 'canceled',
          payment_method: 'paypal',
        })
        await logPaymentEvent({
          user_id: userId,
          event_type: 'paypal_subscription_canceled',
          payment_method: 'paypal',
          success: true,
          metadata: { subId, eventId },
        })
      }

    } else if (event_type === 'BILLING.SUBSCRIPTION.PAYMENT.FAILED') {
      const subId  = resource['id'] as string
      const userId = (resource['custom_id'] as string | undefined)

      if (userId) {
        await syncSubscriptionToDb({
          user_id: userId,
          paypal_subscription_id: subId,
          plan_id: 'unknown',
          status: 'past_due',
          payment_method: 'paypal',
        })
        await logPaymentEvent({
          user_id: userId,
          event_type: 'paypal_payment_failed',
          payment_method: 'paypal',
          success: false,
          metadata: { subId, eventId },
        })
      }

    } else if (event_type === 'BILLING.SUBSCRIPTION.RENEWED') {
      const subId  = resource['id'] as string
      const userId = (resource['custom_id'] as string | undefined)
      const nextBilling = resource['billing_info']
        ? ((resource['billing_info'] as Record<string,unknown>)?.['next_billing_time'] as string | undefined)
        : undefined
      const periodEnd = nextBilling
        ? Math.floor(new Date(nextBilling).getTime() / 1000)
        : Math.floor(Date.now() / 1000) + 30 * 86400

      if (userId) {
        await syncSubscriptionToDb({
          user_id: userId,
          paypal_subscription_id: subId,
          plan_id: 'active',
          status: 'active',
          current_period_end: periodEnd,
          payment_method: 'paypal',
        })
        await logPaymentEvent({
          user_id: userId,
          event_type: 'paypal_subscription_renewed',
          payment_method: 'paypal',
          success: true,
          metadata: { subId, eventId },
        })
      }
    }
    // Other events (e.g. BILLING.SUBSCRIPTION.CREATED) are informational — no action needed

    recordPayPalWebhookEvent(event_type, 'success', undefined, eventId, event.resource_type)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error('[paypal-webhook] processing error', { error: msg })
    recordPayPalWebhookEvent(event_type, 'failed', msg, eventId, event.resource_type)
    // Do NOT return 500 — PayPal would retry. Return 200 and log the error.
  }

  res.json({ received: true })
}))

// ══════════════════════════════════════════════════════════════
// SUBSCRIPTION ROUTES
// ══════════════════════════════════════════════════════════════

// POST /subscribe
router.post('/subscribe', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const {
    planId,
    paymentMethod = 'stripe',
    couponCode,
    country = 'US',
    vatNumber,
    paypalOrderId,
  } = req.body as {
    planId: string;
    paymentMethod?: 'stripe' | 'paypal';
    couponCode?: string;
    country?: string;
    vatNumber?: string;
    paypalOrderId?: string;
  };

  if (!planId) {
    res.status(400).json({ success: false, error: 'planId is required' });
    return;
  }

  let trialDays: number | undefined;
  let couponDiscount = 0;

  // Validate & redeem coupon
  if (couponCode) {
    const result = await redeemCoupon(couponCode, userId, planId);
    if (!result.success) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }
    if (result.trialDays) trialDays = result.trialDays;
    if (result.discountCents) couponDiscount = result.discountCents;
  }

  // Base amount from plan
  const basePriceMap: Record<string, number> = {
    pro: 999, pro_monthly: 999, pro_annual: 7999,
    studio: 2499, studio_monthly: 2499, studio_annual: 19999,
    label: 7999, label_monthly: 7999, label_annual: 63999,
  };
  const baseAmount = (basePriceMap[planId] ?? 999) - couponDiscount;
  const vatCalc = calculateVAT(Math.max(0, baseAmount), country, vatNumber);

  try {
    let subscriptionId: string;
    let status: string;
    let renewsAt: number;

    if (paymentMethod === 'stripe') {
      const priceId = PLAN_TO_STRIPE[planId] ?? STRIPE_PRICES.pro_monthly;
      const sub = await stripeCreateSub(userId, priceId, trialDays);
      subscriptionId = sub.id;
      status = sub.status;
      renewsAt = sub.current_period_end;
    } else {
      // PayPal subscription mock
      const sub = await ppCreateSub(
        `PAYPAL_PLAN_${planId.toUpperCase()}`,
        `${process.env.APP_URL ?? 'https://mixpiloteai.vercel.app'}/payment/success`,
        `${process.env.APP_URL ?? 'https://mixpiloteai.vercel.app'}/payment/cancel`
      );
      subscriptionId = sub.id;
      status = sub.status;
      renewsAt = Math.floor(Date.now() / 1000) + 30 * 86400;

      // Sync to Supabase (pending until ACTIVATED webhook fires)
      await syncSubscriptionToDb({
        user_id: userId,
        paypal_subscription_id: sub.id,
        plan_id: planId,
        status: 'trialing',
        payment_method: 'paypal',
        current_period_start: Math.floor(Date.now() / 1000),
      })
      await logPaymentEvent({
        user_id: userId,
        event_type: 'paypal_subscription_created',
        payment_method: 'paypal',
        plan_id: planId,
        success: true,
        metadata: { subscriptionId: sub.id },
      })
    }

    // Store sub record
    userSubscriptions.set(userId, {
      subscriptionId,
      planId,
      status,
      renewsAt,
      cancelAt: null,
      paymentMethod,
    });

    if (couponCode) {
      log({ userId, event: 'coupon_applied', couponCode, planId, success: true });
    }

    log({ userId, event: 'subscription_created', amountCents: vatCalc.total, currency: 'usd', paymentMethod, planId, success: true });

    res.json({
      success: true,
      subscriptionId,
      status,
      planId,
      vatCalculation: vatCalc,
      renewsAt,
      trialDays,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    logger.error('[payments] subscribe', { error: err instanceof Error ? err.message : String(err) });
    log({ userId, event: 'payment_failed', planId, paymentMethod, success: false, errorMessage: msg });
    res.status(500).json({ success: false, error: 'Payment processing failed' });
  }
});

// GET /subscription
router.get('/subscription', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;

  // Try Supabase first, fall back to in-memory
  const dbSub = await getSubscriptionFromDb(userId);
  if (dbSub) {
    res.json({
      success: true,
      data: {
        planId: dbSub.plan_id,
        status: dbSub.status,
        renewsAt: dbSub.current_period_end,
        cancelAtPeriodEnd: dbSub.cancel_at_period_end ?? false,
        paymentMethod: dbSub.payment_method,
        stripeSubscriptionId: dbSub.stripe_subscription_id,
      }
    });
    return;
  }

  // Fallback to in-memory
  const sub = userSubscriptions.get(userId);
  if (!sub) {
    res.json({ success: true, data: null });
    return;
  }
  res.json({ success: true, data: sub });
}));

// POST /cancel
router.post('/cancel', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { immediately = false } = req.body as { immediately?: boolean };

  const sub = userSubscriptions.get(userId);
  if (!sub) {
    res.status(404).json({ success: false, error: 'No active subscription found' });
    return;
  }
  // Verify the subscription belongs to this user
  if (sub.subscriptionId && !sub.subscriptionId.includes(userId) && userSubscriptions.get(userId) !== sub) {
    res.status(403).json({ success: false, error: 'Forbidden' });
    return;
  }

  try {
    if (sub.paymentMethod === 'stripe') {
      await stripeCancelSub(sub.subscriptionId, immediately);
    } else {
      await ppCancelSub(sub.subscriptionId, 'User requested cancellation');
      await syncSubscriptionToDb({
        user_id: userId,
        paypal_subscription_id: sub.subscriptionId,
        plan_id: 'free',
        status: 'canceled',
        payment_method: 'paypal',
      })
      await logPaymentEvent({
        user_id: userId,
        event_type: 'subscription_canceled',
        payment_method: 'paypal',
        success: true,
      })
    }

    if (immediately) {
      sub.status = 'canceled';
    } else {
      sub.cancelAt = sub.renewsAt;
      sub.status = 'active';
    }

    log({ userId, event: 'subscription_cancelled', planId: sub.planId, paymentMethod: sub.paymentMethod, success: true });

    res.json({ success: true, canceledImmediately: immediately, cancelAt: sub.cancelAt });
  } catch (err) {
    logger.error('[payments] cancel', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ success: false, error: 'Payment processing failed' });
  }
});

// POST /upgrade
router.post('/upgrade', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { planId } = req.body as { planId: string };

  if (!planId) {
    res.status(400).json({ success: false, error: 'planId is required' });
    return;
  }

  const sub = userSubscriptions.get(userId);

  try {
    const newPriceId = PLAN_TO_STRIPE[planId] ?? STRIPE_PRICES.pro_monthly;

    if (sub?.paymentMethod === 'stripe' && sub.subscriptionId) {
      await stripeUpgradeSub(sub.subscriptionId, newPriceId);
    }

    if (sub) {
      sub.planId = planId;
    } else {
      userSubscriptions.set(userId, {
        subscriptionId: `sub_mock_${userId}`,
        planId,
        status: 'active',
        renewsAt: Math.floor(Date.now() / 1000) + 30 * 86400,
        cancelAt: null,
        paymentMethod: 'stripe',
      });
    }

    log({ userId, event: 'subscription_created', planId, paymentMethod: 'stripe', success: true });

    res.json({ success: true, planId, upgraded: true });
  } catch (err) {
    logger.error('[payments] upgrade', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ success: false, error: 'Payment processing failed' });
  }
});

// ══════════════════════════════════════════════════════════════
// ONE-TIME PURCHASE ROUTES
// ══════════════════════════════════════════════════════════════

// POST /marketplace/buy
router.post('/marketplace/buy', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const ip = getIP(req);
  const {
    productId,
    productName,
    amountCents,
    paymentMethod = 'stripe',
    country = 'US',
  } = req.body as {
    productId: string;
    productName: string;
    amountCents: number;
    paymentMethod?: 'stripe' | 'paypal';
    country?: string;
  };

  if (!amountCents || !productId) {
    res.status(400).json({ success: false, error: 'productId and amountCents required' });
    return;
  }

  const fraud = checkFraud({
    userId,
    email: (req as AuthenticatedRequest).user?.email ?? 'unknown@unknown.com',
    amountCents,
    ipAddress: ip,
    countryCode: country,
    productType: 'marketplace',
  });

  if (fraud.decision === 'block') {
    log({ userId, event: 'fraud_blocked', amountCents, ipAddress: ip, success: false });
    res.status(403).json({ success: false, error: 'Transaction blocked' });
    return;
  }

  const vatCalc = calculateVAT(amountCents, country);

  try {
    if (paymentMethod === 'stripe') {
      const intent = await createPaymentIntent(vatCalc.total, 'usd', userId, { productId });
      log({ userId, event: 'payment_intent_created', amountCents: vatCalc.total, paymentMethod: 'stripe', productId, success: true });
      res.json({ success: true, clientSecret: intent.client_secret, paymentIntentId: intent.id, vatCalculation: vatCalc });
    } else {
      const order = await ppCreateOrder((vatCalc.total / 100).toFixed(2), 'USD', productName ?? productId);
      const approvalUrl = order.links.find((l) => l.rel === 'approve')?.href ?? '';
      log({ userId, event: 'payment_intent_created', amountCents: vatCalc.total, paymentMethod: 'paypal', productId, success: true });
      res.json({ success: true, orderId: order.id, approvalUrl, vatCalculation: vatCalc });
    }
  } catch (err) {
    logger.error('[payments] marketplace/buy', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ success: false, error: 'Payment processing failed' });
  }
});

// POST /credits
router.post('/credits', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const ip = getIP(req);
  const {
    package: pkg,
    paymentMethod = 'stripe',
    country = 'US',
  } = req.body as {
    package: '100' | '500' | '2000';
    paymentMethod?: 'stripe' | 'paypal';
    country?: string;
  };

  const pkgData = getCreditPack(pkg);
  if (!pkgData) {
    res.status(400).json({ success: false, error: 'Invalid credit package. Choose: 100, 500, or 2000' });
    return;
  }

  const fraud = checkFraud({
    userId,
    email: (req as AuthenticatedRequest).user?.email ?? 'unknown@unknown.com',
    amountCents: pkgData.amountCents,
    ipAddress: ip,
    countryCode: country,
    productType: 'credits',
  });

  if (fraud.decision === 'block') {
    log({ userId, event: 'fraud_blocked', amountCents: pkgData.amountCents, ipAddress: ip, success: false });
    res.status(403).json({ success: false, error: 'Transaction blocked' });
    return;
  }

  const vatCalc = calculateVAT(pkgData.amountCents, country);

  try {
    if (paymentMethod === 'stripe') {
      const intent = await createPaymentIntent(vatCalc.total, 'usd', userId, {
        productType: 'credits',
        credits: String(pkgData.credits),
      });
      log({ userId, event: 'payment_intent_created', amountCents: vatCalc.total, paymentMethod: 'stripe', productId: `credits_${pkg}`, success: true });
      res.json({ success: true, clientSecret: intent.client_secret, paymentIntentId: intent.id, credits: pkgData.credits, vatCalculation: vatCalc });
    } else {
      const order = await ppCreateOrder((vatCalc.total / 100).toFixed(2), 'USD', `${pkgData.credits} AI Credits`);
      const approvalUrl = order.links.find((l) => l.rel === 'approve')?.href ?? '';
      log({ userId, event: 'payment_intent_created', amountCents: vatCalc.total, paymentMethod: 'paypal', productId: `credits_${pkg}`, success: true });
      res.json({ success: true, orderId: order.id, approvalUrl, credits: pkgData.credits, vatCalculation: vatCalc });
    }
  } catch (err) {
    logger.error('[payments] credits', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ success: false, error: 'Payment processing failed' });
  }
});

// ══════════════════════════════════════════════════════════════
// COUPON ROUTES
// ══════════════════════════════════════════════════════════════

// POST /coupon/validate
router.post('/coupon/validate', async (req: Request, res: Response): Promise<void> => {
  const { code, planId } = req.body as { code: string; planId: string };

  if (!code || !planId) {
    res.status(400).json({ success: false, error: 'code and planId required' });
    return;
  }

  const result = await validateCoupon(code, planId);
  if (!result.valid || !result.coupon) {
    res.json({ success: true, valid: false, error: result.error });
    return;
  }

  // Calculate discount on typical plan price
  const basePrices: Record<string, number> = {
    pro: 999, studio: 2499, label: 7999, free: 0,
  };
  const baseAmount = basePrices[planId] ?? 999;
  const discountedAmount = applyCouponToAmount(result.coupon, baseAmount);
  const discountCents = baseAmount - discountedAmount;

  res.json({
    success: true,
    valid: true,
    coupon: {
      code: result.coupon.code,
      type: result.coupon.type,
      value: result.coupon.value,
      description: result.coupon.description,
    },
    discountCents,
    discountedAmount,
  });
});

// POST /coupon/apply
router.post('/coupon/apply', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { code, planId } = req.body as { code: string; planId: string };

  if (!code || !planId) {
    res.status(400).json({ success: false, error: 'code and planId required' });
    return;
  }

  const result = await redeemCoupon(code, userId, planId);
  res.json(result);
});

// ══════════════════════════════════════════════════════════════
// HISTORY & INVOICES
// ══════════════════════════════════════════════════════════════

// GET /history
router.get('/history', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const userId = req.user!.id;
  const limit = parseInt(String(req.query['limit'] ?? '20'), 10);
  const history = getUserHistory(userId, limit);
  res.json({ success: true, data: history, count: history.length });
});

// GET /invoices
router.get('/invoices', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const userId = req.user!.id;
  const invoiceList = listUserInvoices(userId);
  res.json({ success: true, data: invoiceList, count: invoiceList.length });
});

// GET /invoices/:id
router.get('/invoices/:id', (req: Request, res: Response): void => {
  const { id } = req.params;
  const data = getInvoiceAsJSON(id);
  if (!data) {
    res.status(404).json({ success: false, error: 'Invoice not found' });
    return;
  }
  res.json({ success: true, data });
});

// POST /refund
router.post('/refund', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { paymentIntentId, reason, amountCents, paymentMethod, captureId } = req.body as {
    paymentIntentId?: string;
    reason?: string;
    amountCents?: number;
    paymentMethod?: 'stripe' | 'paypal';
    captureId?: string;
  };

  if (!paymentIntentId && !captureId) {
    res.status(400).json({ success: false, error: 'paymentIntentId or captureId is required' });
    return;
  }

  logSecurityEvent({
    type: 'payment_attempt',
    severity: 'warn',
    ip: req.ip,
    userId,
    route: '/api/payments/refund',
    reason: reason ?? 'refund requested',
    meta: { paymentIntentId, captureId, amountCents },
  });

  try {
    if (paymentMethod === 'paypal' && captureId) {
      const refundAmountUSD = amountCents ? (amountCents / 100).toFixed(2) : undefined
      const refund = await ppRefundCapture(captureId, refundAmountUSD, reason)
      await logPaymentEvent({
        user_id: userId,
        event_type: 'paypal_refund_issued',
        payment_method: 'paypal',
        success: true,
        metadata: { captureId, refundId: refund.id },
      })
      res.json({ success: true, refundId: refund.id })
      return
    }

    if (!paymentIntentId) {
      res.status(400).json({ success: false, error: 'paymentIntentId is required for Stripe refunds' });
      return;
    }

    const refund = await stripeCreateRefund(paymentIntentId, amountCents, reason);

    // Find and mark invoice as refunded
    const allInvoices = listUserInvoices(userId);
    const inv = allInvoices.find((i) => i.paymentIntentId === paymentIntentId);
    if (inv) markRefunded(inv.id);

    log({ userId, event: 'refund_issued', amountCents: refund.amount, paymentMethod: 'stripe', stripeIntentId: paymentIntentId, success: true });

    res.json({
      success: true,
      refundId: refund.id,
      amount: refund.amount,
      status: refund.status,
      invoiceId: inv?.id,
    });
  } catch (err) {
    logger.error('[payments] refund', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ success: false, error: 'Payment processing failed' });
  }
});

// GET /invoice/:id (alias for frontend compatibility)
router.get('/invoice/:id', (req: Request, res: Response): void => {
  const { id } = req.params;
  const inv = getInvoice(id);
  if (!inv) {
    res.status(404).json({ success: false, error: 'Invoice not found' });
    return;
  }
  res.json({ success: true, data: inv });
});

export default router;
