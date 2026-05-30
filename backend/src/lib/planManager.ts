/*
  Required Supabase table: platform_plans

  CREATE TABLE IF NOT EXISTS platform_plans (
    plan_id               TEXT PRIMARY KEY,
    name                  TEXT NOT NULL,
    slug                  TEXT NOT NULL DEFAULT '',
    description           TEXT NOT NULL DEFAULT '',
    price_monthly         NUMERIC NOT NULL DEFAULT 0,
    price_yearly          NUMERIC NOT NULL DEFAULT 0,
    price_annual          NUMERIC NOT NULL DEFAULT 0,
    currency              TEXT NOT NULL DEFAULT 'usd',
    trial_days            INTEGER NOT NULL DEFAULT 0,
    is_active             BOOLEAN NOT NULL DEFAULT true,
    is_featured           BOOLEAN NOT NULL DEFAULT false,
    sort_order            INTEGER NOT NULL DEFAULT 0,
    -- Limits (jsonb)
    limits                JSONB NOT NULL DEFAULT '{}',
    -- Features (jsonb)
    features_flags        JSONB NOT NULL DEFAULT '{}',
    -- Stripe/PayPal IDs
    stripe_monthly_price_id  TEXT NOT NULL DEFAULT '',
    stripe_annual_price_id   TEXT NOT NULL DEFAULT '',
    paypal_monthly_plan_id   TEXT NOT NULL DEFAULT '',
    paypal_annual_plan_id    TEXT NOT NULL DEFAULT '',
    -- Legacy fields (kept for backward compat)
    daily_ai_requests     INTEGER NOT NULL DEFAULT 20,
    max_projects          INTEGER NOT NULL DEFAULT 5,
    max_pack_uploads      INTEGER NOT NULL DEFAULT 0,
    cloud_sync_gb         NUMERIC NOT NULL DEFAULT 1,
    legacy_features       TEXT[] NOT NULL DEFAULT '{}',
    model                 TEXT NOT NULL DEFAULT 'haiku',
    coach_access          BOOLEAN NOT NULL DEFAULT false,
    analytics_access      BOOLEAN NOT NULL DEFAULT false,
    marketplace_access    BOOLEAN NOT NULL DEFAULT false,
    collaboration_access  BOOLEAN NOT NULL DEFAULT false,
    desktop_access        BOOLEAN NOT NULL DEFAULT true,
    learning_mode         BOOLEAN NOT NULL DEFAULT false,
    active                BOOLEAN NOT NULL DEFAULT true,
    created_at            TIMESTAMPTZ DEFAULT now(),
    updated_at            TIMESTAMPTZ DEFAULT now()
  );
*/
import { supabase } from './supabase'
import { logger } from '../utils/logger'
import { PLANS as HARDCODED_PLANS, Plan as PlanSlug, PlanConfig } from '../data/plans'

// ── Full Plan type ───────────────────────────────────────────────────────────

export interface PlanLimits {
  users: number                 // -1 = unlimited
  storageGB: number             // -1 = unlimited
  aiRequestsPerMonth: number    // -1 = unlimited
  projectsMax: number           // -1 = unlimited
  collaboratorsMax: number
  exportFormats: string[]
}

export interface PlanFeatureFlags {
  aiAccess: boolean
  premiumSounds: boolean
  vstSupport: boolean
  collaboration: boolean
  prioritySupport: boolean
  apiAccess: boolean
  advancedMixing: boolean
  stemSeparation: boolean
  cloudBackup: boolean
  customBranding: boolean
}

export interface FullPlan {
  id: string
  name: string
  slug: string              // 'free' | 'pro' | 'studio' | 'label'
  description: string
  priceMonthly: number      // in cents
  priceAnnual: number       // in cents
  currency: string          // 'usd'
  trialDays: number         // 0 = no trial
  isActive: boolean
  isFeatured: boolean
  sortOrder: number
  // Limits
  limits: PlanLimits
  // Features (boolean flags)
  featureFlags: PlanFeatureFlags
  // Stripe/PayPal IDs
  stripeMonthlyPriceId: string
  stripeAnnualPriceId: string
  paypalMonthlyPlanId: string
  paypalAnnualPlanId: string
  // Legacy fields (backward compat)
  priceYearly: number
  dailyAIRequests: number
  maxProjects: number
  maxPackUploads: number
  cloudSyncGB: number
  features: string[]
  model: 'haiku' | 'sonnet' | 'opus'
  coachAccess: boolean
  analyticsAccess: boolean
  marketplaceAccess: boolean
  collaborationAccess: boolean
  desktopAccess: boolean
  learningMode: boolean
  // Meta
  createdAt: string
  updatedAt: string
}

// ── Legacy ManagedPlan (kept for backward compat) ────────────────────────────

export interface ManagedPlan extends PlanConfig {
  active: boolean
  trialDays: number
  updatedAt: string
  sortOrder: number
}

// ── Default full plans ───────────────────────────────────────────────────────

const DEFAULT_FULL_PLANS: FullPlan[] = [
  {
    id: 'free',
    name: 'Free',
    slug: 'free',
    description: 'Get started with AI-powered music creation at no cost.',
    priceMonthly: 0,
    priceAnnual: 0,
    currency: 'usd',
    trialDays: 0,
    isActive: true,
    isFeatured: false,
    sortOrder: 0,
    limits: {
      users: 1,
      storageGB: 1,
      aiRequestsPerMonth: 600,   // 20/day * 30
      projectsMax: 5,
      collaboratorsMax: 0,
      exportFormats: ['mp3'],
    },
    featureFlags: {
      aiAccess: true,
      premiumSounds: false,
      vstSupport: false,
      collaboration: false,
      prioritySupport: false,
      apiAccess: false,
      advancedMixing: false,
      stemSeparation: false,
      cloudBackup: false,
      customBranding: false,
    },
    stripeMonthlyPriceId: '',
    stripeAnnualPriceId: '',
    paypalMonthlyPlanId: '',
    paypalAnnualPlanId: '',
    // Legacy
    priceYearly: 0,
    dailyAIRequests: 20,
    maxProjects: 5,
    maxPackUploads: 0,
    cloudSyncGB: 1,
    features: ['20 AI requests/day', '5 projects', '1GB cloud sync', 'AI Chat', 'Templates', 'Community packs access'],
    model: 'haiku',
    coachAccess: false,
    analyticsAccess: false,
    marketplaceAccess: true,
    collaborationAccess: false,
    desktopAccess: true,
    learningMode: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'pro',
    name: 'Pro',
    slug: 'pro',
    description: 'Professional tools for serious music creators.',
    priceMonthly: 1200,    // $12.00
    priceAnnual: 9900,     // $99.00/year
    currency: 'usd',
    trialDays: 14,
    isActive: true,
    isFeatured: true,
    sortOrder: 1,
    limits: {
      users: 1,
      storageGB: 20,
      aiRequestsPerMonth: 6000,  // 200/day * 30
      projectsMax: 50,
      collaboratorsMax: 3,
      exportFormats: ['mp3', 'wav', 'flac'],
    },
    featureFlags: {
      aiAccess: true,
      premiumSounds: true,
      vstSupport: false,
      collaboration: false,
      prioritySupport: false,
      apiAccess: false,
      advancedMixing: true,
      stemSeparation: false,
      cloudBackup: true,
      customBranding: false,
    },
    stripeMonthlyPriceId: '',
    stripeAnnualPriceId: '',
    paypalMonthlyPlanId: '',
    paypalAnnualPlanId: '',
    // Legacy
    priceYearly: 99,
    dailyAIRequests: 200,
    maxProjects: 50,
    maxPackUploads: 10,
    cloudSyncGB: 20,
    features: ['200 AI requests/day', '50 projects', '20GB cloud sync', 'AI Coach', 'Pack uploads (10/mo)', 'Creator profile', 'Analytics basic'],
    model: 'sonnet',
    coachAccess: true,
    analyticsAccess: true,
    marketplaceAccess: true,
    collaborationAccess: false,
    desktopAccess: true,
    learningMode: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'studio',
    name: 'Studio',
    slug: 'studio',
    description: 'Unlimited AI power for studios and power users.',
    priceMonthly: 2900,    // $29.00
    priceAnnual: 24900,    // $249.00/year
    currency: 'usd',
    trialDays: 14,
    isActive: true,
    isFeatured: false,
    sortOrder: 2,
    limits: {
      users: 5,
      storageGB: 100,
      aiRequestsPerMonth: -1,    // unlimited
      projectsMax: -1,           // unlimited
      collaboratorsMax: 10,
      exportFormats: ['mp3', 'wav', 'flac', 'aiff', 'stems'],
    },
    featureFlags: {
      aiAccess: true,
      premiumSounds: true,
      vstSupport: true,
      collaboration: true,
      prioritySupport: true,
      apiAccess: false,
      advancedMixing: true,
      stemSeparation: true,
      cloudBackup: true,
      customBranding: false,
    },
    stripeMonthlyPriceId: '',
    stripeAnnualPriceId: '',
    paypalMonthlyPlanId: '',
    paypalAnnualPlanId: '',
    // Legacy
    priceYearly: 249,
    dailyAIRequests: 9999,
    maxProjects: -1,
    maxPackUploads: 100,
    cloudSyncGB: 100,
    features: ['Unlimited AI', 'Unlimited projects', '100GB cloud sync', 'Full AI Coach', 'Collaboration', 'Advanced analytics', 'Priority support'],
    model: 'opus',
    coachAccess: true,
    analyticsAccess: true,
    marketplaceAccess: true,
    collaborationAccess: true,
    desktopAccess: true,
    learningMode: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'label',
    name: 'Label',
    slug: 'label',
    description: 'Enterprise-grade solution for record labels and agencies.',
    priceMonthly: 9900,    // $99.00
    priceAnnual: 99900,    // $999.00/year
    currency: 'usd',
    trialDays: 30,
    isActive: true,
    isFeatured: false,
    sortOrder: 3,
    limits: {
      users: -1,             // unlimited
      storageGB: -1,         // unlimited
      aiRequestsPerMonth: -1,
      projectsMax: -1,
      collaboratorsMax: -1,
      exportFormats: ['mp3', 'wav', 'flac', 'aiff', 'stems', 'dolby-atmos'],
    },
    featureFlags: {
      aiAccess: true,
      premiumSounds: true,
      vstSupport: true,
      collaboration: true,
      prioritySupport: true,
      apiAccess: true,
      advancedMixing: true,
      stemSeparation: true,
      cloudBackup: true,
      customBranding: true,
    },
    stripeMonthlyPriceId: '',
    stripeAnnualPriceId: '',
    paypalMonthlyPlanId: '',
    paypalAnnualPlanId: '',
    // Legacy
    priceYearly: 999,
    dailyAIRequests: 9999,
    maxProjects: -1,
    maxPackUploads: -1,
    cloudSyncGB: -1,
    features: ['Unlimited everything', 'Custom branding', 'Dedicated support', 'API access', 'SSO', 'SLA guarantee', 'Dolby Atmos export'],
    model: 'opus',
    coachAccess: true,
    analyticsAccess: true,
    marketplaceAccess: true,
    collaborationAccess: true,
    desktopAccess: true,
    learningMode: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

// ── Runtime plan store ───────────────────────────────────────────────────────
// Initialized from default full plans; overwritten by Supabase if configured.

// Convert hardcoded PlanConfig to ManagedPlan (legacy compat)
function toManaged(plan: PlanConfig, order: number): ManagedPlan {
  return {
    ...plan,
    active: true,
    trialDays: 0,
    updatedAt: new Date().toISOString(),
    sortOrder: order,
  }
}

// Full plan store (new)
let fullPlanStore: Map<string, FullPlan> = new Map(
  DEFAULT_FULL_PLANS.map(p => [p.id, p])
)

// Legacy store — also populated from full plans for backward compat
let planStore: Map<string, ManagedPlan> = new Map(
  Object.entries(HARDCODED_PLANS).map(([k, v], i) => [k, toManaged(v as PlanConfig, i)])
)

function fullToManaged(fp: FullPlan): ManagedPlan {
  return {
    id: fp.id as PlanSlug,
    name: fp.name,
    priceMonthly: fp.priceMonthly / 100,   // convert cents to legacy EUR-style
    priceYearly: fp.priceAnnual / 100,
    dailyAIRequests: fp.dailyAIRequests,
    maxProjects: fp.maxProjects,
    maxPackUploads: fp.maxPackUploads,
    cloudSyncGB: fp.cloudSyncGB,
    features: fp.features,
    model: fp.model,
    coachAccess: fp.coachAccess,
    analyticsAccess: fp.analyticsAccess,
    marketplaceAccess: fp.marketplaceAccess,
    collaborationAccess: fp.collaborationAccess,
    desktopAccess: fp.desktopAccess,
    learningMode: fp.learningMode,
    active: fp.isActive,
    trialDays: fp.trialDays,
    updatedAt: fp.updatedAt,
    sortOrder: fp.sortOrder,
  }
}

// Sync full plan store to legacy store
function syncLegacyStore(): void {
  for (const fp of fullPlanStore.values()) {
    planStore.set(fp.id, fullToManaged(fp))
  }
}

// Initialize legacy store from full plans
syncLegacyStore()

// ── Supabase persistence ──────────────────────────────────────────────────────

async function loadFromDb(): Promise<void> {
  if (!supabase) return
  const { data, error } = await (supabase
    .from('platform_plans')
    .select('*')
    .order('sort_order', { ascending: true }) as any)
  if (error || !data?.length) return

  const loadedFull = new Map<string, FullPlan>()
  const loadedLegacy = new Map<string, ManagedPlan>()

  for (const row of data as Array<Record<string, unknown>>) {
    const id = row['plan_id'] as string
    const now = new Date().toISOString()

    // Parse jsonb fields
    const limitsRaw = (row['limits'] as PlanLimits | null) ?? {}
    const flagsRaw = (row['features_flags'] as PlanFeatureFlags | null) ?? {}

    const fp: FullPlan = {
      id,
      name: row['name'] as string,
      slug: (row['slug'] as string) || id,
      description: (row['description'] as string) || '',
      priceMonthly: (row['price_monthly'] as number) ?? 0,
      priceAnnual: (row['price_annual'] as number) ?? (row['price_yearly'] as number) ?? 0,
      currency: (row['currency'] as string) || 'usd',
      trialDays: (row['trial_days'] as number) ?? 0,
      isActive: (row['is_active'] as boolean) ?? (row['active'] as boolean) ?? true,
      isFeatured: (row['is_featured'] as boolean) ?? false,
      sortOrder: (row['sort_order'] as number) ?? 0,
      limits: {
        users: (limitsRaw as PlanLimits).users ?? 1,
        storageGB: (limitsRaw as PlanLimits).storageGB ?? 1,
        aiRequestsPerMonth: (limitsRaw as PlanLimits).aiRequestsPerMonth ?? 600,
        projectsMax: (limitsRaw as PlanLimits).projectsMax ?? 5,
        collaboratorsMax: (limitsRaw as PlanLimits).collaboratorsMax ?? 0,
        exportFormats: (limitsRaw as PlanLimits).exportFormats ?? ['mp3'],
      },
      featureFlags: {
        aiAccess: (flagsRaw as PlanFeatureFlags).aiAccess ?? true,
        premiumSounds: (flagsRaw as PlanFeatureFlags).premiumSounds ?? false,
        vstSupport: (flagsRaw as PlanFeatureFlags).vstSupport ?? false,
        collaboration: (flagsRaw as PlanFeatureFlags).collaboration ?? false,
        prioritySupport: (flagsRaw as PlanFeatureFlags).prioritySupport ?? false,
        apiAccess: (flagsRaw as PlanFeatureFlags).apiAccess ?? false,
        advancedMixing: (flagsRaw as PlanFeatureFlags).advancedMixing ?? false,
        stemSeparation: (flagsRaw as PlanFeatureFlags).stemSeparation ?? false,
        cloudBackup: (flagsRaw as PlanFeatureFlags).cloudBackup ?? false,
        customBranding: (flagsRaw as PlanFeatureFlags).customBranding ?? false,
      },
      stripeMonthlyPriceId: (row['stripe_monthly_price_id'] as string) || '',
      stripeAnnualPriceId: (row['stripe_annual_price_id'] as string) || '',
      paypalMonthlyPlanId: (row['paypal_monthly_plan_id'] as string) || '',
      paypalAnnualPlanId: (row['paypal_annual_plan_id'] as string) || '',
      // Legacy
      priceYearly: (row['price_yearly'] as number) ?? 0,
      dailyAIRequests: (row['daily_ai_requests'] as number) ?? 20,
      maxProjects: (row['max_projects'] as number) ?? 5,
      maxPackUploads: (row['max_pack_uploads'] as number) ?? 0,
      cloudSyncGB: (row['cloud_sync_gb'] as number) ?? 1,
      features: (row['legacy_features'] as string[]) ?? (row['features'] as string[]) ?? [],
      model: (row['model'] as 'haiku' | 'sonnet' | 'opus') ?? 'haiku',
      coachAccess: (row['coach_access'] as boolean) ?? false,
      analyticsAccess: (row['analytics_access'] as boolean) ?? false,
      marketplaceAccess: (row['marketplace_access'] as boolean) ?? true,
      collaborationAccess: (row['collaboration_access'] as boolean) ?? false,
      desktopAccess: (row['desktop_access'] as boolean) ?? true,
      learningMode: (row['learning_mode'] as boolean) ?? false,
      createdAt: (row['created_at'] as string) || now,
      updatedAt: (row['updated_at'] as string) || now,
    }

    loadedFull.set(id, fp)
    loadedLegacy.set(id, fullToManaged(fp))
  }

  if (loadedFull.size > 0) {
    fullPlanStore = loadedFull
    planStore = loadedLegacy
    logger.info(`[planManager] loaded ${loadedFull.size} plans from Supabase`)
  }
}

async function saveToDb(plan: FullPlan): Promise<void> {
  if (!supabase) return
  const row = {
    plan_id:                    plan.id,
    name:                       plan.name,
    slug:                       plan.slug,
    description:                plan.description,
    price_monthly:              plan.priceMonthly,
    price_annual:               plan.priceAnnual,
    price_yearly:               plan.priceYearly,
    currency:                   plan.currency,
    trial_days:                 plan.trialDays,
    is_active:                  plan.isActive,
    is_featured:                plan.isFeatured,
    sort_order:                 plan.sortOrder,
    limits:                     plan.limits,
    features_flags:             plan.featureFlags,
    stripe_monthly_price_id:    plan.stripeMonthlyPriceId,
    stripe_annual_price_id:     plan.stripeAnnualPriceId,
    paypal_monthly_plan_id:     plan.paypalMonthlyPlanId,
    paypal_annual_plan_id:      plan.paypalAnnualPlanId,
    // Legacy fields
    daily_ai_requests:          plan.dailyAIRequests,
    max_projects:               plan.maxProjects,
    max_pack_uploads:           plan.maxPackUploads,
    cloud_sync_gb:              plan.cloudSyncGB,
    legacy_features:            plan.features,
    model:                      plan.model,
    coach_access:               plan.coachAccess,
    analytics_access:           plan.analyticsAccess,
    marketplace_access:         plan.marketplaceAccess,
    collaboration_access:       plan.collaborationAccess,
    desktop_access:             plan.desktopAccess,
    learning_mode:              plan.learningMode,
    active:                     plan.isActive,
    updated_at:                 new Date().toISOString(),
  }
  const { error } = await (supabase
    .from('platform_plans')
    .upsert(row, { onConflict: 'plan_id' }) as any)
  if (error) logger.error('[planManager] save failed:', { message: error.message })
}

// Initialize — load from DB on startup (non-blocking)
loadFromDb().catch(() => {})

// ── Public API (full plans) ──────────────────────────────────────────────────

export function getFullPlans(includeInactive = false): FullPlan[] {
  const all = Array.from(fullPlanStore.values())
  return (includeInactive ? all : all.filter(p => p.isActive))
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

export function getFullPlan(id: string): FullPlan | undefined {
  return fullPlanStore.get(id)
}

export async function updateFullPlan(id: string, updates: Partial<Omit<FullPlan, 'id' | 'createdAt'>>): Promise<FullPlan | null> {
  const existing = fullPlanStore.get(id)
  if (!existing) return null
  const updated: FullPlan = {
    ...existing,
    ...updates,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  }
  fullPlanStore.set(id, updated)
  planStore.set(id, fullToManaged(updated))
  await saveToDb(updated)
  return updated
}

export async function createFullPlan(plan: Omit<FullPlan, 'createdAt' | 'updatedAt' | 'sortOrder'>): Promise<FullPlan> {
  const maxOrder = Math.max(...Array.from(fullPlanStore.values()).map(p => p.sortOrder), -1)
  const now = new Date().toISOString()
  const newPlan: FullPlan = {
    ...plan,
    sortOrder: maxOrder + 1,
    createdAt: now,
    updatedAt: now,
  }
  fullPlanStore.set(plan.id, newPlan)
  planStore.set(plan.id, fullToManaged(newPlan))
  await saveToDb(newPlan)
  return newPlan
}

export async function toggleFullPlan(id: string, active: boolean): Promise<FullPlan | null> {
  return updateFullPlan(id, { isActive: active })
}

// ── Public API (legacy — kept for backward compat) ───────────────────────────

export function getPlans(includeInactive = false): ManagedPlan[] {
  const all = Array.from(planStore.values())
  return (includeInactive ? all : all.filter(p => p.active))
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

export function getPlan(id: string): ManagedPlan | undefined {
  return planStore.get(id)
}

export async function updatePlan(id: string, updates: Partial<Omit<ManagedPlan, 'id'>>): Promise<ManagedPlan | null> {
  const existing = planStore.get(id)
  if (!existing) return null
  const updated: ManagedPlan = { ...existing, ...updates, id: existing.id, updatedAt: new Date().toISOString() }
  planStore.set(id, updated)
  // Also sync to full plan store
  const fp = fullPlanStore.get(id)
  if (fp) {
    const updatedFull: FullPlan = {
      ...fp,
      isActive: updated.active,
      trialDays: updated.trialDays,
      sortOrder: updated.sortOrder,
      dailyAIRequests: updated.dailyAIRequests,
      maxProjects: updated.maxProjects,
      maxPackUploads: updated.maxPackUploads,
      cloudSyncGB: updated.cloudSyncGB,
      features: updated.features,
      model: updated.model,
      coachAccess: updated.coachAccess,
      analyticsAccess: updated.analyticsAccess,
      marketplaceAccess: updated.marketplaceAccess,
      collaborationAccess: updated.collaborationAccess,
      desktopAccess: updated.desktopAccess,
      learningMode: updated.learningMode,
      updatedAt: updated.updatedAt,
    }
    fullPlanStore.set(id, updatedFull)
    await saveToDb(updatedFull)
  }
  return updated
}

export async function createPlan(plan: Omit<ManagedPlan, 'updatedAt' | 'sortOrder'>): Promise<ManagedPlan> {
  const maxOrder = Math.max(...Array.from(planStore.values()).map(p => p.sortOrder), -1)
  const newPlan: ManagedPlan = { ...plan, updatedAt: new Date().toISOString(), sortOrder: maxOrder + 1 }
  planStore.set(plan.id, newPlan)
  // Also create in full store with defaults
  const now = new Date().toISOString()
  const newFull: FullPlan = {
    id: plan.id,
    name: plan.name,
    slug: plan.id,
    description: '',
    priceMonthly: Math.round(plan.priceMonthly * 100),
    priceAnnual: Math.round(plan.priceYearly * 100),
    currency: 'usd',
    trialDays: plan.trialDays,
    isActive: plan.active,
    isFeatured: false,
    sortOrder: newPlan.sortOrder,
    limits: {
      users: 1,
      storageGB: plan.cloudSyncGB,
      aiRequestsPerMonth: plan.dailyAIRequests * 30,
      projectsMax: plan.maxProjects,
      collaboratorsMax: 0,
      exportFormats: ['mp3'],
    },
    featureFlags: {
      aiAccess: true,
      premiumSounds: false,
      vstSupport: false,
      collaboration: plan.collaborationAccess,
      prioritySupport: false,
      apiAccess: false,
      advancedMixing: false,
      stemSeparation: false,
      cloudBackup: plan.cloudSyncGB > 1,
      customBranding: false,
    },
    stripeMonthlyPriceId: '',
    stripeAnnualPriceId: '',
    paypalMonthlyPlanId: '',
    paypalAnnualPlanId: '',
    priceYearly: plan.priceYearly,
    dailyAIRequests: plan.dailyAIRequests,
    maxProjects: plan.maxProjects,
    maxPackUploads: plan.maxPackUploads,
    cloudSyncGB: plan.cloudSyncGB,
    features: plan.features,
    model: plan.model,
    coachAccess: plan.coachAccess,
    analyticsAccess: plan.analyticsAccess,
    marketplaceAccess: plan.marketplaceAccess,
    collaborationAccess: plan.collaborationAccess,
    desktopAccess: plan.desktopAccess,
    learningMode: plan.learningMode,
    createdAt: now,
    updatedAt: now,
  }
  fullPlanStore.set(plan.id, newFull)
  await saveToDb(newFull)
  return newPlan
}

export async function togglePlan(id: string, active: boolean): Promise<ManagedPlan | null> {
  return updatePlan(id, { active })
}

export function getPlanForQuota(planId: string): { dailyAIRequests: number; model: string } {
  const plan = planStore.get(planId) ?? planStore.get('free')
  return { dailyAIRequests: plan?.dailyAIRequests ?? 20, model: plan?.model ?? 'haiku' }
}

export function getPlanLimits(planId: string): PlanLimits | undefined {
  return fullPlanStore.get(planId)?.limits
}
