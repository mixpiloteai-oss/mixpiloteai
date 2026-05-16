// ============================================================
// NEUROTEK AI — Plan Definitions
// ============================================================

export type Plan = 'free' | 'creator' | 'studio' | 'learning';

export interface PlanConfig {
  id: Plan;
  name: string;
  priceMonthly: number; // EUR
  priceYearly: number;  // EUR/year
  dailyAIRequests: number;
  maxProjects: number;
  maxPackUploads: number; // per month, 0 = disabled
  cloudSyncGB: number;
  features: string[];
  model: 'haiku' | 'sonnet' | 'opus'; // Claude model tier
  coachAccess: boolean;
  analyticsAccess: boolean;
  marketplaceAccess: boolean;
  collaborationAccess: boolean;
  desktopAccess: boolean;
  learningMode: boolean;
}

export const PLANS: Record<Plan, PlanConfig> = {
  free: {
    id: 'free',
    name: 'Free',
    priceMonthly: 0,
    priceYearly: 0,
    dailyAIRequests: 20,
    maxProjects: 5,
    maxPackUploads: 0,
    cloudSyncGB: 1,
    features: [
      '20 AI requests/day',
      '5 projects',
      '1GB cloud sync',
      'AI Chat',
      'Templates',
      'Community packs access',
    ],
    model: 'haiku',
    coachAccess: false,
    analyticsAccess: false,
    marketplaceAccess: true,
    collaborationAccess: false,
    desktopAccess: true,
    learningMode: false,
  },

  creator: {
    id: 'creator',
    name: 'Creator',
    priceMonthly: 12,
    priceYearly: 99,
    dailyAIRequests: 200,
    maxProjects: 50,
    maxPackUploads: 10,
    cloudSyncGB: 20,
    features: [
      '200 AI requests/day',
      '50 projects',
      '20GB cloud sync',
      'AI Coach',
      'Pack uploads (10/mo)',
      'Creator profile',
      'Analytics basic',
    ],
    model: 'sonnet',
    coachAccess: true,
    analyticsAccess: true,
    marketplaceAccess: true,
    collaborationAccess: false,
    desktopAccess: true,
    learningMode: true,
  },

  studio: {
    id: 'studio',
    name: 'Studio',
    priceMonthly: 29,
    priceYearly: 249,
    dailyAIRequests: 9999,
    maxProjects: -1,
    maxPackUploads: 100,
    cloudSyncGB: 100,
    features: [
      'Unlimited AI',
      'Unlimited projects',
      '100GB cloud sync',
      'Full AI Coach',
      'Collaboration (coming)',
      'Advanced analytics',
      'Priority support',
    ],
    model: 'opus',
    coachAccess: true,
    analyticsAccess: true,
    marketplaceAccess: true,
    collaborationAccess: true,
    desktopAccess: true,
    learningMode: true,
  },

  learning: {
    id: 'learning',
    name: 'Learning',
    priceMonthly: 7,
    priceYearly: 59,
    dailyAIRequests: 50,
    maxProjects: 10,
    maxPackUploads: 0,
    cloudSyncGB: 5,
    features: [
      '50 AI requests/day',
      'Learning mode full access',
      'Guided courses',
      'Genre master classes',
      'MIDI exercises',
      'Progress tracking',
    ],
    model: 'sonnet',
    coachAccess: true,
    analyticsAccess: false,
    marketplaceAccess: true,
    collaborationAccess: false,
    desktopAccess: true,
    learningMode: true,
  },
};

export function getPlan(plan: string): PlanConfig {
  return PLANS[plan as Plan] ?? PLANS.free;
}

export function getDailyLimit(plan: Plan): number {
  return PLANS[plan]?.dailyAIRequests ?? 20;
}
