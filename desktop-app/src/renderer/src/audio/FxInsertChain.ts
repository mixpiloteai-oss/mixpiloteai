/**
 * FxInsertChain — serial FX insert slot chain
 *
 * Each slot has a processor node and a bypass GainNode.
 * The chain routes audio through active slots or bypasses disabled ones.
 *
 * Signal chain (N slots):
 *   _input → [slot0: processor|bypass] → [slot1: ...] → _output
 */

export type FxType = 'gain' | 'compressor' | 'delay' | 'none'

export interface FxParams {
  // Gain
  gainDb?: number
  // Compressor
  threshold?: number   // dBFS default -24
  ratio?:     number   // default 4
  attack?:    number   // seconds default 0.003
  release?:   number   // seconds default 0.25
  knee?:      number   // default 6
  // Delay
  delayTime?: number   // seconds default 0.25
}

interface FxSlot {
  bypass:    GainNode
  processor: AudioNode | null
  type:      FxType
  enabled:   boolean
}

export class FxInsertChain {
  private readonly _ctx:    AudioContext
  private readonly _input:  GainNode
  private readonly _output: GainNode
  private _slots:           FxSlot[]

  constructor(ctx: AudioContext) {
    this._ctx    = ctx
    this._input  = ctx.createGain()
    this._output = ctx.createGain()
    this._slots  = []

    // Empty chain: input → output
    this._input.connect(this._output)
  }

  get input():  AudioNode { return this._input }
  get output(): AudioNode { return this._output }

  /**
   * Append a new FX slot to the chain.
   * The chain is re-wired after adding the slot.
   */
  addSlot(type: FxType, params?: FxParams): void {
    const bypass    = this._ctx.createGain()
    bypass.gain.value = 0   // will be set to 1 if bypassed, 0 if processing

    let processor: AudioNode | null = null

    switch (type) {
      case 'compressor': {
        const comp = this._ctx.createDynamicsCompressor()
        comp.threshold.value = params?.threshold ?? -24
        comp.ratio.value     = params?.ratio     ?? 4
        comp.attack.value    = params?.attack     ?? 0.003
        comp.release.value   = params?.release    ?? 0.25
        comp.knee.value      = params?.knee       ?? 6
        processor = comp
        break
      }
      case 'delay': {
        const delay = this._ctx.createDelay(5.0)
        delay.delayTime.value = params?.delayTime ?? 0.25
        processor = delay
        break
      }
      case 'gain': {
        const gain = this._ctx.createGain()
        const db   = params?.gainDb ?? 0
        gain.gain.value = db <= -100 ? 0 : Math.pow(10, db / 20)
        processor = gain
        break
      }
      case 'none':
        // No processor — always bypass
        processor = null
        break
    }

    const slot: FxSlot = { bypass, processor, type, enabled: processor !== null }
    this._slots.push(slot)
    this._rewire()
  }

  /**
   * Enable or disable a slot.
   * Uses a short fade (setTargetAtTime) to prevent clicks.
   */
  setSlotEnabled(index: number, enabled: boolean): void {
    const slot = this._slots[index]
    if (!slot || !slot.processor) return
    slot.enabled = enabled
    this._rewire()
  }

  /**
   * Update a parameter on the slot's processor node.
   */
  setSlotParam(index: number, param: string, value: number): void {
    const slot = this._slots[index]
    if (!slot || !slot.processor) return

    const now = this._ctx.currentTime

    if (slot.type === 'compressor' && slot.processor instanceof DynamicsCompressorNode) {
      const comp = slot.processor
      switch (param) {
        case 'threshold': comp.threshold.setTargetAtTime(value, now, 0.005); break
        case 'ratio':     comp.ratio.setTargetAtTime(value, now, 0.005);     break
        case 'attack':    comp.attack.setTargetAtTime(value, now, 0.005);    break
        case 'release':   comp.release.setTargetAtTime(value, now, 0.005);   break
        case 'knee':      comp.knee.setTargetAtTime(value, now, 0.005);      break
      }
    } else if (slot.type === 'delay' && slot.processor instanceof DelayNode) {
      if (param === 'delayTime') {
        slot.processor.delayTime.setTargetAtTime(value, now, 0.005)
      }
    } else if (slot.type === 'gain' && slot.processor instanceof GainNode) {
      if (param === 'gainDb') {
        const linear = value <= -100 ? 0 : Math.pow(10, value / 20)
        slot.processor.gain.setTargetAtTime(linear, now, 0.005)
      }
    }
  }

  dispose(): void {
    this._input.disconnect()
    this._output.disconnect()
    for (const slot of this._slots) {
      try { slot.bypass.disconnect() }    catch { /* not connected */ }
      if (slot.processor) {
        try { slot.processor.disconnect() } catch { /* not connected */ }
      }
    }
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private _rewire(): void {
    // Disconnect everything
    try { this._input.disconnect() } catch { /* ok */ }
    for (const slot of this._slots) {
      try { slot.bypass.disconnect() }    catch { /* ok */ }
      if (slot.processor) {
        try { slot.processor.disconnect() } catch { /* ok */ }
      }
    }

    if (this._slots.length === 0) {
      this._input.connect(this._output)
      return
    }

    const now = this._ctx.currentTime

    // Build chain: connect each slot in series
    let prev: AudioNode = this._input
    for (const slot of this._slots) {
      if (slot.processor && slot.enabled) {
        // Route through processor
        // Use bypass gain for anti-click on toggle
        slot.bypass.gain.cancelScheduledValues(now)
        slot.bypass.gain.setTargetAtTime(0, now, 0.005)
        prev.connect(slot.processor)
        prev = slot.processor
      } else {
        // Bypass: route directly through bypass GainNode
        slot.bypass.gain.cancelScheduledValues(now)
        slot.bypass.gain.setTargetAtTime(1, now, 0.005)
        prev.connect(slot.bypass)
        prev = slot.bypass
      }
    }

    prev.connect(this._output)
  }
}
