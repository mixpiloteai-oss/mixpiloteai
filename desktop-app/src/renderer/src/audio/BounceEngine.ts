// ─── Bounce Engine ────────────────────────────────────────────────────────────
// Offline full-mix render with progress reporting.
// Exports the result as a WAV Blob or Float32Array[].

import { AudioEngine } from './AudioEngine'

export interface BounceOptions {
  durationSec:  number
  sampleRate?:  number
  channels?:    number
  normalize?:   boolean   // peak-normalise output to −0.3 dBFS
  bitDepth?:    16 | 24 | 32
}

export interface BounceResult {
  buffer:     AudioBuffer
  wav:        Blob
  durationSec: number
  peakLinear: number
  peakdBFS:   number
  sizeBytes:  number
}

type BounceProgressCallback = (pct: number, phase: 'rendering' | 'encoding') => void

// ── WAV encoder ───────────────────────────────────────────────────────────────

function encodeWav(buffer: AudioBuffer, bitDepth: 16 | 24 | 32 = 32): ArrayBuffer {
  const numCh      = buffer.numberOfChannels
  const numFrames  = buffer.length
  const sr         = buffer.sampleRate
  const bytesPerSamp = bitDepth / 8
  const dataLen    = numFrames * numCh * bytesPerSamp
  const fileLen    = 44 + dataLen
  const ab         = new ArrayBuffer(fileLen)
  const view       = new DataView(ab)
  const writeStr   = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)) }

  writeStr(0,  'RIFF')
  view.setUint32(4,  fileLen - 8, true)
  writeStr(8,  'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, bitDepth === 32 ? 3 : 1, true)  // 3 = IEEE float
  view.setUint16(22, numCh, true)
  view.setUint32(24, sr, true)
  view.setUint32(28, sr * numCh * bytesPerSamp, true)
  view.setUint16(32, numCh * bytesPerSamp, true)
  view.setUint16(34, bitDepth, true)
  writeStr(36, 'data')
  view.setUint32(40, dataLen, true)

  let offset = 44
  const channels: Float32Array[] = []
  for (let c = 0; c < numCh; c++) channels.push(buffer.getChannelData(c))

  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < numCh; c++) {
      const s = Math.max(-1, Math.min(1, channels[c]![i]!))
      if (bitDepth === 32) {
        view.setFloat32(offset, s, true); offset += 4
      } else if (bitDepth === 24) {
        const v = Math.round(s < 0 ? s * 0x800000 : s * 0x7fffff)
        view.setUint8(offset,     v & 0xff)
        view.setUint8(offset + 1, (v >> 8) & 0xff)
        view.setUint8(offset + 2, (v >> 16) & 0xff)
        offset += 3
      } else {
        view.setInt16(offset, Math.round(s < 0 ? s * 0x8000 : s * 0x7fff), true)
        offset += 2
      }
    }
  }
  return ab
}

// ── BounceEngine ──────────────────────────────────────────────────────────────

export class BounceEngine {
  private _active = false

  get isActive(): boolean { return this._active }

  /**
   * Start a bounce. The caller must wire sources into offCtx.destination before
   * calling this. Returns a BounceResult with the rendered AudioBuffer and WAV blob.
   *
   * Usage:
   *   const offCtx = engine.createContext(opts)
   *   // sourceNode.connect(offCtx.destination)
   *   const result = await engine.render(offCtx, opts, onProgress)
   */
  createContext(opts: BounceOptions): OfflineAudioContext {
    const sr  = opts.sampleRate ?? AudioEngine.getInstance().sampleRate
    const ch  = opts.channels ?? 2
    const len = Math.ceil(opts.durationSec * sr)
    return new OfflineAudioContext(ch, len, sr)
  }

  async render(
    offCtx:      OfflineAudioContext,
    opts:        BounceOptions,
    onProgress?: BounceProgressCallback,
  ): Promise<BounceResult> {
    if (this._active) throw new Error('BounceEngine: already rendering')
    this._active = true

    const expectedMs = (offCtx.length / offCtx.sampleRate) * 200
    let pct = 0
    const timer = setInterval(() => {
      pct = Math.min(pct + 4, 88)
      onProgress?.(pct, 'rendering')
    }, Math.max(50, expectedMs / 25))

    let rendered: AudioBuffer
    try {
      rendered = await offCtx.startRendering()
    } finally {
      clearInterval(timer)
    }

    onProgress?.(90, 'encoding')

    // Peak scan
    let peak = 0
    for (let c = 0; c < rendered.numberOfChannels; c++) {
      const ch = rendered.getChannelData(c)
      for (let i = 0; i < ch.length; i++) {
        const abs = Math.abs(ch[i]!)
        if (abs > peak) peak = abs
      }
    }

    // Optional normalise to −0.3 dBFS
    if (opts.normalize && peak > 0) {
      const target = Math.pow(10, -0.3 / 20)
      const gain   = target / peak
      for (let c = 0; c < rendered.numberOfChannels; c++) {
        const ch = rendered.getChannelData(c)
        for (let i = 0; i < ch.length; i++) ch[i]! *= gain
      }
      peak = target
    }

    const wavAb = encodeWav(rendered, opts.bitDepth ?? 32)
    onProgress?.(100, 'encoding')

    this._active = false
    return {
      buffer:      rendered,
      wav:         new Blob([wavAb], { type: 'audio/wav' }),
      durationSec: rendered.duration,
      peakLinear:  peak,
      peakdBFS:    peak > 0 ? 20 * Math.log10(peak) : -Infinity,
      sizeBytes:   wavAb.byteLength,
    }
  }

  /** Download the WAV blob as a file. */
  download(result: BounceResult, filename = 'bounce.wav'): void {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(result.wav)
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 60_000)
  }
}

export const bounceEngine = new BounceEngine()
