export interface CpuSample {
  userMs:      number
  systemMs:    number
  userDeltaMs: number
  sampledAt:   number
}

type FetchFn = () => Promise<{ userMs: number; systemMs: number }>

export class CpuMonitor {
  private intervalMs: number
  private fetchFn:    FetchFn
  private samples:    CpuSample[] = []
  private maxSamples  = 60
  private timer:      ReturnType<typeof setInterval> | null = null
  private subs:       Set<(s: CpuSample) => void>           = new Set()
  private prevUserMs  = 0

  constructor(opts?: { intervalMs?: number; fetchFn?: FetchFn }) {
    this.intervalMs = opts?.intervalMs ?? 1000
    this.fetchFn    = opts?.fetchFn ?? (() => {
      if (typeof window !== 'undefined' && window.electronAPI?.perfGetCpuMetrics) {
        return window.electronAPI.perfGetCpuMetrics()
      }
      return Promise.resolve({ userMs: 0, systemMs: 0 })
    })
  }

  start(): void {
    if (this.timer !== null) return
    this.timer = setInterval(() => void this._poll(), this.intervalMs)
  }

  stop(): void {
    if (this.timer !== null) { clearInterval(this.timer); this.timer = null }
  }

  getLatest(): CpuSample | null {
    return this.samples.length > 0 ? this.samples[this.samples.length - 1] : null
  }

  getAverage(): CpuSample | null {
    if (this.samples.length === 0) return null
    const n = this.samples.length
    return {
      userMs:      this.samples.reduce((s, x) => s + x.userMs, 0) / n,
      systemMs:    this.samples.reduce((s, x) => s + x.systemMs, 0) / n,
      userDeltaMs: this.samples.reduce((s, x) => s + x.userDeltaMs, 0) / n,
      sampledAt:   Date.now(),
    }
  }

  subscribe(cb: (s: CpuSample) => void): () => void {
    this.subs.add(cb)
    return () => this.subs.delete(cb)
  }

  private async _poll(): Promise<void> {
    try {
      const raw          = await this.fetchFn()
      const userDeltaMs  = raw.userMs - this.prevUserMs
      this.prevUserMs    = raw.userMs
      const sample: CpuSample = { ...raw, userDeltaMs: Math.max(0, userDeltaMs), sampledAt: Date.now() }
      if (this.samples.length >= this.maxSamples) this.samples.shift()
      this.samples.push(sample)
      for (const cb of this.subs) cb(sample)
    } catch { /* skip */ }
  }
}
