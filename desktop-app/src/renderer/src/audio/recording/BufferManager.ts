// ─── BufferManager ────────────────────────────────────────────────────────────
// Pre-allocated ring buffer for dropout-safe audio recording.
// Uses Float32Array per channel. No dynamic allocation after construction.

export class BufferManager {
  private _buffers:      Float32Array[]
  private _capacity:     number
  private _channelCount: number
  private _writePos:     number = 0
  private _readPos:      number = 0
  private _available:    number = 0
  private _overrun:      boolean = false

  constructor(capacitySamples: number, channelCount: number) {
    this._capacity     = capacitySamples
    this._channelCount = channelCount
    this._buffers      = Array.from({ length: channelCount }, () => new Float32Array(capacitySamples))
  }

  // Write per-channel samples into the ring buffer.
  // channels: Float32Array[] — one per channel, each of same length.
  // Returns false and sets _overrun if there is not enough free space.
  write(channels: Float32Array[]): boolean {
    const count = channels[0]?.length ?? 0
    if (count === 0) return true

    const free = this._capacity - this._available
    if (count > free) {
      this._overrun = true
      return false
    }

    const chCount = Math.min(channels.length, this._channelCount)

    for (let i = 0; i < count; i++) {
      const pos = (this._writePos + i) % this._capacity
      for (let ch = 0; ch < chCount; ch++) {
        this._buffers[ch][pos] = channels[ch][i]
      }
      // Zero-fill any channels not provided
      for (let ch = chCount; ch < this._channelCount; ch++) {
        this._buffers[ch][pos] = 0
      }
    }

    this._writePos = (this._writePos + count) % this._capacity
    this._available += count
    return true
  }

  // Read `count` samples per channel from the ring buffer.
  // Returns null if fewer than `count` samples are available.
  read(count: number): Float32Array[] | null {
    if (count > this._available) return null

    const out = Array.from({ length: this._channelCount }, () => new Float32Array(count))

    for (let i = 0; i < count; i++) {
      const pos = (this._readPos + i) % this._capacity
      for (let ch = 0; ch < this._channelCount; ch++) {
        out[ch][i] = this._buffers[ch][pos]
      }
    }

    this._readPos  = (this._readPos + count) % this._capacity
    this._available -= count
    return out
  }

  getAvailable(): number  { return this._available }
  getCapacity():  number  { return this._capacity }
  isOverrun():    boolean { return this._overrun }

  reset(): void {
    this._writePos  = 0
    this._readPos   = 0
    this._available = 0
    this._overrun   = false
    for (const buf of this._buffers) {
      buf.fill(0)
    }
  }
}
