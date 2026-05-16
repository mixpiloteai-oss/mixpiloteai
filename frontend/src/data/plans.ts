// ============================================================
// NEUROTEK AI — Subscription Plans Configuration (Frontend)
// ============================================================

export type Plan = 'free' | 'creator' | 'studio' | 'learning';

export interface PlanFeature {
  label: string;
  included: boolean;
  highlight?: boolean;
}

export interface PlanConfig {
  id: Plan;
  name: string;
  tagline: string;
  priceMonthly: number;
  priceYearly: number;
  color: string;
  hexColor: string;
  dailyAI: number | 'unlimited';
  maxProjects: number | 'unlimited';
  cloudGB: number;
  features: PlanFeature[];
  popular?: boolean;
}

export const PLANS: PlanConfig[] = [
  {
    id: 'free', name: 'Free', tagline: 'Start producing today',
    priceMonthly: 0, priceYearly: 0, color: 'gray', hexColor: '#6b7280',
    dailyAI: 20, maxProjects: 5, cloudGB: 1,
    features: [
      { label: '20 AI requests/day', included: true },
      { label: 'AI Chat & Templates', included: true },
      { label: '5 projects', included: true },
      { label: '1 GB cloud sync', included: true },
      { label: 'Community packs', included: true },
      { label: 'AI Coach', included: false },
      { label: 'Analytics', included: false },
      { label: 'Pack uploads', included: false },
    ],
  },
  {
    id: 'creator', name: 'Creator', tagline: 'For serious producers',
    priceMonthly: 12, priceYearly: 99, color: 'purple', hexColor: '#7c3aed',
    dailyAI: 200, maxProjects: 50, cloudGB: 20, popular: true,
    features: [
      { label: '200 AI requests/day', included: true, highlight: true },
      { label: 'AI Coach (all genres)', included: true, highlight: true },
      { label: '50 projects', included: true },
      { label: '20 GB cloud sync', included: true },
      { label: '10 pack uploads/month', included: true },
      { label: 'Creator profile', included: true },
      { label: 'Basic analytics', included: true },
      { label: 'Learning mode', included: true },
    ],
  },
  {
    id: 'studio', name: 'Studio', tagline: 'Professional & unlimited',
    priceMonthly: 29, priceYearly: 249, color: 'cyan', hexColor: '#06b6d4',
    dailyAI: 'unlimited', maxProjects: 'unlimited', cloudGB: 100,
    features: [
      { label: 'Unlimited AI requests', included: true, highlight: true },
      { label: 'Priority AI (Opus model)', included: true, highlight: true },
      { label: 'Unlimited projects', included: true },
      { label: '100 GB cloud sync', included: true },
      { label: '100 pack uploads/month', included: true },
      { label: 'Advanced analytics', included: true },
      { label: 'Collaboration (coming)', included: true },
      { label: 'Priority support', included: true },
    ],
  },
  {
    id: 'learning', name: 'Learning', tagline: 'Master your genre',
    priceMonthly: 7, priceYearly: 59, color: 'amber', hexColor: '#f59e0b',
    dailyAI: 50, maxProjects: 10, cloudGB: 5,
    features: [
      { label: '50 AI requests/day', included: true },
      { label: 'Full AI Coach access', included: true, highlight: true },
      { label: 'Guided genre courses', included: true, highlight: true },
      { label: 'MIDI exercises', included: true },
      { label: 'Progress tracking', included: true },
      { label: '10 projects', included: true },
      { label: '5 GB cloud sync', included: true },
      { label: 'Pack uploads', included: false },
    ],
  },
];

export function getPlanById(id: string): PlanConfig | undefined {
  return PLANS.find((p) => p.id === id);
}
