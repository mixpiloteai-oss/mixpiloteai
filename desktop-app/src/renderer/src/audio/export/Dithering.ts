// ─── Dithering ────────────────────────────────────────────────────────────────
// Professional dithering algorithms for bit-depth reduction.
// Applied as the final stage before writing integer PCM samples.
//
// Algorithms:
//   TPDF     — Triangular PDF noise; eliminates quantisation distortion
//   NS       — Noise-shaped (Wannamaker 9-tap coefficients); perceptual quality
//   FLAT     — RPDF (flat/rectangular) for reference comparison

export type DitherType = 'none' | 'tpdf' | 'ns' | 'flat'

// ── Noise-shaping coefficients (Wannamaker 9-tap, 44.1 kHz) ──────────────────
// Ref: Wannamaker, "Psychoacoustically Optimal Noise Shaping", JAES 1992
const NS_COEFF = [
   2.412,  -3.370,   3.937,  -4.174,
   3.353,  -2.205,   1.281,  -0.569,
   0.0847,
]

export class Ditherer {
  private nsHistory:  Float64Array = new Float64Array(NS_COEFF.length)
  private nsIdx = 0
  private prevTPDF = 0

  reset(): void {
    this.nsHistory.fill(0)
    this.nsIdx = 0
    this.prevTPDF = 0
  }

  /** Apply dithering to a float sample before truncation to integer PCM. */
  apply(sample: number, type: DitherType, scaleFactor: number): number {
    if (type === 'none') return sample

    const noise = this.noise(type)
    // Add noise at the LSB level of the target bit depth
    return sample + noise / scaleFactor
  }

  private noise(type: DitherType): number {
    switch (type) {
      case 'tpdf': {
        // Triangular PDF: sum of two uniform random values → triangle distribution
        const r1 = Math.random() * 2 - 1
        const r2 = Math.random() * 2 - 1
        return (r1 + r2) * 0.5
      }
      case 'flat': {
        // Rectangular PDF (simple, not psychoacoustically optimised)
        return Math.random() * 2 - 1
      }
      case 'ns': {
        // Noise-shaped: feedback of quantisation error through perceptual filter
        const white = (Math.random() - Math.random())  // TPDF base
        let shaped  = white
        // Apply IIR feedback
        for (let i = 0; i < NS_COEFF.length; i++) {
          const idx = (this.nsIdx - i + NS_COEFF.length) % NS_COEFF.length
          shaped   -= NS_COEFF[i]! * this.nsHistory[idx]!
        }
        this.nsHistory[this.nsIdx] = shaped - white
        this.nsIdx = (this.nsIdx + 1) % NS_COEFF.length
        return shaped
      }
      default: return 0
    }
  }
}

/** Apply dithering in-place to all channels of an AudioBuffer. */
export function ditherBuffer(
  buffer: AudioBuffer,
  targetBits: 16 | 24,
  type:       DitherType,
): void {
  if (type === 'none') return
  const scaleFactor = Math.pow(2, targetBits - 1)
  const ditherer    = new Ditherer()
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    ditherer.reset()
    const ch = buffer.getChannelData(c)
    for (let i = 0; i < ch.length; i++) {
      ch[i] = ditherer.apply(ch[i]!, type, scaleFactor)
    }
  }
}
