/*
  Required Supabase table:

  CREATE TABLE IF NOT EXISTS platform_credit_packs (
    pack_id      TEXT PRIMARY KEY,
    credits      INTEGER NOT NULL,
    amount_cents INTEGER NOT NULL,
    active       BOOLEAN NOT NULL DEFAULT true,
    sort_order   INTEGER NOT NULL DEFAULT 0,
    updated_at   TIMESTAMPTZ DEFAULT now()
  );
*/
import { supabase } from './supabase'
import { logger } from '../utils/logger'

export interface CreditPack {
  id: string
  credits: number
  amountCents: number
  active: boolean
  sortOrder: number
  updatedAt: string
}

const DEFAULTS: CreditPack[] = [
  { id: '100',  credits: 100,  amountCents: 499,  active: true, sortOrder: 0, updatedAt: new Date().toISOString() },
  { id: '500',  credits: 500,  amountCents: 1999, active: true, sortOrder: 1, updatedAt: new Date().toISOString() },
  { id: '2000', credits: 2000, amountCents: 6999, active: true, sortOrder: 2, updatedAt: new Date().toISOString() },
]

let packStore: Map<string, CreditPack> = new Map(DEFAULTS.map(p => [p.id, p]))

async function loadFromDb(): Promise<void> {
  if (!supabase) return
  const { data, error } = await (supabase
    .from('platform_credit_packs')
    .select('*')
    .order('sort_order', { ascending: true }) as any)
  if (error || !data?.length) return
  const loaded = new Map<string, CreditPack>()
  for (const row of data as Array<Record<string, unknown>>) {
    loaded.set(row['pack_id'] as string, {
      id:          row['pack_id'] as string,
      credits:     row['credits'] as number,
      amountCents: row['amount_cents'] as number,
      active:      (row['active'] as boolean) ?? true,
      sortOrder:   (row['sort_order'] as number) ?? 0,
      updatedAt:   row['updated_at'] as string,
    })
  }
  if (loaded.size > 0) {
    packStore = loaded
    logger.info(`[creditPackManager] loaded ${loaded.size} packs from Supabase`)
  }
}

async function saveToDb(pack: CreditPack): Promise<void> {
  if (!supabase) return
  const { error } = await (supabase
    .from('platform_credit_packs')
    .upsert({
      pack_id:      pack.id,
      credits:      pack.credits,
      amount_cents: pack.amountCents,
      active:       pack.active,
      sort_order:   pack.sortOrder,
      updated_at:   new Date().toISOString(),
    }, { onConflict: 'pack_id' }) as any)
  if (error) logger.error('[creditPackManager] save failed:', { message: error.message })
}

loadFromDb().catch(() => {})

export function getCreditPacks(includeInactive = false): CreditPack[] {
  const all = Array.from(packStore.values())
  return (includeInactive ? all : all.filter(p => p.active))
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

export function getCreditPack(id: string): CreditPack | undefined {
  return packStore.get(id)
}

export async function updateCreditPack(id: string, updates: Partial<Omit<CreditPack, 'id'>>): Promise<CreditPack | null> {
  const existing = packStore.get(id)
  if (!existing) return null
  const updated: CreditPack = { ...existing, ...updates, id: existing.id, updatedAt: new Date().toISOString() }
  packStore.set(id, updated)
  await saveToDb(updated)
  return updated
}

export async function toggleCreditPack(id: string, active: boolean): Promise<CreditPack | null> {
  return updateCreditPack(id, { active })
}
