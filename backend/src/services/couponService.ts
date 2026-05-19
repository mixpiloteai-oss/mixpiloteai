// ============================================================
// NEUROTEK AI — Coupon Service
// ============================================================

export type CouponType = 'percent_off' | 'amount_off' | 'trial_days';

export interface Coupon {
  id: string;
  code: string;
  type: CouponType;
  value: number;              // % off, cents off, or days
  applicablePlans: string[];  // [] = all plans
  maxUses: number;            // -1 = unlimited
  usedCount: number;
  expiresAt: number;          // timestamp, -1 = never
  active: boolean;
  createdAt: number;
  description: string;
}

// ── In-memory store ───────────────────────────────────────────
const coupons = new Map<string, Coupon>();
const redemptions = new Map<string, Set<string>>(); // couponCode → Set of userIds

// ── Seed Coupons ──────────────────────────────────────────────
function seed(): void {
  const now = Date.now();
  const day = 86_400_000;

  const initial: Omit<Coupon, 'id'>[] = [
    {
      code: 'LAUNCH50',
      type: 'percent_off',
      value: 50,
      applicablePlans: [],
      maxUses: 500,
      usedCount: 0,
      expiresAt: now + 90 * day,
      active: true,
      createdAt: now,
      description: '50% off first month — all plans',
    },
    {
      code: 'ANNUAL20',
      type: 'percent_off',
      value: 20,
      applicablePlans: [],
      maxUses: -1,
      usedCount: 0,
      expiresAt: -1,
      active: true,
      createdAt: now,
      description: '20% off annual subscription',
    },
    {
      code: 'STUDIO30',
      type: 'percent_off',
      value: 30,
      applicablePlans: ['studio'],
      maxUses: 200,
      usedCount: 0,
      expiresAt: -1,
      active: true,
      createdAt: now,
      description: '30% off Studio plan',
    },
    {
      code: 'FREEMONTH',
      type: 'trial_days',
      value: 30,
      applicablePlans: [],
      maxUses: 100,
      usedCount: 0,
      expiresAt: -1,
      active: true,
      createdAt: now,
      description: '30 days free trial extension',
    },
    {
      code: 'WELCOME',
      type: 'amount_off',
      value: 500,  // $5.00 in cents
      applicablePlans: [],
      maxUses: -1,
      usedCount: 0,
      expiresAt: -1,
      active: true,
      createdAt: now,
      description: '$5 off — all plans',
    },
    {
      code: 'PRODUCER2025',
      type: 'percent_off',
      value: 25,
      applicablePlans: ['pro'],
      maxUses: 1000,
      usedCount: 0,
      expiresAt: -1,
      active: true,
      createdAt: now,
      description: '25% off Pro plan',
    },
    {
      code: 'COLLAB10',
      type: 'percent_off',
      value: 10,
      applicablePlans: [],
      maxUses: 50,
      usedCount: 0,
      expiresAt: -1,
      active: true,
      createdAt: now,
      description: '10% off — referral campaign',
    },
    {
      code: 'EARLYBIRD',
      type: 'percent_off',
      value: 40,
      applicablePlans: [],
      maxUses: 300,
      usedCount: 0,
      expiresAt: -1,
      active: true,
      createdAt: now,
      description: '40% off — early adopter discount',
    },
  ];

  initial.forEach((c, i) => {
    const id = `cpn_${(i + 1).toString().padStart(4, '0')}`;
    coupons.set(c.code, { ...c, id });
    redemptions.set(c.code, new Set());
  });
}

seed();

// ── Public API ────────────────────────────────────────────────

export function getCoupon(code: string): Coupon | null {
  return coupons.get(code.toUpperCase()) ?? null;
}

export function listCoupons(): Coupon[] {
  return Array.from(coupons.values());
}

export function validateCoupon(
  code: string,
  planId: string
): { valid: boolean; coupon?: Coupon; error?: string } {
  const coupon = getCoupon(code);

  if (!coupon) return { valid: false, error: 'Coupon not found' };
  if (!coupon.active) return { valid: false, error: 'Coupon is inactive', coupon };

  if (coupon.expiresAt !== -1 && Date.now() > coupon.expiresAt) {
    return { valid: false, error: 'Coupon has expired', coupon };
  }

  if (coupon.maxUses !== -1 && coupon.usedCount >= coupon.maxUses) {
    return { valid: false, error: 'Coupon usage limit reached', coupon };
  }

  if (
    coupon.applicablePlans.length > 0 &&
    !coupon.applicablePlans.includes(planId.toLowerCase())
  ) {
    return {
      valid: false,
      error: `Coupon not valid for plan "${planId}"`,
      coupon,
    };
  }

  return { valid: true, coupon };
}

export function applyCouponToAmount(coupon: Coupon, amountCents: number): number {
  let discounted = amountCents;

  if (coupon.type === 'percent_off') {
    discounted = Math.round(amountCents * (1 - coupon.value / 100));
  } else if (coupon.type === 'amount_off') {
    discounted = amountCents - coupon.value;
  }
  // trial_days doesn't reduce amount

  return Math.max(0, discounted);
}

export function redeemCoupon(
  code: string,
  userId: string,
  planId: string
): { success: boolean; discountCents?: number; trialDays?: number; error?: string } {
  const { valid, coupon, error } = validateCoupon(code, planId);

  if (!valid || !coupon) {
    return { success: false, error };
  }

  const used = redemptions.get(coupon.code) ?? new Set<string>();
  if (used.has(userId)) {
    return { success: false, error: 'You have already used this coupon' };
  }

  // Mark as used
  coupon.usedCount += 1;
  used.add(userId);
  redemptions.set(coupon.code, used);

  if (coupon.type === 'trial_days') {
    return { success: true, trialDays: coupon.value };
  }

  // For percent_off and amount_off, return example discount on a $9.99 base if no amount known
  const discountCents = coupon.type === 'amount_off' ? coupon.value : Math.round(999 * (coupon.value / 100));
  return { success: true, discountCents };
}
