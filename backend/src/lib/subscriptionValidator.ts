import { getSubscriptionFromDb } from './paymentSync'
import { logger } from '../utils/logger'

// Plan hierarchy: free < pro (creator) < studio
const PLAN_RANK: Record<string, number> = {
  free:    0,
  creator: 1,
  pro:     1,   // alias
  studio:  2,
  label:   3,
}

export function getPlanRank(plan: string): number {
  return PLAN_RANK[plan.toLowerCase()] ?? 0
}

export function hasMinPlan(userPlan: string, requiredPlan: string): boolean {
  return getPlanRank(userPlan) >= getPlanRank(requiredPlan)
}

export interface PlanStatus {
  plan: string              // 'free' | 'pro' | 'studio' | 'label'
  status: string            // 'active' | 'canceled' | 'past_due' | 'trialing' | 'inactive'
  expiresAt: number | null  // Unix timestamp, null = never (lifetime/active)
  isActive: boolean         // true if subscription is paid and not expired
  isPremium: boolean        // true if plan > free
  daysRemaining: number | null
  source: 'db' | 'jwt'     // where the plan was resolved from
}

export async function getUserPlanStatus(userId: string, jwtPlan?: string): Promise<PlanStatus> {
  // 1. Try Supabase first (authoritative)
  try {
    const dbSub = await getSubscriptionFromDb(userId)
    if (dbSub) {
      const now = Math.floor(Date.now() / 1000)
      const expired = dbSub.current_period_end != null && dbSub.current_period_end < now
      const isActive = (dbSub.status === 'active' || dbSub.status === 'trialing') && !expired
      const plan = isActive ? dbSub.plan_id : 'free'
      const daysRemaining = dbSub.current_period_end
        ? Math.max(0, Math.ceil((dbSub.current_period_end - now) / 86400))
        : null

      return {
        plan,
        status: expired ? 'inactive' : dbSub.status,
        expiresAt: dbSub.current_period_end ?? null,
        isActive,
        isPremium: isActive && getPlanRank(plan) > 0,
        daysRemaining,
        source: 'db',
      }
    }
  } catch (err) {
    logger.warn('[subscriptionValidator] DB lookup failed, falling back to JWT', { message: err instanceof Error ? err.message : '' })
  }

  // 2. Fall back to JWT plan (free if no JWT plan)
  const plan = jwtPlan ?? 'free'
  return {
    plan,
    status: plan === 'free' ? 'inactive' : 'active',
    expiresAt: null,
    isActive: plan !== 'free',
    isPremium: getPlanRank(plan) > 0,
    daysRemaining: null,
    source: 'jwt',
  }
}
