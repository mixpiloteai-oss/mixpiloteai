// ─── DSP Worker ───────────────────────────────────────────────────────────────
// Runs in a dedicated thread. Handles CPU-heavy audio tasks so the main thread
// (UI + Web Audio scheduler) stays jitter-free.
//
// Supported tasks:
//   peak-scan   — scan a Float32Array for peak/RMS
//   normalize   — normalise a Float32Array in-place
//   resample    — linear-interpolation resample to a target length
//   waveform    — compute 200-point RMS waveform from raw PCM

export type DSPTask =
  | { id: string; type: 'peak-scan';  payload: { samples: Float32Array } }
  | { id: string; type: 'normalize';  payload: { samples: Float32Array; targetDb: number } }
  | { id: string; type: 'resample';   payload: { samples: Float32Array; targetLen: number } }
  | { id: string; type: 'waveform';   payload: { samples: Float32Array; points: number } }

export type DSPResult =
  | { id: string; type: 'peak-scan';  peak: number; rms: number; dBFS: number }
  | { id: string; type: 'normalize';  samples: Float32Array }
  | { id: string; type: 'resample';   samples: Float32Array }
  | { id: string; type: 'waveform';   data: number[] }

// ── Helpers ───────────────────────────────────────────────────────────────────

function peakRms(s: Float32Array): { peak: number; rms: number } {
  let peak = 0, sum = 0
  for (let i = 0; i < s.length; i++) {
    const abs = Math.abs(s[i]!)
    if (abs > peak) peak = abs
    sum += abs * abs
  }
  return { peak, rms: Math.sqrt(sum / s.length) }
}

function linearResample(src: Float32Array, targetLen: number): Float32Array {
  const out   = new Float32Array(targetLen)
  const ratio = (src.length - 1) / (targetLen - 1)
  for (let i = 0; i < targetLen; i++) {
    const pos  = i * ratio
    const lo   = Math.floor(pos)
    const hi   = Math.min(lo + 1, src.length - 1)
    const frac = pos - lo
    out[i] = src[lo]! * (1 - frac) + src[hi]! * frac
  }
  return out
}

function computeWaveform(s: Float32Array, points: number): number[] {
  const sliceSize = Math.max(1, Math.floor(s.length / points))
  const out: number[] = []
  for (let i = 0; i < points; i++) {
    let sum = 0
    const start = i * sliceSize
    const end   = Math.min(start + sliceSize, s.length)
    for (let j = start; j < end; j++) sum += s[j]! * s[j]!
    out.push(Math.sqrt(sum / (end - start)))
  }
  return out
}

// ── Message handler ───────────────────────────────────────────────────────────

self.onmessage = (e: MessageEvent<DSPTask>) => {
  const task = e.data
  try {
    switch (task.type) {
      case 'peak-scan': {
        const { peak, rms } = peakRms(task.payload.samples)
        const result: DSPResult = { id: task.id, type: 'peak-scan', peak, rms, dBFS: peak > 0 ? 20 * Math.log10(peak) : -Infinity }
        self.postMessage(result)
        break
      }
      case 'normalize': {
        const s = task.payload.samples
        const { peak } = peakRms(s)
        const targetLinear = Math.pow(10, task.payload.targetDb / 20)
        const gain = peak > 0 ? targetLinear / peak : 1
        const out  = new Float32Array(s.length) as Float32Array<ArrayBuffer>
        for (let i = 0; i < s.length; i++) out[i] = s[i]! * gain
        const result: DSPResult = { id: task.id, type: 'normalize', samples: out }
        self.postMessage(result, { transfer: [out.buffer as ArrayBuffer] })
        break
      }
      case 'resample': {
        const resampled = linearResample(task.payload.samples, task.payload.targetLen)
        const result: DSPResult = { id: task.id, type: 'resample', samples: resampled }
        self.postMessage(result, { transfer: [resampled.buffer as ArrayBuffer] })
        break
      }
      case 'waveform': {
        const waveform = computeWaveform(task.payload.samples, task.payload.points)
        const result: DSPResult = { id: task.id, type: 'waveform', data: waveform }
        self.postMessage(result)
        break
      }
    }
  } catch (err) {
    self.postMessage({ id: task.id, error: String(err) })
  }
}
