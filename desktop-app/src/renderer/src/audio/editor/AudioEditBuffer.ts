// ─── AudioEditBuffer ──────────────────────────────────────────────────────────
// Non-destructive PCM edit buffer. Internally stores a list of regions
// (sourceBuffer + offset + length) that are concatenated on flatten().

export interface Region {
  sourceBuffer: Float32Array[]  // one Float32Array per channel
  sourceOffset: number
  length:       number
}

export class AudioEditBuffer {
  private regions:  Region[]
  readonly channels: number

  constructor(channels: number, initialData?: Float32Array[]) {
    this.channels = channels
    if (initialData) {
      this.regions = [{
        sourceBuffer: initialData.map(ch => new Float32Array(ch)),
        sourceOffset: 0,
        length:       initialData[0]?.length ?? 0,
      }]
    } else {
      this.regions = []
    }
  }

  get totalLength(): number {
    return this.regions.reduce((sum, r) => sum + r.length, 0)
  }

  // ── Flatten ──────────────────────────────────────────────────────────────

  flatten(): Float32Array[] {
    const len = this.totalLength
    const out = Array.from({ length: this.channels }, () => new Float32Array(len))
    let pos = 0
    for (const region of this.regions) {
      for (let ch = 0; ch < this.channels; ch++) {
        const src = region.sourceBuffer[ch]
        if (!src) continue
        out[ch].set(src.subarray(region.sourceOffset, region.sourceOffset + region.length), pos)
      }
      pos += region.length
    }
    return out
  }

  // ── Mutations (non-destructive: rebuild region list) ──────────────────────

  insert(offset: number, data: Float32Array[]): void {
    const flat = this.flatten()
    const len  = this.totalLength
    const clampedOffset = Math.max(0, Math.min(offset, len))
    const insertLen = data[0]?.length ?? 0
    if (insertLen === 0) return

    const merged: Float32Array[] = flat.map((ch, i) => {
      const result = new Float32Array(len + insertLen)
      result.set(ch.subarray(0, clampedOffset), 0)
      const src = data[i] ?? new Float32Array(insertLen)
      result.set(src.subarray(0, insertLen), clampedOffset)
      result.set(ch.subarray(clampedOffset), clampedOffset + insertLen)
      return result
    })
    this.setFromFlat(merged)
  }

  delete(start: number, end: number): void {
    const flat = this.flatten()
    const len  = this.totalLength
    const s = Math.max(0, Math.min(start, len))
    const e = Math.max(s, Math.min(end, len))
    if (s === e) return

    const merged = flat.map(ch => {
      const result = new Float32Array(len - (e - s))
      result.set(ch.subarray(0, s), 0)
      result.set(ch.subarray(e), s)
      return result
    })
    this.setFromFlat(merged)
  }

  replace(start: number, end: number, data: Float32Array[]): void {
    this.delete(start, end)
    this.insert(start, data)
  }

  // ── Clone ─────────────────────────────────────────────────────────────────

  clone(): AudioEditBuffer {
    const flat = this.flatten()
    return new AudioEditBuffer(this.channels, flat)
  }

  // ── Snapshot (for undo stack) ─────────────────────────────────────────────

  snapshot(): Float32Array[] {
    return this.flatten()
  }

  restoreSnapshot(data: Float32Array[]): void {
    this.setFromFlat(data)
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private setFromFlat(data: Float32Array[]): void {
    const length = data[0]?.length ?? 0
    this.regions = [{
      sourceBuffer: data.map(ch => new Float32Array(ch)),
      sourceOffset: 0,
      length,
    }]
  }
}
