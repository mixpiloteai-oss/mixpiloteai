// ─── TransientDetector ────────────────────────────────────────────────────────
// Onset detection via energy-difference flux (no FFT required).

export interface TransientOptions {
  threshold?:     number  // multiplier of mean energy (default 1.5)
  minGapSamples?: number  // minimum samples between detections (default 2048)
  windowSize?:    number  // hop window in samples (default 512)
}

export function detectTransients(
  buffer:     Float32Array,
  _sampleRate: number,
  options:    TransientOptions = {},
): number[] {
  const windowSize    = options.windowSize    ?? 512
  const threshold     = options.threshold     ?? 1.5
  const minGapSamples = options.minGapSamples ?? 2048

  const numWindows = Math.floor(buffer.length / windowSize)
  if (numWindows < 2) return []

  const energies = new Float32Array(numWindows)
  for (let w = 0; w < numWindows; w++) {
    let sum = 0
    const off = w * windowSize
    for (let i = 0; i < windowSize; i++) sum += (buffer[off + i] ?? 0) ** 2
    energies[w] = sum
  }

  let meanEnergy = 0
  for (let w = 0; w < numWindows; w++) meanEnergy += energies[w]
  meanEnergy /= numWindows

  const transients: number[] = []
  let lastTransient = -Infinity

  for (let w = 1; w < numWindows; w++) {
    const onset = energies[w] - energies[w - 1]
    if (onset > threshold * meanEnergy) {
      const samplePos = w * windowSize
      if (samplePos - lastTransient >= minGapSamples) {
        transients.push(samplePos)
        lastTransient = samplePos
      }
    }
  }

  return transients
}
