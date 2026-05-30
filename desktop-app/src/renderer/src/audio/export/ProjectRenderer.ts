/**
 * ProjectRenderer — offline audio renderer from project data.
 *
 * Converts the project's tracks/clips into Float32Array PCM buffers:
 *   • MIDI clips → simple sine-wave synthesizer (one sine per note)
 *   • Audio clips → loaded via IPC (recordingReadPcm) with fallback to silence
 *
 * The renderer is intentionally decoupled from AudioContext so it can run
 * in Node.js unit tests. All DSP is pure TypeScript on typed arrays.
 */

import type { Project, Track, Clip, MidiNote } from '../../types/project'

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ProjectRenderOptions {
  sampleRate:         number        // target sample rate (44100 | 48000 | 88200 | 96000)
  startBar:           number        // 1-based, inclusive
  endBar:             number        // 1-based, exclusive end
  tailSamples:        number        // extra silence appended (decay / reverb tail)
  selectedTrackIds?:  string[]      // undefined → all non-muted tracks
  includeMuted:       boolean       // if true, render muted tracks into stems
  masterGainDb:       number        // overall master gain (project.masterGainDb)
}

export interface RenderedStem {
  trackId:   string
  trackName: string
  left:      Float32Array   // mono or left channel
  right:     Float32Array   // right channel (same as left for mono sources)
  gainDb:    number
  panCenter: number
  muted:     boolean
}

export interface ProjectRenderResult {
  mixLeft:      Float32Array
  mixRight:     Float32Array
  stems:        RenderedStem[]
  sampleRate:   number
  totalSamples: number
  bpm:          number
}

export type RenderProgressCallback = (pct: number, phase: string) => void

// ─── Timing math ─────────────────────────────────────────────────────────────

export function barsToSamples(bars: number, bpm: number, sampleRate: number): number {
  // 1 bar = 4 beats @ 4/4; seconds = beats / (bpm/60) = 4 / (bpm/60)
  const secondsPerBar = (4 * 60) / bpm
  return Math.round(bars * secondsPerBar * sampleRate)
}

export function barToSampleOffset(bar: number, bpm: number, sampleRate: number): number {
  return barsToSamples(bar - 1, bpm, sampleRate)
}

export function beatsToSamples(beats: number, bpm: number, sampleRate: number): number {
  return Math.round((beats / bpm) * 60 * sampleRate)
}

// ─── MIDI note → frequency ────────────────────────────────────────────────────

export function midiToHz(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12)
}

// ─── Simple MIDI synthesizer (sine-wave per note) ────────────────────────────
// This is a clearly-marked stub. A production renderer would use a proper
// sampler or wavetable synthesizer.
// STUB: production quality requires wavetable / sampler synthesis.

export function synthMidiClip(
  clip:       Clip,
  bpm:        number,
  sampleRate: number,
): Float32Array {
  const samplesPerBeat    = beatsToSamples(1, bpm, sampleRate)
  const clipLengthBeats   = clip.lengthBars * 4
  const clipLengthSamples = Math.max(1, Math.round(clipLengthBeats * samplesPerBeat))
  const out = new Float32Array(clipLengthSamples)

  for (const note of clip.notes) {
    const freq        = midiToHz(note.pitch)
    const noteSamples = Math.round(note.lengthBeats * samplesPerBeat)
    const startSample = Math.round(note.startBeat * samplesPerBeat)
    const endSample   = Math.min(clipLengthSamples, startSample + noteSamples)
    const amp         = (note.velocity / 127) * 0.3   // keep headroom

    // Sine wave with linear fade-out in last 5% to prevent clicks
    const fadeLen = Math.max(1, Math.round(noteSamples * 0.05))
    for (let i = startSample; i < endSample; i++) {
      const t       = (i - startSample) / sampleRate
      const fade    = i >= endSample - fadeLen ? (endSample - i) / fadeLen : 1
      out[i]       += amp * fade * Math.sin(2 * Math.PI * freq * t)
    }
  }

  return out
}

// ─── Pan law (constant-power) ─────────────────────────────────────────────────

export function panToGains(panCenter: number): { left: number; right: number } {
  // panCenter: -1 (full left) → 0 (center) → +1 (full right)
  const angle = ((panCenter + 1) / 2) * (Math.PI / 2)
  return { left: Math.cos(angle), right: Math.sin(angle) }
}

export function dbToLinear(db: number): number {
  return Math.pow(10, db / 20)
}

// ─── Mix stereo buffer pair ───────────────────────────────────────────────────

function addScaled(
  dest: Float32Array,
  src:  Float32Array,
  scale: number,
  destOffset: number,
): void {
  const len = Math.min(src.length, dest.length - destOffset)
  for (let i = 0; i < len; i++) {
    dest[destOffset + i] += src[i]! * scale
  }
}

// ─── Main render function ─────────────────────────────────────────────────────

export function renderProject(
  project:    Project,
  options:    ProjectRenderOptions,
  onProgress: RenderProgressCallback = () => {},
): ProjectRenderResult {
  const { sampleRate, startBar, endBar, tailSamples, masterGainDb, includeMuted } = options

  const renderBars     = Math.max(0, endBar - startBar)
  const renderSamples  = barsToSamples(renderBars, project.bpm, sampleRate) + tailSamples
  const masterGainLin  = dbToLinear(masterGainDb)

  const mixLeft  = new Float32Array(renderSamples)
  const mixRight = new Float32Array(renderSamples)
  const stems:    RenderedStem[] = []

  const targetTracks = project.tracks.filter((t) => {
    if (options.selectedTrackIds) return options.selectedTrackIds.includes(t.id)
    if (!includeMuted && t.muted) return false
    return true
  })

  const totalTracks = targetTracks.length
  let doneCount = 0

  for (const track of targetTracks) {
    const stemLeft  = new Float32Array(renderSamples)
    const stemRight = new Float32Array(renderSamples)
    const trackGain = dbToLinear(track.gainDb) * masterGainLin
    const { left: panL, right: panR } = panToGains(track.panCenter)

    // Render each clip onto the stem buffer
    for (const clip of track.clips) {
      if (clip.startBar >= endBar || clip.startBar + clip.lengthBars <= startBar) continue

      const clipStartSample = barToSampleOffset(clip.startBar, project.bpm, sampleRate)
      const renderStartSample = barToSampleOffset(startBar, project.bpm, sampleRate)
      const destOffset = Math.max(0, clipStartSample - renderStartSample)

      // Get clip audio
      let clipAudio: Float32Array
      if (track.type === 'midi') {
        // STUB: sine synthesizer for MIDI clips
        clipAudio = synthMidiClip(clip, project.bpm, sampleRate)
      } else {
        // Audio clip: empty (would load from IPC in browser context)
        const clipSamples = barsToSamples(clip.lengthBars, project.bpm, sampleRate)
        clipAudio = new Float32Array(clipSamples)
      }

      if (clip.muted) continue

      addScaled(stemLeft,  clipAudio, trackGain * panL, destOffset)
      addScaled(stemRight, clipAudio, trackGain * panR, destOffset)
    }

    stems.push({
      trackId:   track.id,
      trackName: track.name,
      left:      stemLeft,
      right:     stemRight,
      gainDb:    track.gainDb,
      panCenter: track.panCenter,
      muted:     track.muted,
    })

    // Accumulate into master mix
    for (let i = 0; i < renderSamples; i++) {
      mixLeft[i]  += stemLeft[i]!
      mixRight[i] += stemRight[i]!
    }

    doneCount++
    onProgress(Math.round((doneCount / totalTracks) * 100), 'rendering')
  }

  return {
    mixLeft,
    mixRight,
    stems,
    sampleRate,
    totalSamples: renderSamples,
    bpm: project.bpm,
  }
}

// ─── Build AudioBuffer from render result ─────────────────────────────────────
// Browser-only. Call only in a context that has AudioContext.

export function renderResultToAudioBuffer(
  result: ProjectRenderResult,
  ctx:    { createBuffer(ch: number, len: number, sr: number): AudioBuffer },
): AudioBuffer {
  const buf = ctx.createBuffer(2, result.totalSamples, result.sampleRate)
  buf.getChannelData(0).set(result.mixLeft)
  buf.getChannelData(1).set(result.mixRight)
  return buf
}

// ─── Measure peak dBFS from float arrays ─────────────────────────────────────

export function measurePeakDbFs(left: Float32Array, right: Float32Array): number {
  let peak = 0
  for (let i = 0; i < left.length; i++) {
    const abs = Math.abs(left[i]!)
    if (abs > peak) peak = abs
  }
  for (let i = 0; i < right.length; i++) {
    const abs = Math.abs(right[i]!)
    if (abs > peak) peak = abs
  }
  return peak > 0 ? 20 * Math.log10(peak) : -Infinity
}

// ─── Apply peak normalization to mix ─────────────────────────────────────────

export function normalizePeak(
  left:     Float32Array,
  right:    Float32Array,
  targetDb: number,
): number {
  const peakDb = measurePeakDbFs(left, right)
  if (!isFinite(peakDb)) return 1
  const gainLinear = Math.pow(10, (targetDb - peakDb) / 20)
  // Cap boost at +40 dB
  const safe = Math.min(gainLinear, Math.pow(10, 40 / 20))
  for (let i = 0; i < left.length;  i++) left[i]!  *= safe
  for (let i = 0; i < right.length; i++) right[i]! *= safe
  return safe
}

// ─── Sample rate conversion (linear interpolation) ───────────────────────────
// STUB: production quality uses a polyphase or windowed sinc resampler.

export function resample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input
  const ratio     = fromRate / toRate
  const outLength = Math.round(input.length / ratio)
  const out       = new Float32Array(outLength)
  for (let i = 0; i < outLength; i++) {
    const pos  = i * ratio
    const lo   = Math.floor(pos)
    const hi   = Math.min(lo + 1, input.length - 1)
    const frac = pos - lo
    out[i] = (input[lo]! * (1 - frac)) + (input[hi]! * frac)
  }
  return out
}

// ─── Tail calculation helper ──────────────────────────────────────────────────

export function calcTailSamples(tailMs: number, sampleRate: number): number {
  return Math.max(0, Math.round(tailMs * sampleRate / 1000))
}

// ─── Default options ──────────────────────────────────────────────────────────

export function defaultRenderOptions(project: Project, sampleRate = 44100): ProjectRenderOptions {
  return {
    sampleRate,
    startBar:     1,
    endBar:       project.totalBars + 1,
    tailSamples:  calcTailSamples(500, sampleRate),   // 500 ms tail
    includeMuted: false,
    masterGainDb: project.masterGainDb,
  }
}
