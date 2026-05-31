// ─── SeededRng.ts ─────────────────────────────────────────────────────────────
// A simple LCG PRNG for reproducible, deterministic generation.
// No Math.random() — the rest of the system uses this instead.

export class SeededRng {
  private s: number

  constructor(seed: number) {
    this.s = seed | 0
  }

  /** Returns float in [0, 1) */
  next(): number {
    this.s = (Math.imul(this.s, 1664525) + 1013904223) | 0
    return (this.s >>> 0) / 4294967296
  }

  /** Returns integer in [min, max] inclusive */
  nextInt(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1))
  }

  /** Returns element from array */
  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error('SeededRng.pick: empty array')
    return arr[Math.floor(this.next() * arr.length)]!
  }

  /** Shuffle array in-place (Fisher-Yates) */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i)
      ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
    }
    return arr
  }
}
