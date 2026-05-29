// ─── AudioEditorEngine ────────────────────────────────────────────────────────
// Manages all audio editing operations with undo/redo stack.
// Each operation clones the current buffer before mutating and pushes the
// old snapshot onto the undo stack.

import { AudioEditBuffer } from './AudioEditBuffer.ts'

export type FadeCurve = 'linear' | 'exponential' | 'sine'

const MAX_UNDO = 50
const EXP_BASE = 100

export class AudioEditorEngine {
  private buffer:    AudioEditBuffer
  private undo:      Float32Array[][]  = []
  private redo:      Float32Array[][]  = []
  clipboard:         Float32Array[] | null = null

  constructor(buffer: AudioEditBuffer) {
    this.buffer = buffer
  }

  get editBuffer(): AudioEditBuffer { return this.buffer }

  // ── Undo / Redo ───────────────────────────────────────────────────────────

  canUndo(): boolean { return this.undo.length > 0 }
  canRedo(): boolean { return this.redo.length > 0 }

  private pushUndo(): void {
    this.undo.push(this.buffer.snapshot())
    if (this.undo.length > MAX_UNDO) this.undo.shift()
    this.redo = []
  }

  undo_(): void {
    if (!this.canUndo()) return
    this.redo.push(this.buffer.snapshot())
    const snap = this.undo.pop()!
    this.buffer.restoreSnapshot(snap)
  }

  redo_(): void {
    if (!this.canRedo()) return
    this.undo.push(this.buffer.snapshot())
    const snap = this.redo.pop()!
    this.buffer.restoreSnapshot(snap)
  }

  // ── Cut / Copy / Paste ────────────────────────────────────────────────────

  cut(start: number, end: number): Float32Array[] {
    const flat = this.buffer.flatten()
    const cutData = flat.map(ch => new Float32Array(ch.subarray(start, end)))
    this.clipboard = cutData
    this.pushUndo()
    this.buffer.delete(start, end)
    return cutData
  }

  copy(start: number, end: number): Float32Array[] {
    const flat = this.buffer.flatten()
    const copyData = flat.map(ch => new Float32Array(ch.subarray(start, end)))
    this.clipboard = copyData
    return copyData
  }

  paste(offset: number): void {
    if (!this.clipboard) return
    this.pushUndo()
    this.buffer.insert(offset, this.clipboard)
  }

  // ── Fade In / Out ─────────────────────────────────────────────────────────

  fadeIn(start: number, end: number, curve: FadeCurve = 'linear'): void {
    this.pushUndo()
    this._applyGainRamp(start, end, curve, false)
  }

  fadeOut(start: number, end: number, curve: FadeCurve = 'linear'): void {
    this.pushUndo()
    this._applyGainRamp(start, end, curve, true)
  }

  crossfade(start: number, end: number, otherBuffer: AudioEditBuffer, curve: FadeCurve = 'linear'): void {
    this.pushUndo()
    const len       = end - start
    const flat      = this.buffer.flatten()
    const otherFlat = otherBuffer.flatten()

    for (let ch = 0; ch < this.buffer.channels; ch++) {
      const src   = flat[ch]
      const other = otherFlat[ch] ?? new Float32Array(len)
      for (let i = 0; i < len; i++) {
        const t    = len > 1 ? i / (len - 1) : 0
        const gainA = 1 - this._curve(t, curve, false)
        const gainB = this._curve(t, curve, false)
        if (start + i < src.length) {
          src[start + i] = src[start + i] * gainA + (other[i] ?? 0) * gainB
        }
      }
    }
    this._setFromFlat(flat)
  }

  // ── Normalize ─────────────────────────────────────────────────────────────

  normalize(start: number, end: number, targetDb: number): void {
    this.pushUndo()
    const flat   = this.buffer.flatten()
    const target = Math.pow(10, targetDb / 20)

    let peak = 0
    for (const ch of flat) {
      for (let i = start; i < end && i < ch.length; i++) {
        const abs = Math.abs(ch[i])
        if (abs > peak) peak = abs
      }
    }
    if (peak === 0) return

    const scale = target / peak
    for (const ch of flat) {
      for (let i = start; i < end && i < ch.length; i++) {
        ch[i] *= scale
      }
    }
    this._setFromFlat(flat)
  }

  // ── Reverse ───────────────────────────────────────────────────────────────

  reverse(start: number, end: number): void {
    this.pushUndo()
    const flat = this.buffer.flatten()
    for (const ch of flat) {
      const slice = ch.subarray(start, end)
      slice.reverse()
    }
    this._setFromFlat(flat)
  }

  // ── Gain Clip ─────────────────────────────────────────────────────────────

  gainClip(start: number, end: number, gainDb: number): void {
    this.pushUndo()
    const flat   = this.buffer.flatten()
    const factor = Math.pow(10, gainDb / 20)
    for (const ch of flat) {
      for (let i = start; i < end && i < ch.length; i++) {
        ch[i] *= factor
      }
    }
    this._setFromFlat(flat)
  }

  // ── Timestretch (linear interpolation stub) ───────────────────────────────

  // STUB: production timestretch uses WSOLA or phase-vocoder algorithm
  timestretch(start: number, end: number, factor: number): void {
    if (factor <= 0) throw new RangeError('factor must be > 0')
    this.pushUndo()
    const flat    = this.buffer.flatten()
    const inLen   = end - start
    const outLen  = Math.round((inLen - 1) / factor) + 1
    const stretched: Float32Array[] = flat.map(ch => {
      const inSlice  = ch.subarray(start, end)
      const out      = new Float32Array(outLen)
      for (let i = 0; i < outLen; i++) {
        const srcIdx = i * factor
        const lo     = Math.floor(srcIdx)
        const hi     = Math.min(lo + 1, inLen - 1)
        const frac   = srcIdx - lo
        out[i] = (inSlice[lo] ?? 0) * (1 - frac) + (inSlice[hi] ?? 0) * frac
      }
      return out
    })

    const total = flat[0].length - inLen + outLen
    const merged = flat.map((ch, ci) => {
      const result = new Float32Array(total)
      result.set(ch.subarray(0, start), 0)
      result.set(stretched[ci], start)
      result.set(ch.subarray(end), start + outLen)
      return result
    })
    this._setFromFlat(merged)
  }

  // ── Insert Silence ────────────────────────────────────────────────────────

  insertSilence(offset: number, lengthSamples: number): void {
    this.pushUndo()
    const silence = Array.from({ length: this.buffer.channels }, () => new Float32Array(lengthSamples))
    this.buffer.insert(offset, silence)
  }

  // ── Trim ─────────────────────────────────────────────────────────────────

  trim(start: number, end: number): void {
    this.pushUndo()
    const len = this.buffer.totalLength
    if (end < len) this.buffer.delete(end, len)
    if (start > 0) this.buffer.delete(0, start)
  }

  // ── Waveform Data ─────────────────────────────────────────────────────────

  getWaveformData(downsampleFactor: number): { min: Float32Array; max: Float32Array; rms: Float32Array } {
    const flat   = this.buffer.flatten()
    const mono   = flat[0] ?? new Float32Array(0)
    const pixels = Math.ceil(mono.length / downsampleFactor)
    const min    = new Float32Array(pixels)
    const max    = new Float32Array(pixels)
    const rms    = new Float32Array(pixels)

    for (let px = 0; px < pixels; px++) {
      const s  = px * downsampleFactor
      const e  = Math.min(s + downsampleFactor, mono.length)
      let mn   = Infinity, mx = -Infinity, sum2 = 0
      for (let i = s; i < e; i++) {
        const v = mono[i]
        if (v < mn) mn = v
        if (v > mx) mx = v
        sum2 += v * v
      }
      min[px] = mn === Infinity  ? 0 : mn
      max[px] = mx === -Infinity ? 0 : mx
      rms[px] = Math.sqrt(sum2 / (e - s))
    }
    return { min, max, rms }
  }

  export(): Float32Array[] {
    return this.buffer.flatten()
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  private _applyGainRamp(start: number, end: number, curve: FadeCurve, invert: boolean): void {
    const flat = this.buffer.flatten()
    const len  = end - start
    for (const ch of flat) {
      for (let i = 0; i < len; i++) {
        const t    = len > 1 ? i / (len - 1) : 0
        const gain = this._curve(t, curve, invert)
        if (start + i < ch.length) ch[start + i] *= gain
      }
    }
    this._setFromFlat(flat)
  }

  private _curve(t: number, curve: FadeCurve, invert: boolean): number {
    let gain: number
    if (curve === 'linear') {
      gain = t
    } else if (curve === 'exponential') {
      gain = t === 0 ? 0 : (Math.pow(EXP_BASE, t) - 1) / (EXP_BASE - 1)
    } else {
      gain = Math.pow(Math.sin(t * Math.PI / 2), 2)
    }
    return invert ? 1 - gain : gain
  }

  private _setFromFlat(data: Float32Array[]): void {
    this.buffer.restoreSnapshot(data)
  }
}
