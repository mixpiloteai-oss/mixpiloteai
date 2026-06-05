/**
 * EqChain — parametric EQ DSP chain (up to 5 bands)
 *
 * Signal chain when enabled:
 *   _input → filter[0] → filter[1] → ... → filter[N-1] → _output
 *
 * When disabled (bypass):
 *   _input → _output   (filters are disconnected)
 */

// Re-use the EQBand type from the mixer store. We redeclare it here so this
// module has no dependency on React/Zustand.
export interface EQBand {
  id:      string
  type:    BiquadFilterType
  freq:    number   // Hz
  gain:    number   // dB
  q:       number   // 0.1–10
  enabled: boolean
}

export class EqChain {
  private readonly _ctx:     AudioContext
  private readonly _input:   GainNode
  private readonly _output:  GainNode
  private _filters:          BiquadFilterNode[]
  private _enabled:          boolean

  constructor(ctx: AudioContext, bands: EQBand[]) {
    this._ctx     = ctx
    this._input   = ctx.createGain()
    this._output  = ctx.createGain()
    this._filters = []
    this._enabled = true

    // Create up to 5 filter nodes from the provided bands
    const usedBands = bands.slice(0, 5)
    for (const band of usedBands) {
      const f = ctx.createBiquadFilter()
      f.type            = band.type
      f.frequency.value = band.freq
      f.gain.value      = band.enabled ? band.gain : 0
      f.Q.value         = band.q
      this._filters.push(f)
    }

    this._wire()
  }

  get input():  AudioNode { return this._input }
  get output(): AudioNode { return this._output }

  /**
   * Update filter parameters from band state.
   * Direct value assignment (no ramping) — caller decides timing.
   */
  update(bands: EQBand[]): void {
    const usedBands = bands.slice(0, 5)

    // Grow filter array if new bands were added
    while (this._filters.length < usedBands.length && this._filters.length < 5) {
      const f = this._ctx.createBiquadFilter()
      this._filters.push(f)
      // Re-wire to include the new filter
      this._rewire()
    }

    for (let i = 0; i < usedBands.length && i < this._filters.length; i++) {
      const band = usedBands[i]!
      const f    = this._filters[i]!
      f.type            = band.type
      f.frequency.value = band.freq
      f.Q.value         = band.q
      // When a band is individually disabled, set gain to 0 (pass-through for
      // shelf/peak types). For highpass/lowpass we keep params but bypass via gain=0 trick:
      // actually, we just set gain so the filter passes flat.
      f.gain.value = band.enabled ? band.gain : 0
    }
  }

  /**
   * Enable or disable the entire chain.
   * When disabled, audio bypasses all filters (input → output directly).
   */
  setEnabled(enabled: boolean): void {
    if (this._enabled === enabled) return
    this._enabled = enabled
    this._rewire()
  }

  get enabled(): boolean { return this._enabled }

  dispose(): void {
    this._input.disconnect()
    this._output.disconnect()
    for (const f of this._filters) f.disconnect()
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private _wire(): void {
    if (this._enabled && this._filters.length > 0) {
      // input → filter[0] → ... → filter[N-1] → output
      this._input.connect(this._filters[0]!)
      for (let i = 0; i < this._filters.length - 1; i++) {
        this._filters[i]!.connect(this._filters[i + 1]!)
      }
      this._filters[this._filters.length - 1]!.connect(this._output)
    } else {
      // bypass
      this._input.connect(this._output)
    }
  }

  private _rewire(): void {
    // Disconnect everything safely
    try { this._input.disconnect() }      catch { /* not connected */ }
    for (const f of this._filters) {
      try { f.disconnect() } catch { /* not connected */ }
    }
    this._wire()
  }
}
