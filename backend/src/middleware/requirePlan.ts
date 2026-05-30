import { Request, Response, NextFunction, RequestHandler } from 'express'
import { getUserPlanStatus, hasMinPlan } from '../lib/subscriptionValidator'
import { AuthenticatedRequest } from './auth'

export function requirePlan(minimumPlan: string): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authReq = req as AuthenticatedRequest
    if (!authReq.user) {
      res.status(401).json({ error: 'Authentication required' })
      return
    }

    const userId  = authReq.user.id
    const jwtPlan = authReq.user.plan ?? 'free'

    const status = await getUserPlanStatus(userId, jwtPlan)

    if (!status.isActive && minimumPlan !== 'free') {
      res.status(403).json({
        error: 'Active subscription required',
        code: 'SUBSCRIPTION_REQUIRED',
        requiredPlan: minimumPlan,
        currentPlan: status.plan,
        upgradeUrl: '/pricing',
      })
      return
    }

    if (!hasMinPlan(status.plan, minimumPlan)) {
      res.status(403).json({
        error: `This feature requires a ${minimumPlan} plan or higher`,
        code: 'PLAN_UPGRADE_REQUIRED',
        requiredPlan: minimumPlan,
        currentPlan: status.plan,
        upgradeUrl: '/pricing',
      })
      return
    }

    // Attach plan status to request for downstream use
    ;(req as AuthenticatedRequest & { planStatus: typeof status }).planStatus = status
    next()
  }
}

// Convenience exports
export const requirePro     = requirePlan('pro')
export const requireStudio  = requirePlan('studio')
export const requirePremium = requirePlan('pro')   // pro or higher
