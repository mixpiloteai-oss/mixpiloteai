// ─── mixerMath.ts ─────────────────────────────────────────────────────────────
// Pure math utilities for the mixer — no dependencies, fully testable in Node.

/** Convert dB to linear gain. -Infinity (or any non-finite value) returns 0. */
export function dBToLinear(db: number): number {
  if (!isFinite(db)) return 0
  return Math.pow(10, db / 20)
}

/** Convert linear gain to dB. 0 or negative returns -Infinity. */
export function linearToDb(linear: number): number {
  if (linear <= 0) return -Infinity
  return 20 * Math.log10(linear)
}

/**
 * Constant-power stereo pan.
 * pan: -1 (full left) to +1 (full right), 0 = center.
 * At center: left = right = √2/2 ≈ 0.707 (equal power, sums to 1 in mono).
 */
export function panToStereo(pan: number): { left: number; right: number } {
  const angle = ((pan + 1) / 2) * (Math.PI / 2)
  return { left: Math.cos(angle), right: Math.sin(angle) }
}
