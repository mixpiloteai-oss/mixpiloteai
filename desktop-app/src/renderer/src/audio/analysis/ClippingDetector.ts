// ─── Clipping Detector ────────────────────────────────────────────────────────
// Real-time clipping monitor — polls the master AnalyserNode every 100 ms.
// Tracks hard clips (≥ 0.99 = 0 dBFS) and near-clips (> 0.891 = −1 dBFS).

export interface ClippingReport {
  isClipping:     boolean
  isNearClipping: boolean
  hardClipCount:  number   // samples that hit ≥ 0.99 in the last window
  nearClipCount:  number   // samples in (0.891, 0.99)
  peakLinear:     number   // 0–1
  peakdBFS:       number   // ≤ 0
  windowMs:       number   // measurement window length in ms
}

const HARD_THRESHOLD  = 0.99
const NEAR_THRESHOLD  = 0.891   // ≈ −1 dBFS
const POLL_MS         = 100
const WINDOW_MS       = 3_000   // rolling 3-second window

export class ClippingDetector {
  private analyser:    AnalyserNode | null = null
  private timerId:     ReturnType<typeof setInterval> | null = null
  private buf:         Float32Array<ArrayBuffer> = new Float32Array(0)

  // Rolling window: stores per-poll results (each POLL_MS)
  private hardCounts:  number[] = []
  private nearCounts:  number[] = []
  private peaks:       number[] = []
  private readonly maxSlots = Math.ceil(WINDOW_MS / POLL_MS)

  private report: ClippingReport = {
    isClipping: false, isNearClipping: false,
    hardClipCount: 0, nearClipCount: 0,
    peakLinear: 0, peakdBFS: -Infinity, windowMs: WINDOW_MS,
  }

  private listeners: Set<(r: ClippingReport) => void> = new Set()

  attach(analyser: AnalyserNode): void {
    this.detach()
    this.analyser = analyser
    this.buf = new Float32Array(analyser.fftSize) as Float32Array<ArrayBuffer>
    this.timerId = setInterval(() => this.tick(), POLL_MS)
  }

  detach(): void {
    if (this.timerId !== null) { clearInterval(this.timerId); this.timerId = null }
    this.analyser = null
    this.hardCounts = []; this.nearCounts = []; this.peaks = []
  }

  subscribe(cb: (r: ClippingReport) => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  getReport(): ClippingReport { return this.report }

  reset(): void {
    this.hardCounts = []; this.nearCounts = []; this.peaks = []
    this.report = { ...this.report, isClipping: false, isNearClipping: false, hardClipCount: 0, nearClipCount: 0, peakLinear: 0, peakdBFS: -Infinity }
    this.emit()
  }

  private tick(): void {
    if (!this.analyser) return
    this.analyser.getFloatTimeDomainData(this.buf)

    let hard = 0, near = 0, peak = 0
    for (let i = 0; i < this.buf.length; i++) {
      const abs = Math.abs(this.buf[i]!)
      if (abs >= HARD_THRESHOLD) hard++
      else if (abs > NEAR_THRESHOLD) near++
      if (abs > peak) peak = abs
    }

    this.hardCounts.push(hard)
    this.nearCounts.push(near)
    this.peaks.push(peak)
    if (this.hardCounts.length > this.maxSlots) { this.hardCounts.shift(); this.nearCounts.shift(); this.peaks.shift() }

    const totalHard = this.hardCounts.reduce((s, v) => s + v, 0)
    const totalNear = this.nearCounts.reduce((s, v) => s + v, 0)
    const maxPeak   = Math.max(...this.peaks)
    const dBFS      = maxPeak > 0 ? 20 * Math.log10(maxPeak) : -Infinity

    this.report = {
      isClipping:    totalHard > 0,
      isNearClipping: totalNear > 0 || totalHard > 0,
      hardClipCount:  totalHard,
      nearClipCount:  totalNear,
      peakLinear:     maxPeak,
      peakdBFS:       dBFS,
      windowMs:       WINDOW_MS,
    }
    this.emit()
  }

  private emit(): void {
    const r = this.report
    this.listeners.forEach(cb => cb(r))
  }
}

export const clippingDetector = new ClippingDetector()
