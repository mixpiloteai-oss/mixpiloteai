export interface MemoryMetrics {
  heapUsedMB:  number
  heapTotalMB: number
  rssMB:       number
  sampledAt:   number
}

type FetchFn = () => Promise<{ heapUsedMB: number; heapTotalMB: number; rssMB: number }>

export class MemoryMonitor {
  private intervalMs: number
  private fetchFn:    FetchFn
  private samples:    MemoryMetrics[] = []
  private maxSamples  = 60
  private timer:      ReturnType<typeof setInterval> | null = null
  private subs:       Set<(m: MemoryMetrics) => void>       = new Set()

  constructor(opts?: { intervalMs?: number; fetchFn?: FetchFn }) {
    this.intervalMs = opts?.intervalMs ?? 5000
    this.fetchFn    = opts?.fetchFn ?? (() => {
      if (typeof window !== 'undefined' && window.electronAPI?.perfGetMemoryMetrics) {
        return window.electronAPI.perfGetMemoryMetrics()
      }
      return Promise.resolve({ heapUsedMB: 0, heapTotalMB: 0, rssMB: 0 })
    })
  }

  start(): void {
    if (this.timer !== null) return
    this.timer = setInterval(() => void this._poll(), this.intervalMs)
  }

  stop(): void {
    if (this.timer !== null) { clearInterval(this.timer); this.timer = null }
  }

  getLatest(): MemoryMetrics | null {
    return this.samples.length > 0 ? this.samples[this.samples.length - 1] : null
  }

  getAverage(): MemoryMetrics | null {
    if (this.samples.length === 0) return null
    const n    = this.samples.length
    const avg  = (key: keyof MemoryMetrics) => this.samples.reduce((s, m) => s + (m[key] as number), 0) / n
    return { heapUsedMB: avg('heapUsedMB'), heapTotalMB: avg('heapTotalMB'), rssMB: avg('rssMB'), sampledAt: Date.now() }
  }

  subscribe(cb: (m: MemoryMetrics) => void): () => void {
    this.subs.add(cb)
    return () => this.subs.delete(cb)
  }

  private async _poll(): Promise<void> {
    try {
      const raw     = await this.fetchFn()
      const sample: MemoryMetrics = { ...raw, sampledAt: Date.now() }
      if (this.samples.length >= this.maxSamples) this.samples.shift()
      this.samples.push(sample)
      for (const cb of this.subs) cb(sample)
    } catch { /* network/IPC error — skip */ }
  }
}
