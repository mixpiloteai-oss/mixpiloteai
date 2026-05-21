// ============================================================
// NEUROTEK AI — Subscription Routes
// ============================================================
import { Router, Response } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { subscriptions, getTodayUsage, getDailyLimit, type Plan } from '../data/mockDB';
import { getUserPlanStatus } from '../lib/subscriptionValidator';
import { getPlans as getManagedPlans } from '../lib/planManager';
import { getCreditPacks } from '../lib/creditPackManager';
import {
  cancelSubscription as stripeCancelSub,
  upgradeSubscription as stripeUpgradeSub,
  STRIPE_PRICES,
} from '../services/stripeService';
import { getSubscriptionFromDb, syncSubscriptionToDb, logPaymentEvent } from '../lib/paymentSync';
import { validateCoupon, applyCouponToAmount, redeemCoupon } from '../services/couponService';
import { logger } from '../utils/logger';

const router = Router();

router.get('/plans', (_req, res) => {
  res.set('Cache-Control', 'no-store')
  res.set('Last-Modified', new Date().toUTCString())
  const plans = getManagedPlans(false)
  res.json({ success: true, data: plans, count: plans.length })
});

router.get('/credit-packs', (_req, res) => {
  res.set('Cache-Control', 'no-store')
  const packs = getCreditPacks(false)
  res.json({ success: true, data: packs, count: packs.length })
});

// GET /my — subscription details with quota, DB-first plan resolution
router.get('/my', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId  = req.user!.id;
  const jwtPlan = req.user!.plan ?? 'free';
  const status  = await getUserPlanStatus(userId, jwtPlan);

  // Keep quota from existing implementation
  const used  = getTodayUsage(userId);
  // Use mockDB subscription for legacy quota limit lookup
  const mockSub = subscriptions.find((s) => s.userId === userId);
  const limitPlan = (status.plan ?? mockSub?.plan ?? 'free') as Plan;
  const limit = getDailyLimit(limitPlan);
  const planDetails = getManagedPlans(true).find(p => p.id === status.plan);

  res.json({
    success: true,
    data: {
      plan: status.plan,
      status: status.status,
      isActive: status.isActive,
      isPremium: status.isPremium,
      expiresAt: status.expiresAt,
      daysRemaining: status.daysRemaining,
      planDetails,
      quota: {
        used,
        limit,
        remaining: Math.max(0, limit - used),
        resetAt: new Date(new Date().setHours(24, 0, 0, 0)).toISOString(),
      },
    },
  });
}));

// GET /status — lightweight subscription status check
router.get('/status', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId  = req.user!.id;
  const jwtPlan = req.user!.plan ?? 'free';
  const status  = await getUserPlanStatus(userId, jwtPlan);
  res.json({ success: true, data: status });
}));

// GET /current — alias used by website (maps to same data as /my)
router.get('/current', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId  = req.user!.id;
  const jwtPlan = req.user!.plan ?? 'free';
  const status  = await getUserPlanStatus(userId, jwtPlan);

  res.json({
    success: true,
    data: {
      planId: status.plan,
      status: status.status,
      isActive: status.isActive,
      isPremium: status.isPremium,
      expiresAt: status.expiresAt,
      daysRemaining: status.daysRemaining,
    },
  });
}));

// POST /upgrade — switch plan on the active provider subscription
// (Stripe in this build; PayPal upgrades require redirect-based flow
// and are handled via /api/payments/paypal/create-order)
router.post('/upgrade', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { plan, annual = false } = req.body as { plan?: string; annual?: boolean };
  if (!plan || !['free', 'pro', 'studio', 'label'].includes(plan)) {
    res.status(400).json({ success: false, error: 'Invalid plan' });
    return;
  }
  const userId = req.user!.id;
  const dbSub = await getSubscriptionFromDb(userId);
  if (!dbSub) {
    res.status(404).json({ success: false, error: 'No active subscription — create one via /api/payments/stripe/session' });
    return;
  }
  if (dbSub.plan_id === plan) {
    res.status(400).json({ success: false, error: `Already on ${plan}` });
    return;
  }

  try {
    if (dbSub.stripe_subscription_id) {
      const priceKey = `${plan}_${annual ? 'annual' : 'monthly'}` as keyof typeof STRIPE_PRICES;
      const newPriceId = STRIPE_PRICES[priceKey];
      if (!newPriceId) {
        res.status(400).json({ success: false, error: 'No Stripe price configured for that plan' });
        return;
      }
      const updated = await stripeUpgradeSub(dbSub.stripe_subscription_id, newPriceId);
      await syncSubscriptionToDb({
        user_id: userId,
        stripe_subscription_id: updated.id,
        plan_id: plan,
        status: (updated.status === 'unpaid' || updated.status === 'incomplete_expired') ? 'past_due' : updated.status,
        current_period_start: updated.current_period_start,
        current_period_end:   updated.current_period_end,
        payment_method: 'stripe',
      });
      await logPaymentEvent({ user_id: userId, event_type: 'subscription_upgraded', plan_id: plan, payment_method: 'stripe', success: true });
      res.json({ success: true, data: { plan, status: updated.status, periodEnd: updated.current_period_end } });
      return;
    }

    // No live provider sub — update local record for free-tier moves
    if (plan === 'free') {
      await syncSubscriptionToDb({ user_id: userId, plan_id: 'free', status: 'active', payment_method: dbSub.payment_method ?? 'stripe' });
      res.json({ success: true, data: { plan: 'free', status: 'active' } });
      return;
    }
    res.status(400).json({ success: false, error: 'Paid upgrades require an active Stripe subscription. Use /api/payments/stripe/session.' });
  } catch (err) {
    logger.error('[subscriptions/upgrade]', { error: err instanceof Error ? err.message : String(err), userId, plan });
    res.status(500).json({ success: false, error: 'Upgrade failed' });
  }
}));

// POST /cancel — cancel at period end (or immediately when immediate=true)
router.post('/cancel', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { immediate = false, reason } = req.body as { immediate?: boolean; reason?: string };
  const userId = req.user!.id;
  const dbSub = await getSubscriptionFromDb(userId);
  if (!dbSub) {
    res.status(404).json({ success: false, error: 'No subscription found' });
    return;
  }
  try {
    if (dbSub.stripe_subscription_id) {
      const updated = await stripeCancelSub(dbSub.stripe_subscription_id, immediate);
      await syncSubscriptionToDb({
        user_id: userId,
        stripe_subscription_id: updated.id,
        plan_id: immediate ? 'free' : dbSub.plan_id,
        status: (updated.status === 'unpaid' || updated.status === 'incomplete_expired') ? 'past_due' : updated.status,
        current_period_end: updated.current_period_end,
        payment_method: 'stripe',
      });
    } else {
      await syncSubscriptionToDb({ user_id: userId, plan_id: immediate ? 'free' : dbSub.plan_id, status: immediate ? 'canceled' : 'active', payment_method: dbSub.payment_method ?? 'stripe' });
    }
    await logPaymentEvent({ user_id: userId, event_type: 'subscription_canceled', plan_id: dbSub.plan_id, payment_method: dbSub.payment_method ?? 'stripe', success: true });
    if (reason) logger.info('[subscriptions/cancel] reason', { userId, reason });
    res.json({ success: true, data: { canceledImmediately: immediate, cancelAtPeriodEnd: !immediate } });
  } catch (err) {
    logger.error('[subscriptions/cancel]', { error: err instanceof Error ? err.message : String(err), userId });
    res.status(500).json({ success: false, error: 'Cancel failed' });
  }
}));

// POST /reactivate — un-set cancel_at_period_end on the live provider sub
router.post('/reactivate', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const dbSub = await getSubscriptionFromDb(userId);
  if (!dbSub?.stripe_subscription_id) {
    res.status(404).json({ success: false, error: 'No Stripe subscription to reactivate' });
    return;
  }
  try {
    // upgradeSubscription with the same price effectively re-enables auto-renew
    const priceKey = `${dbSub.plan_id}_monthly` as keyof typeof STRIPE_PRICES;
    const priceId = STRIPE_PRICES[priceKey] ?? STRIPE_PRICES.pro_monthly;
    const updated = await stripeUpgradeSub(dbSub.stripe_subscription_id, priceId);
    await syncSubscriptionToDb({
      user_id: userId, stripe_subscription_id: updated.id,
      plan_id: dbSub.plan_id, status: 'active',
      current_period_end: updated.current_period_end, payment_method: 'stripe',
    });
    await logPaymentEvent({ user_id: userId, event_type: 'subscription_reactivated', plan_id: dbSub.plan_id, payment_method: 'stripe', success: true });
    res.json({ success: true, data: { status: 'active' } });
  } catch (err) {
    logger.error('[subscriptions/reactivate]', { error: err instanceof Error ? err.message : String(err), userId });
    res.status(500).json({ success: false, error: 'Reactivation failed' });
  }
}));

// POST /validate-coupon — preview discount before checkout
router.post('/validate-coupon', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { code, amountCents, planId = 'pro' } = req.body as { code?: string; amountCents?: number; planId?: string };
  if (!code || typeof amountCents !== 'number') {
    res.status(400).json({ success: false, error: 'code and amountCents required' });
    return;
  }
  const v = validateCoupon(code, planId);
  if (!v.valid || !v.coupon) {
    res.status(400).json({ success: false, error: v.error ?? 'Invalid coupon' });
    return;
  }
  const final = applyCouponToAmount(v.coupon, amountCents);
  res.json({ success: true, data: { coupon: v.coupon, discountedAmountCents: final, savedCents: amountCents - final } });
}));

// POST /redeem-coupon — record a coupon redemption (called post-payment)
router.post('/redeem-coupon', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { code, planId = 'pro' } = req.body as { code?: string; planId?: string };
  if (!code) { res.status(400).json({ success: false, error: 'code required' }); return; }
  const result = redeemCoupon(code, req.user!.id, planId);
  if (!result.success) {
    res.status(400).json({ success: false, error: result.error ?? 'Redemption failed' });
    return;
  }
  res.json({ success: true, data: result });
}));

// Mirror old /upgrade contract for the legacy in-memory client (kept for
// backward compat with the offline demo store)
router.post('/upgrade-legacy', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { plan } = req.body as { plan?: string };
  if (!plan || !['free', 'pro', 'studio'].includes(plan)) {
    res.status(400).json({ success: false, error: 'Invalid plan' });
    return;
  }
  const sub = subscriptions.find((s) => s.userId === req.user!.id);
  if (!sub) { res.status(404).json({ success: false, error: 'Subscription not found' }); return; }
  sub.plan = plan as Plan;
  res.json({ success: true, data: { plan, status: 'active' } });
});

export default router;
