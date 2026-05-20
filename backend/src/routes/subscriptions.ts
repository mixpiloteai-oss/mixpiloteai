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

router.post('/upgrade', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { plan } = req.body;
  if (!['free', 'pro', 'studio'].includes(plan)) return res.status(400).json({ success: false, error: 'Invalid plan' });
  const sub = subscriptions.find((s) => s.userId === req.user!.id);
  if (!sub) return res.status(404).json({ success: false, error: 'Subscription not found' });
  if (sub.plan === plan) return res.status(400).json({ success: false, error: `Already on ${plan} plan` });
  sub.plan = plan as Plan;
  res.json({ success: true, message: `Plan upgraded to ${plan} (demo — no real payment processed)`, data: { plan, status: 'active' } });
});

export default router;
