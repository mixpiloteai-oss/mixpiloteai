/**
 * MetronomeEngine
 *
 * Generates click sounds using the Web Audio API oscillator approach.
 * Clicks are scheduled sample-accurately via Clock beat callbacks —
 * never via setTimeout/setInterval.
 *
 * Click synthesis:
 *   - Beat 1 of each bar: short 1500 Hz sine burst (accent)
 *   - All other beats:    short 1000 Hz sine burst
 *   - Envelope: instant attack, 50 ms exponential decay
 *
 * This produces a clean, low-CPU click with no sample dependencies.
 */

import type { Unsubscribe } from './types'
import { AudioEngine, dbToGain } from './AudioEngine'
import { Transport } from './Transport'

export class MetronomeEngine {
  private readonly engine:    AudioEngine
  private readonly transport: Transport

  private _enabled    = false
  private _volumeDb   = -6     // dB below full scale
  private _unsub: Unsubscribe | null = null

  constructor(engine: AudioEngine, transport: Transport) {
    this.engine    = engine
    this.transport = transport
  }

  get enabled():  boolean { return this._enabled }
  get volumeDb(): number  { return this._volumeDb }

  enable(): void {
    if (this._enabled) return
    this._enabled = true
    this._unsub   = this.transport.onBeat((_beatIdx, scheduledTime, pos) => {
      this._scheduleClick(scheduledTime, pos.beat === 1)
    })
  }

  disable(): void {
    this._enabled = false
    this._unsub?.()
    this._unsub = null
  }

  setVolume(db: number): void {
    this._volumeDb = Math.max(-40, Math.min(0, db))
  }

  private _scheduleClick(time: number, accent: boolean): void {
    const ctx  = this.engine.ctx
    const gain = this.engine.masterInput

    // Oscillator click
    const osc    = ctx.createOscillator()
    const envGain = ctx.createGain()

    osc.connect(envGain)
    envGain.connect(gain)

    osc.type            = 'sine'
    osc.frequency.value = accent ? 1500 : 1000

    const amplitude = dbToGain(this._volumeDb)
    envGain.gain.setValueAtTime(0, time)
    envGain.gain.linearRampToValueAtTime(amplitude, time + 0.002)
    envGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.06)

    osc.start(time)
    osc.stop(time + 0.065)

    // Cleanup: detach nodes after they've played
    osc.onended = () => {
      osc.disconnect()
      envGain.disconnect()
    }
  }

  dispose(): void {
    this.disable()
  }
}
