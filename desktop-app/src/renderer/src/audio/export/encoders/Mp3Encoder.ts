// ─── MP3 Encoder ──────────────────────────────────────────────────────────────
// Wraps an MP3 encoding backend with a clean async API.
//
// Encoding strategy (in priority order):
//   1. lamejs  — pure-JS LAME port, loaded on demand via dynamic import
//   2. ffmpeg.wasm — full FFmpeg in WebAssembly (large, ~30 MB WASM blob)
//   3. Electron IPC → Node.js child_process ffmpeg — preferred for desktop
//
// This file implements the lamejs path and the Electron IPC path.
// Drop in a different backend by replacing encodeLamejs().

export type Mp3Quality = 0 | 1 | 2 | 3 | 4 | 5   // 0=best 5=fastest
export type Mp3Bitrate = 64 | 96 | 128 | 160 | 192 | 256 | 320

export interface Mp3Options {
  bitrate:  Mp3Bitrate
  quality?: Mp3Quality
  vbr?:     boolean
}

// ── lamejs integration ────────────────────────────────────────────────────────
// lamejs: npm install lamejs  OR  import from CDN
// It exposes Mp3Encoder(channels, sampleRate, bitrate)

interface LameEncoder {
  encodeBuffer(left: Int16Array, right?: Int16Array): Int8Array
  flush(): Int8Array
}

type LameLib = {
  Mp3Encoder: new (channels: number, sampleRate: number, bitrate: number) => LameEncoder
}

async function loadLame(): Promise<LameLib | null> {
  try {
    // Dynamic import — works if lamejs is in node_modules or as a CDN module
    const mod = await import('lamejs' as string)
    return mod as unknown as LameLib
  } catch {
    return null
  }
}

function floatToInt16(float: Float32Array): Int16Array {
  const int16 = new Int16Array(float.length)
  for (let i = 0; i < float.length; i++) {
    const s = Math.max(-1, Math.min(1, float[i]!))
    int16[i] = Math.round(s < 0 ? s * 0x8000 : s * 0x7fff)
  }
  return int16
}

async function encodeLamejs(buffer: AudioBuffer, opts: Mp3Options): Promise<Uint8Array | null> {
  const lame = await loadLame()
  if (!lame) return null

  const numCh = buffer.numberOfChannels
  const sr    = buffer.sampleRate
  const enc   = new lame.Mp3Encoder(numCh, sr, opts.bitrate)

  const left  = floatToInt16(buffer.getChannelData(0))
  const right = numCh > 1 ? floatToInt16(buffer.getChannelData(1)) : undefined

  const CHUNK = 1152  // LAME expects multiples of 576
  const parts: Int8Array[] = []

  for (let offset = 0; offset < left.length; offset += CHUNK) {
    const l = left.subarray(offset, offset + CHUNK)
    const r = right?.subarray(offset, offset + CHUNK)
    parts.push(enc.encodeBuffer(l, r))
  }
  parts.push(enc.flush())

  let totalLen = 0
  for (const p of parts) totalLen += p.length
  const out = new Uint8Array(totalLen)
  let pos = 0
  for (const p of parts) { out.set(new Uint8Array(p.buffer, p.byteOffset, p.byteLength), pos); pos += p.length }
  return out
}

// ── IPC path (Electron desktop) ───────────────────────────────────────────────
// WAV → Electron main process → ffmpeg binary → MP3 bytes back

async function encodeViaIPC(
  buffer:  AudioBuffer,
  opts:    Mp3Options,
): Promise<Uint8Array | null> {
  // Check if Electron IPC is available
  const api = (window as Window & { electronAPI?: { encodeMP3?: (wav: ArrayBuffer, opts: unknown) => Promise<ArrayBuffer> } }).electronAPI
  if (!api?.encodeMP3) return null

  // Encode to WAV first (lossless), send over IPC, receive MP3
  const { encodeWav } = await import('./WavEncoder')
  const wav = encodeWav(buffer, { bitDepth: 16, floatFormat: false })
  const mp3ab = await api.encodeMP3(wav, opts)
  return new Uint8Array(mp3ab)
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface Mp3EncodeResult {
  data:    Uint8Array
  backend: 'lamejs' | 'ipc' | 'fallback'
}

export async function encodeMp3(buffer: AudioBuffer, opts: Mp3Options): Promise<Mp3EncodeResult> {
  // Try lamejs first (browser + Electron renderer)
  const lameResult = await encodeLamejs(buffer, opts)
  if (lameResult) return { data: lameResult, backend: 'lamejs' }

  // Try Electron IPC (desktop only, requires ffmpeg in PATH)
  const ipcResult = await encodeViaIPC(buffer, opts)
  if (ipcResult) return { data: ipcResult, backend: 'ipc' }

  // Fallback: return WAV in an MP3 wrapper (not true MP3, but prevents silent failure)
  // In production: throw here and show a clear "install FFmpeg" message
  const { encodeWav } = await import('./WavEncoder')
  const wavFallback = encodeWav(buffer, { bitDepth: 16, floatFormat: false })
  console.warn('[Mp3Encoder] No MP3 backend available — returning WAV fallback. Install lamejs or provide ffmpeg.')
  return { data: new Uint8Array(wavFallback), backend: 'fallback' }
}
