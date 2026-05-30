// ─── Core value types ──────────────────────────────────────────────────────

export interface BeatPosition {
  /** 1-based bar number */
  bar: number
  /** 1-based beat within bar */
  beat: number
  /** 0-based tick within beat (0–TICKS_PER_BEAT-1) */
  tick: number
}

export interface ChannelLevel {
  /** RMS amplitude 0..1 */
  rms: number
  /** Peak amplitude 0..1 (with hold) */
  peak: number
  /** dBFS, -∞ to 0 */
  dbfs: number
}

// ─── Transport ─────────────────────────────────────────────────────────────

export interface TransportSnapshot {
  playing: boolean
  recording: boolean
  looping: boolean
  bpm: number
  timeSignatureTop: number
  timeSignatureBottom: number
  loopStartBar: number
  loopEndBar: number
  /** Current position as bar/beat/tick */
  position: BeatPosition
}

// ─── Audio engine config ───────────────────────────────────────────────────

export interface AudioEngineConfig {
  sampleRate?: 44100 | 48000 | 88200 | 96000
  latencyHint?: AudioContextLatencyCategory
  masterGainDb?: number
}

// ─── Track channel ─────────────────────────────────────────────────────────

export interface TrackChannelConfig {
  gainDb: number
  pan: number       // -1 (left) … 0 (center) … +1 (right)
  muted: boolean
  soloed: boolean
}

// ─── Waveform ──────────────────────────────────────────────────────────────

export interface WaveformData {
  /** Normalised RMS per pixel column */
  rms: Float32Array
  /** Normalised peak per pixel column */
  peaks: Float32Array
  /** Source buffer duration in seconds */
  duration: number
  sampleRate: number
}

// ─── AudioBridge interface (native engine abstraction) ─────────────────────

/**
 * Every audio capability the DAW needs.
 * WebAudioBridge implements this with the Web Audio API.
 * NativeAudioBridge (future) will implement it via Electron IPC → Rust/C++.
 */
export interface IAudioBridge {
  // ── Lifecycle ──────────────────────────────────────────────────────
  readonly isReady: boolean
  readonly sampleRate: number
  readonly currentTime: number
  resume(): Promise<void>
  dispose(): void

  // ── Transport ──────────────────────────────────────────────────────
  play(fromBeat?: number): void
  stop(): void
  pause(): void
  setBpm(bpm: number): void
  setTimeSignature(top: number, bottom: number): void
  setLoop(enabled: boolean, startBar: number, endBar: number): void
  seekToBar(bar: number): void

  // ── Buffer management ──────────────────────────────────────────────
  loadBuffer(url: string): Promise<AudioBuffer | null>
  releaseBuffer(url: string): void
  clearBufferCache(): void

  // ── Scheduling ────────────────────────────────────────────────────
  scheduleBuffer(
    buffer: AudioBuffer,
    destination: AudioNode,
    startContextTime: number,
    offsetSec?: number,
    durationSec?: number,
  ): AudioBufferSourceNode

  // ── Metering ──────────────────────────────────────────────────────
  getMasterLevel(): ChannelLevel

  // ── Events ────────────────────────────────────────────────────────
  onBeat(cb: BeatCallback): Unsubscribe
  onBar(cb: BarCallback): Unsubscribe
  onStateChange(cb: StateCallback): Unsubscribe

  // ── Node factory (for channel strips) ─────────────────────────────
  readonly ctx: AudioContext
  readonly masterInput: AudioNode
}

// ─── Callback types ────────────────────────────────────────────────────────

export type BeatCallback     = (beatIndex: number, scheduledTime: number, position: BeatPosition) => void
export type BarCallback      = (bar: number, scheduledTime: number) => void
export type StateCallback    = (state: TransportSnapshot) => void
export type Unsubscribe      = () => void

// ─── Constants ─────────────────────────────────────────────────────────────

export const TICKS_PER_BEAT  = 480   // MIDI-standard resolution
export const MIN_BPM         = 20
export const MAX_BPM         = 300
export const DEFAULT_BPM     = 145
export const SCHEDULER_AHEAD = 0.10  // seconds look-ahead window
export const SCHEDULER_MS    = 25    // setInterval period
