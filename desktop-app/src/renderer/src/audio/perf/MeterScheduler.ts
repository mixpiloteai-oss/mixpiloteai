export type MeterCallback = (level: { peak: number; rms: number }) => void

export interface MeterRegistration {
  id:       string
  getLevel: () => { peak: number; rms: number }
  callback: MeterCallback
}

const MIN_INTERVAL_MS = 8  // cap at ~120fps per meter

export class MeterScheduler {
  private _registrations: Map<string, MeterRegistration & { lastUpdate: number }> = new Map()
  private _rafId: number | null = null

  register(reg: MeterRegistration): () => void {
    this._registrations.set(reg.id, { ...reg, lastUpdate: 0 })
    this.start()
    return () => this.unregister(reg.id)
  }

  unregister(id: string): void {
    this._registrations.delete(id)
    if (this._registrations.size === 0) this.stop()
  }

  start(): void {
    if (this._rafId !== null) return
    const tick = (now: number): void => {
      for (const entry of this._registrations.values()) {
        if (now - entry.lastUpdate >= MIN_INTERVAL_MS) {
          entry.lastUpdate = now
          try {
            const level = entry.getLevel()
            entry.callback(level)
          } catch { /* guard against disposed nodes */ }
        }
      }
      this._rafId = requestAnimationFrame(tick)
    }
    this._rafId = requestAnimationFrame(tick)
  }

  stop(): void {
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId)
      this._rafId = null
    }
  }

  get registrationCount(): number { return this._registrations.size }
}

export const meterScheduler = new MeterScheduler()
