// ============================================================
// NEUROTEK AI — Coupon Service
// When Supabase is configured: persists in PostgreSQL.
// When Supabase is NOT configured (dev/test): uses in-memory
// fallback so the server boots and tests pass.
// ============================================================

import { v4 as uuidv4 } from 'uuid'
import { isSupabaseConfigured } from '../lib/supabase'
import { couponRepository }     from '../repositories/couponRepository'
import { logger }               from '../utils/logger'

export type CouponType = 'percent_off' | 'amount_off' | 'trial_days'

export interface Coupon {
  id: string; code: string; type: CouponType; value: number
  applicablePlans: string[]; maxUses: number; usedCount: number
  expiresAt: number; active: boolean; createdAt: number; description: string
}

// ── Row → Domain mapper ───────────────────────────────────────
function rowToCoupon(r: any): Coupon {
  return {
    id:              r.id,
    code:            r.code,
    type:            r.type as CouponType,
    value:           Number(r.value),
    applicablePlans: r.applicable_plans ?? [],
    maxUses:         r.max_uses,
    usedCount:       r.used_count,
    expiresAt:       Number(r.expires_at),
    active:          r.active,
    createdAt:       new Date(r.created_at).getTime(),
    description:     r.description,
  }
}

// ── Default coupon definitions ────────────────────────────────
function buildDefaultCoupons(): Coupon[] {
  const now = Date.now()
  const day = 86_400_000
  return [
    { id: uuidv4(), code: 'WELCOME20',   type: 'percent_off', value: 20,  applicablePlans: [],         maxUses: -1,   usedCount: 0, expiresAt: -1,            active: true, createdAt: now, description: '20% off — welcome discount' },
    { id: uuidv4(), code: 'LAUNCH50',    type: 'percent_off', value: 50,  applicablePlans: [],         maxUses: 500,  usedCount: 0, expiresAt: now+90*day,    active: true, createdAt: now, description: '50% off first month — all plans' },
    { id: uuidv4(), code: 'ANNUAL20',    type: 'percent_off', value: 20,  applicablePlans: [],         maxUses: -1,   usedCount: 0, expiresAt: -1,            active: true, createdAt: now, description: '20% off annual subscription' },
    { id: uuidv4(), code: 'STUDIO30',    type: 'percent_off', value: 30,  applicablePlans: ['studio'], maxUses: 200,  usedCount: 0, expiresAt: -1,            active: true, createdAt: now, description: '30% off Studio plan' },
    { id: uuidv4(), code: 'FREEMONTH',   type: 'trial_days',  value: 30,  applicablePlans: [],         maxUses: 100,  usedCount: 0, expiresAt: -1,            active: true, createdAt: now, description: '30 days free trial extension' },
    { id: uuidv4(), code: 'WELCOME',     type: 'amount_off',  value: 500, applicablePlans: [],         maxUses: -1,   usedCount: 0, expiresAt: -1,            active: true, createdAt: now, description: '$5 off — all plans' },
    { id: uuidv4(), code: 'PRODUCER2025',type: 'percent_off', value: 25,  applicablePlans: ['pro'],    maxUses: 1000, usedCount: 0, expiresAt: -1,            active: true, createdAt: now, description: '25% off Pro plan' },
    { id: uuidv4(), code: 'EARLYBIRD',   type: 'percent_off', value: 40,  applicablePlans: [],         maxUses: 300,  usedCount: 0, expiresAt: -1,            active: true, createdAt: now, description: '40% off — early adopter discount' },
  ]
}

// ── In-memory fallback (used only when Supabase NOT configured) ──
const _coupons   = new Map<string, Coupon>()           // keyed by code
const _redeemed  = new Map<string, Set<string>>()      // code → Set<userId>
let _memSeeded   = false

function memEnsureSeeded(): void {
  if (_memSeeded) return
  _memSeeded = true
  for (const c of buildDefaultCoupons()) _coupons.set(c.code, c)
}

// ── DB seeding (runs once per process when Supabase IS configured) ──
let _dbSeeded = false

async function ensureDbSeeded(): Promise<void> {
  if (_dbSeeded) return
  _dbSeeded = true
  try {
    const count = await couponRepository.count()
    if (count > 0) return
    const seeds = buildDefaultCoupons()
    for (const s of seeds) {
      await couponRepository.create({
        id:               s.id,
        code:             s.code,
        type:             s.type,
        value:            s.value,
        applicable_plans: s.applicablePlans,
        max_uses:         s.maxUses,
        used_count:       0,
        expires_at:       s.expiresAt,
        active:           s.active,
        description:      s.description,
      })
    }
    logger.info('couponService: seeded default coupons to DB')
  } catch (e) {
    _dbSeeded = false   // allow retry on next call
    logger.warn('couponService: DB seed failed', { error: e })
  }
}

// ── Public API ────────────────────────────────────────────────
export async function getCoupon(code: string): Promise<Coupon | null> {
  if (!isSupabaseConfigured) {
    memEnsureSeeded()
    return _coupons.get(code.toUpperCase()) ?? null
  }
  await ensureDbSeeded()
  const row = await couponRepository.findByCode(code)
  return row ? rowToCoupon(row) : null
}

export async function listCoupons(): Promise<Coupon[]> {
  if (!isSupabaseConfigured) {
    memEnsureSeeded()
    return Array.from(_coupons.values())
  }
  await ensureDbSeeded()
  const rows = await couponRepository.list()
  return rows.map(rowToCoupon)
}

export async function validateCoupon(
  code: string, planId: string
): Promise<{ valid: boolean; coupon?: Coupon; error?: string }> {
  const coupon = await getCoupon(code.toUpperCase())
  if (!coupon)          return { valid: false, error: 'Coupon not found' }
  if (!coupon.active)   return { valid: false, error: 'Coupon is inactive', coupon }
  if (coupon.expiresAt !== -1 && Date.now() > coupon.expiresAt)
                        return { valid: false, error: 'Coupon has expired', coupon }
  if (coupon.maxUses !== -1 && coupon.usedCount >= coupon.maxUses)
                        return { valid: false, error: 'Coupon usage limit reached', coupon }
  if (coupon.applicablePlans.length > 0 && !coupon.applicablePlans.includes(planId.toLowerCase()))
                        return { valid: false, error: `Coupon not valid for plan "${planId}"`, coupon }
  return { valid: true, coupon }
}

export function applyCouponToAmount(coupon: Coupon, amountCents: number): number {
  let discounted = amountCents
  if (coupon.type === 'percent_off')
    discounted = Math.round(amountCents * (1 - coupon.value / 100))
  else if (coupon.type === 'amount_off')
    discounted = amountCents - coupon.value
  return Math.max(0, discounted)
}

export async function redeemCoupon(
  code: string, userId: string, planId: string
): Promise<{ success: boolean; discountCents?: number; trialDays?: number; error?: string }> {
  const { valid, coupon, error } = await validateCoupon(code, planId)
  if (!valid || !coupon) return { success: false, error }

  if (!isSupabaseConfigured) {
    // In-memory redemption tracking
    const redeemers = _redeemed.get(code) ?? new Set()
    if (redeemers.has(userId)) return { success: false, error: 'You have already used this coupon' }
    redeemers.add(userId)
    _redeemed.set(code, redeemers)
    coupon.usedCount++
    if (coupon.type === 'trial_days') return { success: true, trialDays: coupon.value }
    const discountCents = coupon.type === 'amount_off'
      ? coupon.value
      : Math.round(999 * (coupon.value / 100))
    return { success: true, discountCents }
  }

  const alreadyUsed = await couponRepository.hasUserRedeemed(code, userId)
  if (alreadyUsed) return { success: false, error: 'You have already used this coupon' }

  await couponRepository.recordRedemption(code, userId)
  await couponRepository.incrementUsed(code)

  if (coupon.type === 'trial_days') return { success: true, trialDays: coupon.value }
  const discountCents = coupon.type === 'amount_off'
    ? coupon.value
    : Math.round(999 * (coupon.value / 100))
  return { success: true, discountCents }
}

export async function createCoupon(
  data: Omit<Coupon, 'id' | 'createdAt' | 'usedCount'>
): Promise<Coupon> {
  if (!isSupabaseConfigured) {
    memEnsureSeeded()
    const coupon: Coupon = { ...data, id: uuidv4(), usedCount: 0, createdAt: Date.now() }
    _coupons.set(coupon.code, coupon)
    return coupon
  }
  const row = await couponRepository.create({
    id:               uuidv4(),
    code:             data.code.toUpperCase(),
    type:             data.type,
    value:            data.value,
    applicable_plans: data.applicablePlans,
    max_uses:         data.maxUses,
    used_count:       0,
    expires_at:       data.expiresAt,
    active:           data.active,
    description:      data.description,
  })
  return rowToCoupon(row)
}
