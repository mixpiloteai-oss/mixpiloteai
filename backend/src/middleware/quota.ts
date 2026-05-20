// ============================================================
// NEUROTEK AI — Quota Middleware
// ============================================================
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { getTodayUsage, getDailyLimit, type Plan } from '../data/mockDB';
import { getUserPlanStatus } from '../lib/subscriptionValidator';

export function checkQuota(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ success: false, error: 'Unauthorised' });
    return;
  }

  // Resolve plan from DB (authoritative) asynchronously, fall back to JWT
  getUserPlanStatus(userId, req.user?.plan).then((planStatus) => {
    const effectivePlan = (planStatus.isActive ? planStatus.plan : 'free') as Plan;
    const used = getTodayUsage(userId);
    const limit = getDailyLimit(effectivePlan);

    if (used >= limit) {
      res.status(429).json({
        success: false,
        error: 'Daily AI quota exceeded',
        code: 'QUOTA_EXCEEDED',
        quota: { used, limit, remaining: 0 },
      });
      return;
    }

    next();
  }).catch(() => {
    // If plan status lookup fails entirely, fall back to JWT plan
    const plan = (req.user?.plan ?? 'free') as Plan;
    const used = getTodayUsage(userId);
    const limit = getDailyLimit(plan);

    if (used >= limit) {
      res.status(429).json({
        success: false,
        error: 'Daily AI quota exceeded',
        code: 'QUOTA_EXCEEDED',
        quota: { used, limit, remaining: 0 },
      });
      return;
    }

    next();
  });
}
