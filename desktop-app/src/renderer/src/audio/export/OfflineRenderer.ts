// ─── OfflineRenderer ──────────────────────────────────────────────────────────
// Renders a project or track selection to Float32Array[] without real-time playback.
//
// NOTE: Real project rendering uses the actual audio clips/plugins; this
// synthesizes MIDI notes as sine waves for testability. A production renderer
// would use the plugin host, sampler engine, and audio clip reader.

import { masterChain, type MasterChainOptions } from './MasterChain'
import { loudnessMeter, type LoudnessMeasurement } from './LoudnessMeter'
import { peakProtector, type PeakAnalysis } from './PeakProtector'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RenderNote {
  pitch:           number  // MIDI note number (0-127)
  startSample:     number  // sample offset from start
  durationSamples: number  // duration in samples
  velocity:        number  // 0-127
}

export interface RenderTrack {
  id:      string
  name:    string
  type:    string
  notes:   RenderNote[]
  gainDb:  number
  pan:     number      // -1 (full left) to +1 (full right)
  muted:   boolean
  soloed:  boolean
}

export interface RenderJob {
  type:             'master' | 'stems' | 'selection' | 'loop'
  tracks:           RenderTrack[]
  sampleRate:       number
  startSample:      number
  endSample:        number
  bpm:              number
  applyMasterChain: boolean
  masterOptions:    MasterChainOptions
}

export interface RenderResult {
  channels:     Map<string, Float32Array[]>  // per-track stems (stems mode)
  masterMix:    Float32Array[]               // stereo master mix [left, right]
  sampleRate:   number
  totalSamples: number
  duration:     number                       // seconds
  loudness?:    LoudnessMeasurement
  peakAnalysis?: PeakAnalysis
  renderTimeMs: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function midiToHz(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12)
}

function dbToLinear(db: number): number {
  return Math.pow(10, db / 20)
}

/** Equal-power pan: returns [leftGain, rightGain] for pan in [-1, +1]. */
function panToGains(pan: number): [number, number] {
  const angle  = ((pan + 1) / 2) * (Math.PI / 2)
  return [Math.cos(angle), Math.sin(angle)]
}

/**
 * Synthesize a MIDI note as a sine wave into an output stereo buffer pair.
 * This is a clearly-marked stub — production would use the actual synth engine.
 */
function synthNote(
  note:        RenderNote,
  sampleRate:  number,
  gainLinear:  number,
  panLeft:     number,
  panRight:    number,
  outLeft:     Float32Array,
  outRight:    Float32Array,
  startOffset: number,
): void {
  const freq      = midiToHz(note.pitch)
  const amplitude = (note.velocity / 127) * gainLinear
  const start     = Math.max(0, note.startSample - startOffset)
  const end       = Math.min(outLeft.length, start + note.durationSamples)
  const fadeLen   = Math.max(1, Math.round(note.durationSamples * 0.05))

  for (let i = start; i < end; i++) {
    const sampleInNote = i - start
    const t            = sampleInNote / sampleRate
    const fade         = sampleInNote >= note.durationSamples - fadeLen
      ? (note.durationSamples - sampleInNote) / fadeLen
      : 1
    const sample       = amplitude * fade * Math.sin(2 * Math.PI * freq * t)
    outLeft[i]  += sample * panLeft
    outRight[i] += sample * panRight
  }
}

// ─── OfflineRenderer class ────────────────────────────────────────────────────

export class OfflineRenderer {
  /**
   * Render a project to Float32Array[] without real-time playback.
   *
   * NOTE: MIDI notes are synthesized as sine waves for testability.
   * Real rendering uses the plugin host and audio clip reader.
   */
  async render(job: RenderJob): Promise<RenderResult> {
    const t0 = Date.now()
    const { tracks, sampleRate, startSample, endSample, applyMasterChain, masterOptions } = job
    const totalSamples = Math.max(0, endSample - startSample)
    const duration     = totalSamples / sampleRate

    // Determine which tracks to render
    const hasSolo    = tracks.some(t => t.soloed)
    const activeTracks = tracks.filter(t => {
      if (t.muted) return false
      if (hasSolo && !t.soloed) return false
      return true
    })

    const masterLeft  = new Float32Array(totalSamples)
    const masterRight = new Float32Array(totalSamples)

    const stemChannels = new Map<string, Float32Array[]>()

    for (const track of activeTracks) {
      const stemLeft  = new Float32Array(totalSamples)
      const stemRight = new Float32Array(totalSamples)
      const gainLin   = dbToLinear(track.gainDb)
      const [panL, panR] = panToGains(track.pan)

      // Synthesize each MIDI note as a sine wave (stub for testability)
      for (const note of track.notes) {
        synthNote(note, sampleRate, gainLin, panL, panR, stemLeft, stemRight, startSample)
      }

      // Save stem for stems mode
      stemChannels.set(track.id, [stemLeft, stemRight])

      // Accumulate into master mix
      for (let i = 0; i < totalSamples; i++) {
        masterLeft[i]  += stemLeft[i]!
        masterRight[i] += stemRight[i]!
      }
    }

    // Normalize master mix if peaks > 1.0
    let peakMax = 0
    for (let i = 0; i < totalSamples; i++) {
      const absL = Math.abs(masterLeft[i]!)
      const absR = Math.abs(masterRight[i]!)
      if (absL > peakMax) peakMax = absL
      if (absR > peakMax) peakMax = absR
    }
    if (peakMax > 1.0) {
      const norm = 1.0 / peakMax
      for (let i = 0; i < totalSamples; i++) {
        masterLeft[i]  = masterLeft[i]! * norm
        masterRight[i] = masterRight[i]! * norm
      }
    }

    let masterMix: Float32Array[] = [masterLeft, masterRight]

    // Apply master chain if requested
    let loudness: LoudnessMeasurement | undefined
    let peakAnalysis: PeakAnalysis | undefined

    if (applyMasterChain) {
      const chain  = new (masterChain.constructor as typeof import('./MasterChain').MasterChain)(masterOptions)
      const result = chain.process(masterMix)
      masterMix    = result.channels
      loudness     = result.loudness
      peakAnalysis = result.peakAnalysis
    } else {
      // Always measure loudness on the master mix
      loudness     = loudnessMeter.measureIntegratedLoudness(masterMix, sampleRate)
      peakAnalysis = peakProtector.analyze(masterMix)
    }

    const renderTimeMs = Date.now() - t0

    return {
      channels:    stemChannels,
      masterMix,
      sampleRate,
      totalSamples,
      duration,
      loudness,
      peakAnalysis,
      renderTimeMs,
    }
  }
}

/** Singleton instance for convenience. */
export const offlineRenderer = new OfflineRenderer()
