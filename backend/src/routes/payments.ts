// ============================================================
// NEUROTEK AI — Payment REST API
// ============================================================
// Raw body needed for Stripe webhook signature verification.
// Register the raw body route BEFORE express.json() in index.ts:
//   app.post('/api/payments/stripe/webhook', express.raw({ type: '*/*' }), ...)
// ============================================================
import { Router, Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
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
} from '../services/stripeService';

import {
  createOrder as ppCreateOrder,
  captureOrder as ppCaptureOrder,
  createSubscription as ppCreateSub,
  cancelSubscription as ppCancelSub,
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

// ── Helper: extract userId ────────────────────────────────────
function getUserId(req: Request): string {
  const authReq = req as AuthenticatedRequest;
  const header = req.headers['x-user-id'];
  if (typeof header === 'string' && header.trim() !== '') return header.trim();
  if (authReq.user?.id) return authReq.user.id;
  return 'anonymous';
}

// ── Helper: get IP address ─────────────────────────────────────
function getIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim() ?? '0.0.0.0';
  return req.socket.remoteAddress ?? '0.0.0.0';
}

// ── Credit package price map ──────────────────────────────────
const CREDIT_PACKAGES: Record<string, { priceId: string; amountCents: number; credits: number }> = {
  '100':  { priceId: STRIPE_PRICES.credits_100,  amountCents: 499,  credits: 100 },
  '500':  { priceId: STRIPE_PRICES.credits_500,  amountCents: 1999, credits: 500 },
  '2000': { priceId: STRIPE_PRICES.credits_2000, amountCents: 6999, credits: 2000 },
};

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

// POST /stripe/intent
router.post('/stripe/intent', async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
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
    email: (req as AuthenticatedRequest).user?.email ?? 'unknown@unknown.com',
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
router.post('/stripe/confirm', async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
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

    const authReq = req as AuthenticatedRequest;
    const invoice = createInvoice({
      userId,
      customerName: authReq.user?.name ?? 'Customer',
      customerEmail: authReq.user?.email ?? 'customer@example.com',
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
router.post('/stripe/webhook', (req: Request, res: Response): void => {
  const signature = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET ?? '';

  type RawBodyRequest = Request & { rawBody?: Buffer };
  const rawBodyReq = req as RawBodyRequest;

  // rawBody may be attached by the pre-handler in index.ts, or req.body is the Buffer
  const rawBody = rawBodyReq.rawBody ?? (Buffer.isBuffer(req.body) ? req.body : null);

  if (secret && typeof signature === 'string' && rawBody) {
    const valid = verifyWebhookSignature(rawBody.toString('utf8'), signature, secret);
    if (!valid) {
      res.status(400).json({ error: 'Invalid signature' });
      return;
    }
  }

  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    const bodyStr = rawBody ? rawBody.toString('utf8') : JSON.stringify(req.body);
    event = JSON.parse(bodyStr) as typeof event;
  } catch {
    res.status(400).json({ error: 'Invalid JSON' });
    return;
  }

  const obj = event.data.object;

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const userId = (obj['metadata'] as Record<string, string>)?.['userId'] ?? 'unknown';
      const intentId = obj['id'] as string;
      const amount = obj['amount'] as number;
      log({ userId, event: 'payment_succeeded', amountCents: amount, currency: obj['currency'] as string, paymentMethod: 'stripe', stripeIntentId: intentId, success: true });
      // Find invoice by payment intent and mark paid
      break;
    }
    case 'customer.subscription.deleted': {
      const customerId = obj['customer'] as string;
      log({ userId: customerId, event: 'subscription_cancelled', paymentMethod: 'stripe', success: true });
      break;
    }
    case 'invoice.payment_succeeded': {
      const customerId = obj['customer'] as string;
      const amount = obj['amount_paid'] as number;
      log({ userId: customerId, event: 'subscription_renewed', amountCents: amount, paymentMethod: 'stripe', success: true });
      break;
    }
    default:
      break;
  }

  res.json({ received: true });
});

// ══════════════════════════════════════════════════════════════
// PAYPAL ROUTES
// ══════════════════════════════════════════════════════════════

// POST /paypal/create-order
router.post('/paypal/create-order', async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
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
    email: (req as AuthenticatedRequest).user?.email ?? 'unknown@unknown.com',
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
router.post('/paypal/capture', async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
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

    const authReq = req as AuthenticatedRequest;
    const invoice = createInvoice({
      userId,
      customerName: authReq.user?.name ?? 'Customer',
      customerEmail: authReq.user?.email ?? 'customer@example.com',
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
router.post('/paypal/webhook', async (req: Request, res: Response): Promise<void> => {
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === 'string') headers[k] = v;
  }

  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);
  await verifyWebhookEvent(headers, rawBody);
  res.json({ received: true });
});

// ══════════════════════════════════════════════════════════════
// SUBSCRIPTION ROUTES
// ══════════════════════════════════════════════════════════════

// POST /subscribe
router.post('/subscribe', async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
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
    const result = redeemCoupon(couponCode, userId, planId);
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
router.get('/subscription', (req: Request, res: Response): void => {
  const userId = getUserId(req);
  const sub = userSubscriptions.get(userId);

  if (!sub) {
    res.json({ success: true, data: { plan: 'free', status: 'active', renewsAt: null, cancelAt: null } });
    return;
  }

  res.json({ success: true, data: sub });
});

// POST /cancel
router.post('/cancel', async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const { immediately = false } = req.body as { immediately?: boolean };

  const sub = userSubscriptions.get(userId);
  if (!sub) {
    res.status(404).json({ success: false, error: 'No active subscription found' });
    return;
  }

  try {
    if (sub.paymentMethod === 'stripe') {
      await stripeCancelSub(sub.subscriptionId, immediately);
    } else {
      await ppCancelSub(sub.subscriptionId, 'User requested cancellation');
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
router.post('/upgrade', async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
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
router.post('/marketplace/buy', async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
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
router.post('/credits', async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
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

  const pkgData = CREDIT_PACKAGES[pkg];
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
router.post('/coupon/validate', (req: Request, res: Response): void => {
  const { code, planId } = req.body as { code: string; planId: string };

  if (!code || !planId) {
    res.status(400).json({ success: false, error: 'code and planId required' });
    return;
  }

  const result = validateCoupon(code, planId);
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
router.post('/coupon/apply', (req: Request, res: Response): void => {
  const userId = getUserId(req);
  const { code, planId } = req.body as { code: string; planId: string };

  if (!code || !planId) {
    res.status(400).json({ success: false, error: 'code and planId required' });
    return;
  }

  const result = redeemCoupon(code, userId, planId);
  res.json(result);
});

// ══════════════════════════════════════════════════════════════
// HISTORY & INVOICES
// ══════════════════════════════════════════════════════════════

// GET /history
router.get('/history', (req: Request, res: Response): void => {
  const userId = getUserId(req);
  const limit = parseInt(String(req.query['limit'] ?? '20'), 10);
  const history = getUserHistory(userId, limit);
  res.json({ success: true, data: history, count: history.length });
});

// GET /invoices
router.get('/invoices', (req: Request, res: Response): void => {
  const userId = getUserId(req);
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
router.post('/refund', async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const { paymentIntentId, reason, amountCents } = req.body as {
    paymentIntentId: string;
    reason?: string;
    amountCents?: number;
  };

  if (!paymentIntentId) {
    res.status(400).json({ success: false, error: 'paymentIntentId is required' });
    return;
  }

  logSecurityEvent({
    type: 'payment_attempt',
    severity: 'warn',
    ip: req.ip,
    userId,
    route: '/api/payments/refund',
    reason: reason ?? 'refund requested',
    meta: { paymentIntentId, amountCents },
  });

  try {
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
