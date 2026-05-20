/*
  Required Supabase table: platform_plans

  CREATE TABLE IF NOT EXISTS platform_plans (
    plan_id               TEXT PRIMARY KEY,
    name                  TEXT NOT NULL,
    price_monthly         NUMERIC NOT NULL DEFAULT 0,
    price_yearly          NUMERIC NOT NULL DEFAULT 0,
    daily_ai_requests     INTEGER NOT NULL DEFAULT 20,
    max_projects          INTEGER NOT NULL DEFAULT 5,
    max_pack_uploads      INTEGER NOT NULL DEFAULT 0,
    cloud_sync_gb         NUMERIC NOT NULL DEFAULT 1,
    features              TEXT[] NOT NULL DEFAULT '{}',
    model                 TEXT NOT NULL DEFAULT 'haiku',
    coach_access          BOOLEAN NOT NULL DEFAULT false,
    analytics_access      BOOLEAN NOT NULL DEFAULT false,
    marketplace_access    BOOLEAN NOT NULL DEFAULT false,
    collaboration_access  BOOLEAN NOT NULL DEFAULT false,
    desktop_access        BOOLEAN NOT NULL DEFAULT true,
    learning_mode         BOOLEAN NOT NULL DEFAULT false,
    active                BOOLEAN NOT NULL DEFAULT true,
    trial_days            INTEGER NOT NULL DEFAULT 0,
    sort_order            INTEGER NOT NULL DEFAULT 0,
    updated_at            TIMESTAMPTZ DEFAULT now()
  );
*/
import { supabase } from './supabase'
import { logger } from '../utils/logger'
import { PLANS as HARDCODED_PLANS, Plan, PlanConfig } from '../data/plans'

// ── Runtime plan store ───────────────────────────────────────────────────────
// Initialized from hardcoded plans; overwritten by Supabase if configured.

export interface ManagedPlan extends PlanConfig {
  active: boolean
  trialDays: number
  updatedAt: string
  sortOrder: number
}

// Convert hardcoded PlanConfig to ManagedPlan
function toManaged(plan: PlanConfig, order: number): ManagedPlan {
  return {
    ...plan,
    active: true,
    trialDays: 0,
    updatedAt: new Date().toISOString(),
    sortOrder: order,
  }
}

// In-memory store — mutable at runtime
let planStore: Map<string, ManagedPlan> = new Map(
  Object.entries(HARDCODED_PLANS).map(([k, v], i) => [k, toManaged(v as PlanConfig, i)])
)

// ── Supabase persistence ──────────────────────────────────────────────────────

async function loadFromDb(): Promise<void> {
  if (!supabase) return
  const { data, error } = await (supabase
    .from('platform_plans')
    .select('*')
    .order('sort_order', { ascending: true }) as any)
  if (error || !data?.length) return

  const loaded = new Map<string, ManagedPlan>()
  for (const row of data as Array<Record<string, unknown>>) {
    const id = row['plan_id'] as string
    loaded.set(id, {
      id: id as Plan,
      name:              row['name'] as string,
      priceMonthly:      row['price_monthly'] as number,
      priceYearly:       row['price_yearly'] as number,
      dailyAIRequests:   row['daily_ai_requests'] as number,
      maxProjects:       row['max_projects'] as number,
      maxPackUploads:    row['max_pack_uploads'] as number,
      cloudSyncGB:       row['cloud_sync_gb'] as number,
      features:          (row['features'] as string[]) ?? [],
      model:             (row['model'] as 'haiku' | 'sonnet' | 'opus') ?? 'haiku',
      coachAccess:       row['coach_access'] as boolean,
      analyticsAccess:   row['analytics_access'] as boolean,
      marketplaceAccess: row['marketplace_access'] as boolean,
      collaborationAccess: row['collaboration_access'] as boolean,
      desktopAccess:     row['desktop_access'] as boolean,
      learningMode:      (row['learning_mode'] as boolean) ?? false,
      active:            (row['active'] as boolean) ?? true,
      trialDays:         (row['trial_days'] as number) ?? 0,
      updatedAt:         row['updated_at'] as string,
      sortOrder:         (row['sort_order'] as number) ?? 0,
    })
  }
  if (loaded.size > 0) {
    planStore = loaded
    logger.info(`[planManager] loaded ${loaded.size} plans from Supabase`)
  }
}

async function saveToDb(plan: ManagedPlan): Promise<void> {
  if (!supabase) return
  const row = {
    plan_id:               plan.id,
    name:                  plan.name,
    price_monthly:         plan.priceMonthly,
    price_yearly:          plan.priceYearly,
    daily_ai_requests:     plan.dailyAIRequests,
    max_projects:          plan.maxProjects,
    max_pack_uploads:      plan.maxPackUploads,
    cloud_sync_gb:         plan.cloudSyncGB,
    features:              plan.features,
    model:                 plan.model,
    coach_access:          plan.coachAccess,
    analytics_access:      plan.analyticsAccess,
    marketplace_access:    plan.marketplaceAccess,
    collaboration_access:  plan.collaborationAccess,
    desktop_access:        plan.desktopAccess,
    learning_mode:         plan.learningMode,
    active:                plan.active,
    trial_days:            plan.trialDays,
    sort_order:            plan.sortOrder,
    updated_at:            new Date().toISOString(),
  }
  const { error } = await (supabase
    .from('platform_plans')
    .upsert(row, { onConflict: 'plan_id' }) as any)
  if (error) logger.error('[planManager] save failed:', { message: error.message })
}

// Initialize — load from DB on startup (non-blocking)
loadFromDb().catch(() => {})

// ── Public API ───────────────────────────────────────────────────────────────

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
  await saveToDb(updated)
  return updated
}

export async function createPlan(plan: Omit<ManagedPlan, 'updatedAt' | 'sortOrder'>): Promise<ManagedPlan> {
  const maxOrder = Math.max(...Array.from(planStore.values()).map(p => p.sortOrder), -1)
  const newPlan: ManagedPlan = { ...plan, updatedAt: new Date().toISOString(), sortOrder: maxOrder + 1 }
  planStore.set(plan.id, newPlan)
  await saveToDb(newPlan)
  return newPlan
}

export async function togglePlan(id: string, active: boolean): Promise<ManagedPlan | null> {
  return updatePlan(id, { active })
}

export function getPlanForQuota(planId: string): { dailyAIRequests: number; model: string } {
  const plan = planStore.get(planId) ?? planStore.get('free')
  return { dailyAIRequests: plan?.dailyAIRequests ?? 20, model: plan?.model ?? 'haiku' }
}
