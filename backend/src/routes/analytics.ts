// ============================================================
// NEUROTEK AI — Analytics Dashboard Route
// ============================================================
import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { getTodayUsage, getDailyLimit } from '../data/mockDB';
import { getPlan } from '../data/plans';

const router = Router();

interface DailyUsage {
  date: string;
  requests: number;
  tokensIn: number;
  tokensOut: number;
  cost: number;
}

const analyticsStore: Map<string, DailyUsage[]> = new Map();

export function trackRequest(userId: string, tokensIn: number, tokensOut: number, cost: number): void {
  const today = new Date().toISOString().slice(0, 10);
  const history = analyticsStore.get(userId) ?? [];
  const todayEntry = history.find((d) => d.date === today);
  if (todayEntry) {
    todayEntry.requests++;
    todayEntry.tokensIn  += tokensIn;
    todayEntry.tokensOut += tokensOut;
    todayEntry.cost      += cost;
  } else {
    history.push({ date: today, requests: 1, tokensIn, tokensOut, cost });
  }
  analyticsStore.set(userId, history.slice(-30));
}

router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId     = req.user!.id;
  const plan       = (req.user?.plan ?? 'free') as any;
  const planConfig = getPlan(plan);

  if (!planConfig.analyticsAccess) {
    res.status(403).json({ success: false, error: 'Analytics requires Creator plan or higher', code: 'PLAN_UPGRADE_REQUIRED' });
    return;
  }

  const history    = analyticsStore.get(userId) ?? [];
  const today      = new Date().toISOString().slice(0, 10);
  const todayStats = history.find((d) => d.date === today) ?? { requests: 0, tokensIn: 0, tokensOut: 0, cost: 0 };

  const totalRequests = history.reduce((s, d) => s + d.requests, 0);
  const totalCost     = history.reduce((s, d) => s + d.cost, 0);
  const avgPerDay     = history.length > 0 ? totalRequests / history.length : 0;

  res.json({
    success: true,
    data: {
      today: {
        requests: getTodayUsage(userId),
        limit: getDailyLimit(plan),
        remaining: Math.max(0, getDailyLimit(plan) - getTodayUsage(userId)),
        tokensIn: todayStats.tokensIn,
        tokensOut: todayStats.tokensOut,
        estimatedCostUSD: todayStats.cost,
      },
      history: history.slice(-14),
      totals: { requests: totalRequests, estimatedCostUSD: totalCost, avgRequestsPerDay: Math.round(avgPerDay), daysTracked: history.length },
      plan: { id: plan, name: planConfig.name, model: planConfig.model, dailyLimit: planConfig.dailyAIRequests },
    },
  });
});

export default router;
