// ─── AutomationCurve.ts ───────────────────────────────────────────────────────
// Pure math functions for automation curve evaluation.
// No classes, no side effects.

import type { AutomationPoint } from './AutomationTypes'

// ─── Cubic Bezier ─────────────────────────────────────────────────────────────

/**
 * Standard cubic bezier formula.
 * (1-t)^3*p0 + 3*(1-t)^2*t*p1 + 3*(1-t)*t^2*p2 + t^3*p3
 */
export function cubicBezier(
  t: number,
  p0: number,
  p1: number,
  p2: number,
  p3: number
): number {
  const mt = 1 - t
  return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3
}

// ─── Segment evaluation ───────────────────────────────────────────────────────

/**
 * Evaluate the value between two points.
 * t is normalized: 0 = p0.beat, 1 = p1.beat
 */
export function evaluateSegment(
  p0: AutomationPoint,
  p1: AutomationPoint,
  t: number
): number {
  const v0 = p0.value
  const v1 = p1.value

  switch (p0.curveType) {
    case 'linear':
      return v0 + (v1 - v0) * t

    case 'step':
      return v0

    case 'exponential':
      // Curved toward start (exponential shape)
      return v0 + (v1 - v0) * (Math.exp(3 * t) - 1) / (Math.exp(3) - 1)

    case 'logarithmic':
      return v0 + (v1 - v0) * Math.log(1 + t * (Math.E - 1))

    case 'sine':
      return v0 + (v1 - v0) * (1 - Math.cos(Math.PI * t)) / 2

    case 'bezier': {
      // Control points in normalized [0,1] time space:
      // P0 = (0, v0), P1 = (outHandle.dx, v0+outHandle.dy),
      // P2 = (1+inHandle.dx, v1+inHandle.dy), P3 = (1, v1)
      const c1x = p0.outHandle.dx
      const c1y = v0 + p0.outHandle.dy
      const c2x = 1 + p1.inHandle.dx
      const c2y = v1 + p1.inHandle.dy

      // Solve for parameter t given x via bisection
      let lo = 0
      let hi = 1
      let tParam = t
      for (let i = 0; i < 16; i++) {
        const mid = (lo + hi) * 0.5
        const xMid = cubicBezier(mid, 0, c1x, c2x, 1)
        if (xMid < t) lo = mid
        else hi = mid
      }
      tParam = (lo + hi) * 0.5

      const y = cubicBezier(tParam, v0, c1y, c2y, v1)
      return Math.max(0, Math.min(1, y))
    }

    default:
      return v0 + (v1 - v0) * t
  }
}

// ─── Lane evaluation ──────────────────────────────────────────────────────────

/**
 * Evaluate the full lane at a given beat position.
 * Returns normalized value (0-1).
 */
export function evaluateLaneAt(points: AutomationPoint[], beat: number): number {
  if (points.length === 0) return 0.5
  if (beat <= points[0].beat) return points[0].value
  if (beat >= points[points.length - 1].beat) return points[points.length - 1].value

  // Find surrounding points
  let lo = 0
  let hi = points.length - 2
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (points[mid + 1].beat <= beat) lo = mid + 1
    else hi = mid
  }

  const p0 = points[lo]
  const p1 = points[lo + 1]
  const t = (beat - p0.beat) / (p1.beat - p0.beat)
  return evaluateSegment(p0, p1, t)
}

// ─── Operations ───────────────────────────────────────────────────────────────

/**
 * Apply gaussian-like smoothing to automation points within a window.
 * Returns a new array (does not mutate).
 */
export function smoothPoints(
  points: AutomationPoint[],
  windowBeats: number
): AutomationPoint[] {
  if (points.length === 0) return []
  return points.map((pt, i) => {
    let weightedSum = 0
    let totalWeight = 0
    for (let j = 0; j < points.length; j++) {
      const dist = Math.abs(points[j].beat - pt.beat)
      if (dist <= windowBeats) {
        const w = 1 - dist / windowBeats
        weightedSum += points[j].value * w
        totalWeight += w
      }
    }
    const newValue = totalWeight > 0 ? weightedSum / totalWeight : pt.value
    return { ...pt, value: Math.max(0, Math.min(1, newValue)) }
  })
}

/**
 * Scale all values by factor around pivot (default 0.5).
 * Clamps to [0, 1]. Returns new array.
 */
export function scaleValues(
  points: AutomationPoint[],
  factor: number,
  pivot = 0.5
): AutomationPoint[] {
  return points.map(pt => {
    const newVal = pivot + (pt.value - pivot) * factor
    return { ...pt, value: Math.max(0, Math.min(1, newVal)) }
  })
}

/**
 * Add random offsets within ±amount.
 * Uses the provided rng for determinism.
 * Returns new array with values clamped [0,1].
 */
export function randomizeValues(
  points: AutomationPoint[],
  amount: number,
  rng: { next: () => number }
): AutomationPoint[] {
  return points.map(pt => {
    const offset = (rng.next() * 2 - 1) * amount
    return { ...pt, value: Math.max(0, Math.min(1, pt.value + offset)) }
  })
}

/**
 * Shift all points by beatOffset. Returns new array.
 */
export function shiftPoints(
  points: AutomationPoint[],
  beatOffset: number
): AutomationPoint[] {
  return points.map(pt => ({ ...pt, beat: pt.beat + beatOffset }))
}

/**
 * Invert all values: 1 - value. Returns new array.
 */
export function invertValues(points: AutomationPoint[]): AutomationPoint[] {
  return points.map(pt => ({ ...pt, value: 1 - pt.value }))
}
