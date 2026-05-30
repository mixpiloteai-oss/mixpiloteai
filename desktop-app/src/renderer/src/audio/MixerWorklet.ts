// ─── MixerWorklet.ts ──────────────────────────────────────────────────────────
// AudioWorkletProcessor for the mixer gain stage.
// processorCode is the worklet class source; load via Blob URL.
// applyGain / applyGainStereo are pure functions exported for unit testing.

// ── Pure math (testable in Node) ──────────────────────────────────────────────

export function applyGain(samples: Float32Array, gainLinear: number): Float32Array {
  const out = new Float32Array(samples.length)
  for (let i = 0; i < samples.length; i++) out[i] = samples[i] * gainLinear
  return out
}

export function applyGainStereo(
  left:        Float32Array,
  right:       Float32Array,
  gainLinear:  number,
): { left: Float32Array; right: Float32Array } {
  return { left: applyGain(left, gainLinear), right: applyGain(right, gainLinear) }
}

export function clampGain(linear: number): number {
  return Math.max(0, Math.min(4, linear)) // 0 to +12 dB ceiling
}

// ── Worklet processor source (runs in AudioWorkletGlobalScope) ────────────────

export const processorCode = `
class MixerGainProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'gain', defaultValue: 1, minValue: 0, maxValue: 4, automationRate: 'a-rate' },
    ]
  }

  process(inputs, outputs, parameters) {
    const input  = inputs[0]
    const output = outputs[0]
    const gain   = parameters['gain']
    const isConst = gain.length === 1

    for (let ch = 0; ch < output.length; ch++) {
      const inCh  = input[ch]
      const outCh = output[ch]
      if (!inCh) { outCh.fill(0); continue }
      for (let i = 0; i < outCh.length; i++) {
        outCh[i] = inCh[i] * (isConst ? gain[0] : gain[i])
      }
    }
    return true
  }
}

registerProcessor('mixer-gain-processor', MixerGainProcessor)
`

// ── Registration helper (browser-only) ────────────────────────────────────────

export async function registerMixerWorklet(context: AudioContext): Promise<void> {
  const blob = new Blob([processorCode], { type: 'application/javascript' })
  const url  = URL.createObjectURL(blob)
  try {
    await context.audioWorklet.addModule(url)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function createMixerGainNode(context: AudioContext): AudioWorkletNode {
  return new AudioWorkletNode(context, 'mixer-gain-processor')
}
