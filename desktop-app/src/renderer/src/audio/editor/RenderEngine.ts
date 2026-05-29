// ─── RenderEngine ─────────────────────────────────────────────────────────────
// Renders a set of audio regions (each with a gain multiplier) to a single
// mixed Float32Array per channel. bounceTrack and freezeTrack delegate to the
// existing BounceEngine / FreezeEngine — this module covers renderStems only.

export interface RenderRegion {
  buffer: Float32Array[]  // channels × samples
  gain:   number          // linear gain multiplier
}

export interface RenderOptions {
  sampleRate:      number
  bitDepth:        16 | 24 | 32
  normalizeOutput: boolean
  startSample?:    number
  endSample?:      number
}

export interface RenderResult {
  stems:        Map<string, Float32Array[]>
  sampleRate:   number
  totalSamples: number
}

export function renderStems(
  tracks: Map<string, RenderRegion[]>,
  options: RenderOptions,
): RenderResult {
  const stems = new Map<string, Float32Array[]>()
  let totalSamples = 0

  for (const [trackId, regions] of tracks) {
    if (regions.length === 0) {
      stems.set(trackId, [])
      continue
    }

    const channels = regions.reduce((mx, r) => Math.max(mx, r.buffer.length), 0)
    let maxLen = 0
    for (const r of regions) maxLen = Math.max(maxLen, r.buffer[0]?.length ?? 0)

    if (options.startSample !== undefined && options.endSample !== undefined) {
      maxLen = options.endSample - options.startSample
    }

    const out = Array.from({ length: channels }, () => new Float32Array(maxLen))

    for (const region of regions) {
      for (let ch = 0; ch < channels; ch++) {
        const src  = region.buffer[ch] ?? new Float32Array(0)
        const dest = out[ch]
        const len  = Math.min(src.length, dest.length)
        for (let i = 0; i < len; i++) dest[i] += src[i] * region.gain
      }
    }

    if (options.normalizeOutput) {
      let peak = 0
      for (const ch of out) for (const v of ch) if (Math.abs(v) > peak) peak = Math.abs(v)
      if (peak > 0) {
        const scale = 1.0 / peak
        for (const ch of out) for (let i = 0; i < ch.length; i++) ch[i] *= scale
      }
    }

    stems.set(trackId, out)
    totalSamples = Math.max(totalSamples, maxLen)
  }

  return { stems, sampleRate: options.sampleRate, totalSamples }
}
