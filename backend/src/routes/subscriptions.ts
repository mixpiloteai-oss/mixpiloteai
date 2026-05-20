// ============================================================
// NEUROTEK AI — Subscription Routes
// ============================================================
import { Router, Response } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { subscriptions, getTodayUsage, getDailyLimit, type Plan } from '../data/mockDB';
import { getUserPlanStatus } from '../lib/subscriptionValidator';

const router = Router();

const PLANS = [
  { id: 'free', name: 'Free', price: 0, currency: 'EUR', billing: 'forever', color: '#475569', features: ['20 AI requests / day', 'Basic templates', 'Track organizer', 'Dashboard & project manager'], limits: { dailyAiRequests: 20, projects: 3, templates: 3 }, cta: 'Get Started Free' },
  { id: 'pro', name: 'Pro', price: 1490, currency: 'EUR', billing: 'monthly', color: '#7c3aed', popular: true, features: ['200 AI requests / day', 'All genre templates', 'Mix Assistant with AI analysis', 'Live Mode + scene launcher', 'AI Chat with project context', 'FX chain recommendations', 'Kick & acid design assistant'], limits: { dailyAiRequests: 200, projects: 20, templates: 'unlimited' }, cta: 'Start Pro — €14.90/mo' },
  { id: 'studio', name: 'Studio', price: 3900, currency: 'EUR', billing: 'monthly', color: '#06b6d4', features: ['Unlimited AI requests', 'Full AI conversation history', 'Real-time live AI assistance', 'Cloud project sync', 'Priority AI processing', 'Multi-project workspace', 'Team collaboration (coming soon)', 'API access'], limits: { dailyAiRequests: 9999, projects: 'unlimited', templates: 'unlimited' }, cta: 'Go Studio — €39/mo' },
];

router.get('/plans', (_req, res) => res.json({ success: true, data: PLANS }));

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
  const planDetails = PLANS.find((p) => p.id === status.plan);

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
