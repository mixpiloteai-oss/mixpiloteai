// ─── ProjectRenderer.test.ts ──────────────────────────────────────────────────
// Tests the pure-TS rendering math: bar↔sample conversions, MIDI synthesis,
// pan law, mix accumulation, normalization, sample rate conversion.
// No browser APIs used — all pure Node.js.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  barsToSamples,
  barToSampleOffset,
  beatsToSamples,
  midiToHz,
  synthMidiClip,
  panToGains,
  dbToLinear,
  renderProject,
  measurePeakDbFs,
  normalizePeak,
  resample,
  calcTailSamples,
  defaultRenderOptions,
} from '../../src/renderer/src/audio/export/ProjectRenderer.ts'

import type { Project, Clip, Track, MidiNote } from '../../src/renderer/src/types/project.ts'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeNote(id: string, pitch: number, startBeat: number, lengthBeats: number, velocity = 100): MidiNote {
  return { id, pitch, startBeat, lengthBeats, velocity }
}

function makeClip(id: string, trackId: string, startBar: number, lengthBars: number, notes: MidiNote[] = []): Clip {
  return { id, trackId, name: 'Clip', startBar, lengthBars, color: '#fff', muted: false, notes }
}

function makeTrack(id: string, clips: Clip[] = [], gainDb = 0, panCenter = 0, muted = false): Track {
  return {
    id, name: `Track ${id}`, type: 'midi', color: '#fff',
    gainDb, panCenter, muted, soloed: false, armed: false,
    sends: [], height: 64, clips,
  }
}

function makeProject(tracks: Track[] = [], bpm = 120, totalBars = 8): Project {
  return {
    id: 'p', name: 'Test', bpm, sampleRate: 44100,
    timeSignatureNumerator: 4, timeSignatureDenominator: 4,
    masterGainDb: 0, loopStart: 1, loopEnd: 9, totalBars,
    tracks,
  }
}

// ─── barsToSamples ────────────────────────────────────────────────────────────

describe('ProjectRenderer / barsToSamples', () => {
  it('1 bar at 120 BPM at 44100 Hz = 88200 samples', () => {
    // 1 bar = 4 beats @ 4/4; 120 BPM → 2 s/bar → 88200 samples
    assert.equal(barsToSamples(1, 120, 44100), 88200)
  })

  it('0 bars = 0 samples', () => {
    assert.equal(barsToSamples(0, 120, 44100), 0)
  })

  it('2 bars at 120 BPM = 176400 samples', () => {
    assert.equal(barsToSamples(2, 120, 44100), 176400)
  })

  it('1 bar at 60 BPM = 4 seconds = 176400 samples @ 44100', () => {
    assert.equal(barsToSamples(1, 60, 44100), 176400)
  })

  it('scales correctly with sample rate', () => {
    assert.equal(barsToSamples(1, 120, 48000), 96000)
  })
})

// ─── barToSampleOffset ────────────────────────────────────────────────────────

describe('ProjectRenderer / barToSampleOffset', () => {
  it('bar 1 = offset 0', () => {
    assert.equal(barToSampleOffset(1, 120, 44100), 0)
  })

  it('bar 2 at 120 BPM = 88200 samples', () => {
    assert.equal(barToSampleOffset(2, 120, 44100), 88200)
  })

  it('bar 3 at 120 BPM = 176400 samples', () => {
    assert.equal(barToSampleOffset(3, 120, 44100), 176400)
  })
})

// ─── beatsToSamples ───────────────────────────────────────────────────────────

describe('ProjectRenderer / beatsToSamples', () => {
  it('1 beat at 120 BPM at 44100 Hz = 22050 samples', () => {
    assert.equal(beatsToSamples(1, 120, 44100), 22050)
  })

  it('4 beats = 88200 samples @ 120 BPM @ 44100', () => {
    assert.equal(beatsToSamples(4, 120, 44100), 88200)
  })
})

// ─── midiToHz ─────────────────────────────────────────────────────────────────

describe('ProjectRenderer / midiToHz', () => {
  it('MIDI 69 = 440 Hz (A4)', () => {
    assert.ok(Math.abs(midiToHz(69) - 440) < 0.001)
  })

  it('MIDI 60 = 261.63 Hz (C4)', () => {
    assert.ok(Math.abs(midiToHz(60) - 261.626) < 0.01)
  })

  it('MIDI 81 = 880 Hz (A5, one octave above A4)', () => {
    assert.ok(Math.abs(midiToHz(81) - 880) < 0.001)
  })

  it('each semitone up multiplies by 2^(1/12)', () => {
    const ratio = midiToHz(70) / midiToHz(69)
    assert.ok(Math.abs(ratio - Math.pow(2, 1 / 12)) < 1e-6)
  })
})

// ─── synthMidiClip ────────────────────────────────────────────────────────────

describe('ProjectRenderer / synthMidiClip', () => {
  it('returns Float32Array of correct length', () => {
    const clip = makeClip('c1', 'tk1', 1, 1)   // 1 bar
    const out  = synthMidiClip(clip, 120, 44100)
    // 1 bar @ 120 BPM = 88200 samples
    assert.equal(out.length, 88200)
  })

  it('silence for clip with no notes', () => {
    const clip = makeClip('c1', 'tk1', 1, 1)
    const out  = synthMidiClip(clip, 120, 44100)
    let maxAbs = 0
    for (let i = 0; i < out.length; i++) { const abs = Math.abs(out[i]!); if (abs > maxAbs) maxAbs = abs }
    assert.equal(maxAbs, 0)
  })

  it('non-zero output for clip with a note', () => {
    const note = makeNote('n1', 69, 0, 2)
    const clip = makeClip('c1', 'tk1', 1, 2, [note])
    const out  = synthMidiClip(clip, 120, 44100)
    let maxAbs = 0
    for (let i = 0; i < out.length; i++) { const abs = Math.abs(out[i]!); if (abs > maxAbs) maxAbs = abs }
    assert.ok(maxAbs > 0, 'clip with note should produce non-zero audio')
  })

  it('amplitude is bounded by velocity (0.3 headroom)', () => {
    const note = makeNote('n1', 69, 0, 1, 127)
    const clip = makeClip('c1', 'tk1', 1, 2, [note])
    const out  = synthMidiClip(clip, 120, 44100)
    let maxAbs = 0
    for (let i = 0; i < out.length; i++) { const abs = Math.abs(out[i]!); if (abs > maxAbs) maxAbs = abs }
    assert.ok(maxAbs <= 0.35, `peak ${maxAbs} exceeds headroom`)
  })

  it('multiple notes accumulate correctly (no overflow)', () => {
    const notes = [
      makeNote('n1', 60, 0, 1),
      makeNote('n2', 64, 0, 1),
      makeNote('n3', 67, 0, 1),
    ]
    const clip = makeClip('c1', 'tk1', 1, 2, notes)
    const out  = synthMidiClip(clip, 120, 44100)
    for (let i = 0; i < out.length; i++) {
      assert.ok(out[i]! >= -1 && out[i]! <= 1, `sample ${i} = ${out[i]} out of range`)
    }
  })
})

// ─── panToGains ───────────────────────────────────────────────────────────────

describe('ProjectRenderer / panToGains', () => {
  it('center pan (0) → equal left/right gain', () => {
    const { left, right } = panToGains(0)
    assert.ok(Math.abs(left - right) < 1e-6, `left=${left}, right=${right}`)
  })

  it('full left (-1) → left gain ≈ 1, right ≈ 0', () => {
    const { left, right } = panToGains(-1)
    assert.ok(Math.abs(left - 1) < 1e-6,  `left=${left}`)
    assert.ok(Math.abs(right)    < 1e-6,  `right=${right}`)
  })

  it('full right (+1) → left ≈ 0, right ≈ 1', () => {
    const { left, right } = panToGains(1)
    assert.ok(Math.abs(left)      < 1e-6, `left=${left}`)
    assert.ok(Math.abs(right - 1) < 1e-6, `right=${right}`)
  })

  it('constant-power law: left² + right² ≈ 1', () => {
    for (const pan of [-1, -0.5, 0, 0.5, 1]) {
      const { left, right } = panToGains(pan)
      const sum = left * left + right * right
      assert.ok(Math.abs(sum - 1) < 1e-6, `pan=${pan}: sum=${sum}`)
    }
  })
})

// ─── dbToLinear ───────────────────────────────────────────────────────────────

describe('ProjectRenderer / dbToLinear', () => {
  it('0 dB = 1.0', () => {
    assert.ok(Math.abs(dbToLinear(0) - 1) < 1e-9)
  })

  it('-6 dB ≈ 0.501', () => {
    assert.ok(Math.abs(dbToLinear(-6) - 0.5012) < 0.001)
  })

  it('-Infinity dB ≈ 0', () => {
    assert.ok(dbToLinear(-120) < 1e-5)
  })
})

// ─── renderProject ────────────────────────────────────────────────────────────

describe('ProjectRenderer / renderProject', () => {
  it('output length = renderBars * samplesPerBar + tailSamples', () => {
    const project = makeProject([], 120, 4)
    const opts    = defaultRenderOptions(project, 44100)
    const result  = renderProject(project, opts)
    const expectedBars    = opts.endBar - opts.startBar  // 4
    const expectedSamples = barsToSamples(expectedBars, 120, 44100) + opts.tailSamples
    assert.equal(result.totalSamples, expectedSamples)
  })

  it('produces stereo output (mixLeft + mixRight)', () => {
    const project = makeProject([], 120, 2)
    const opts    = defaultRenderOptions(project, 44100)
    const result  = renderProject(project, opts)
    assert.ok(result.mixLeft  instanceof Float32Array)
    assert.ok(result.mixRight instanceof Float32Array)
    assert.equal(result.mixLeft.length, result.totalSamples)
  })

  it('silence for project with no clips', () => {
    const project = makeProject([makeTrack('tk1', [])], 120, 2)
    const opts    = defaultRenderOptions(project, 44100)
    const result  = renderProject(project, opts)
    let maxAbs = 0
    for (const v of result.mixLeft)  { const abs = Math.abs(v); if (abs > maxAbs) maxAbs = abs }
    assert.equal(maxAbs, 0)
  })

  it('non-silent output when MIDI clip with notes exists', () => {
    const note    = makeNote('n1', 69, 0, 2, 100)
    const clip    = makeClip('c1', 'tk1', 1, 2, [note])
    const track   = makeTrack('tk1', [clip])
    const project = makeProject([track], 120, 4)
    const opts    = defaultRenderOptions(project, 44100)
    const result  = renderProject(project, opts)
    let maxAbs = 0
    for (const v of result.mixLeft) { const abs = Math.abs(v); if (abs > maxAbs) maxAbs = abs }
    assert.ok(maxAbs > 0, 'should have non-zero audio')
  })

  it('gain 0 dB (lin=1) on track with notes → non-zero output', () => {
    const note  = makeNote('n1', 69, 0, 1)
    const clip  = makeClip('c1', 'tk1', 1, 1, [note])
    const track = makeTrack('tk1', [clip], 0)   // 0 dB
    const proj  = makeProject([track], 120, 2)
    const opts  = defaultRenderOptions(proj, 44100)
    const res   = renderProject(proj, opts)
    let maxAbs  = 0
    for (const v of res.mixLeft) { if (Math.abs(v) > maxAbs) maxAbs = Math.abs(v) }
    assert.ok(maxAbs > 0)
  })

  it('gain -Infinity mutes track', () => {
    const note  = makeNote('n1', 69, 0, 1)
    const clip  = makeClip('c1', 'tk1', 1, 1, [note])
    // -120 dB is effectively -Infinity
    const track = makeTrack('tk1', [clip], -120)
    const proj  = makeProject([track], 120, 2)
    const opts  = defaultRenderOptions(proj, 44100)
    const res   = renderProject(proj, opts)
    let maxAbs  = 0
    for (const v of res.mixLeft) { if (Math.abs(v) > maxAbs) maxAbs = Math.abs(v) }
    assert.ok(maxAbs < 1e-4, `expected near-silence, got peak ${maxAbs}`)
  })

  it('muted track is excluded when includeMuted=false', () => {
    const note  = makeNote('n1', 69, 0, 2)
    const clip  = makeClip('c1', 'tk1', 1, 2, [note])
    const track = makeTrack('tk1', [clip], 0, 0, true)   // muted
    const proj  = makeProject([track], 120, 4)
    const opts  = { ...defaultRenderOptions(proj, 44100), includeMuted: false }
    const res   = renderProject(proj, opts)
    let maxAbs  = 0
    for (const v of res.mixLeft) { if (Math.abs(v) > maxAbs) maxAbs = Math.abs(v) }
    assert.equal(maxAbs, 0, 'muted track should be silent')
  })

  it('selectedTrackIds isolates rendering to specified tracks', () => {
    const note1 = makeNote('n1', 60, 0, 2)
    const note2 = makeNote('n2', 72, 0, 2)
    const clip1 = makeClip('c1', 'tk1', 1, 2, [note1])
    const clip2 = makeClip('c2', 'tk2', 1, 2, [note2])
    const track1 = makeTrack('tk1', [clip1])
    const track2 = makeTrack('tk2', [clip2])
    const proj  = makeProject([track1, track2], 120, 4)

    // Render only tk1
    const opts = { ...defaultRenderOptions(proj, 44100), selectedTrackIds: ['tk1'] }
    const res  = renderProject(proj, opts)
    assert.equal(res.stems.length, 1)
    assert.equal(res.stems[0]!.trackId, 'tk1')
  })

  it('stems array has one entry per rendered track', () => {
    const tracks = ['tk1', 'tk2', 'tk3'].map(id => makeTrack(id, []))
    const proj   = makeProject(tracks, 120, 4)
    const opts   = defaultRenderOptions(proj, 44100)
    const res    = renderProject(proj, opts)
    assert.equal(res.stems.length, 3)
  })

  it('pan full left: left channel louder than right', () => {
    const note  = makeNote('n1', 69, 0, 2)
    const clip  = makeClip('c1', 'tk1', 1, 2, [note])
    const track = makeTrack('tk1', [clip], 0, -1)   // full left pan
    const proj  = makeProject([track], 120, 4)
    const opts  = defaultRenderOptions(proj, 44100)
    const res   = renderProject(proj, opts)
    let peakL = 0, peakR = 0
    for (const v of res.mixLeft)  { if (Math.abs(v) > peakL) peakL = Math.abs(v) }
    for (const v of res.mixRight) { if (Math.abs(v) > peakR) peakR = Math.abs(v) }
    assert.ok(peakL > peakR, `left ${peakL} should > right ${peakR}`)
  })

  it('pan full right: right channel louder than left', () => {
    const note  = makeNote('n1', 69, 0, 2)
    const clip  = makeClip('c1', 'tk1', 1, 2, [note])
    const track = makeTrack('tk1', [clip], 0, 1)   // full right pan
    const proj  = makeProject([track], 120, 4)
    const opts  = defaultRenderOptions(proj, 44100)
    const res   = renderProject(proj, opts)
    let peakL = 0, peakR = 0
    for (const v of res.mixLeft)  { if (Math.abs(v) > peakL) peakL = Math.abs(v) }
    for (const v of res.mixRight) { if (Math.abs(v) > peakR) peakR = Math.abs(v) }
    assert.ok(peakR > peakL, `right ${peakR} should > left ${peakL}`)
  })

  it('two clips on same track mix additively', () => {
    const note1 = makeNote('n1', 60, 0, 0.5)
    const note2 = makeNote('n2', 72, 0, 0.5)
    const clip1 = makeClip('c1', 'tk1', 1, 1, [note1])
    const clip2 = makeClip('c2', 'tk1', 2, 1, [note2])
    const track = makeTrack('tk1', [clip1, clip2])
    const proj  = makeProject([track], 120, 4)
    const opts  = defaultRenderOptions(proj, 44100)
    const res   = renderProject(proj, opts)
    // Both clips produce audio — total peak > single clip
    let peak = 0
    for (const v of res.mixLeft) { if (Math.abs(v) > peak) peak = Math.abs(v) }
    assert.ok(peak > 0)
  })

  it('tailSamples appended correctly (tail adds to total length)', () => {
    const proj = makeProject([], 120, 2)
    const tail = 4410   // 100 ms @ 44100
    const opts: ReturnType<typeof defaultRenderOptions> = {
      ...defaultRenderOptions(proj, 44100),
      tailSamples: tail,
    }
    const res = renderProject(proj, opts)
    const expectedBase = barsToSamples(opts.endBar - opts.startBar, 120, 44100)
    assert.equal(res.totalSamples, expectedBase + tail)
  })
})

// ─── measurePeakDbFs ─────────────────────────────────────────────────────────

describe('ProjectRenderer / measurePeakDbFs', () => {
  it('silence → -Infinity', () => {
    const l = new Float32Array(100)
    const r = new Float32Array(100)
    assert.equal(measurePeakDbFs(l, r), -Infinity)
  })

  it('peak of 1.0 → 0 dBFS', () => {
    const l = new Float32Array([0, 1, 0])
    const r = new Float32Array([0, 0, 0])
    assert.ok(Math.abs(measurePeakDbFs(l, r)) < 1e-6)
  })

  it('peak of 0.5 → -6.02 dBFS', () => {
    const l = new Float32Array([0.5])
    const r = new Float32Array([0])
    assert.ok(Math.abs(measurePeakDbFs(l, r) - (-6.0206)) < 0.01)
  })

  it('detects peak from right channel', () => {
    const l = new Float32Array([0.1])
    const r = new Float32Array([0.9])
    assert.ok(Math.abs(measurePeakDbFs(l, r) - 20 * Math.log10(0.9)) < 0.01)
  })
})

// ─── normalizePeak ────────────────────────────────────────────────────────────

describe('ProjectRenderer / normalizePeak', () => {
  it('normalizes peak to targetDb', () => {
    const l = new Float32Array([0, 0.5, 0])
    const r = new Float32Array([0, 0, 0.5])
    normalizePeak(l, r, 0)   // normalize to 0 dBFS
    const peak = measurePeakDbFs(l, r)
    assert.ok(Math.abs(peak) < 0.01, `peak=${peak} should be 0 dBFS`)
  })

  it('silence → returns 1 (no division by zero)', () => {
    const l = new Float32Array(10)
    const r = new Float32Array(10)
    const gain = normalizePeak(l, r, 0)
    assert.equal(gain, 1)
  })

  it('normalize to -3 dBFS', () => {
    const l = new Float32Array([0, 0.2, 0])
    const r = new Float32Array([0, 0, 0.2])
    normalizePeak(l, r, -3)
    const peak = measurePeakDbFs(l, r)
    assert.ok(Math.abs(peak - (-3)) < 0.1, `peak=${peak}`)
  })
})

// ─── resample ─────────────────────────────────────────────────────────────────

describe('ProjectRenderer / resample', () => {
  it('no-op when from === to', () => {
    const input = new Float32Array([1, 2, 3, 4])
    const output = resample(input, 44100, 44100)
    assert.equal(output, input)   // same reference
  })

  it('doubles length when upsampling by 2 (44100 → 88200): 100 samples → 200', () => {
    const input = new Float32Array(100)
    const output = resample(input, 44100, 88200)
    assert.equal(output.length, 200)
  })

  it('halves length when downsampling by 2 (88200 → 44100): 100 samples → 50', () => {
    const input = new Float32Array(100)
    const output = resample(input, 88200, 44100)
    assert.equal(output.length, 50)
  })

  it('DC signal (constant value) preserved through resampling', () => {
    const input = new Float32Array(100).fill(0.5)
    const output = resample(input, 44100, 48000)
    for (let i = 0; i < output.length; i++) {
      assert.ok(Math.abs(output[i]! - 0.5) < 1e-5, `output[${i}]=${output[i]}`)
    }
  })

  it('output length = round(input.length * toRate/fromRate)', () => {
    const input = new Float32Array(44100)
    const output = resample(input, 44100, 48000)
    assert.equal(output.length, 48000)
  })
})

// ─── calcTailSamples ─────────────────────────────────────────────────────────

describe('ProjectRenderer / calcTailSamples', () => {
  it('500 ms tail at 44100 = 22050 samples', () => {
    assert.equal(calcTailSamples(500, 44100), 22050)
  })

  it('0 ms = 0 samples', () => {
    assert.equal(calcTailSamples(0, 44100), 0)
  })

  it('never negative', () => {
    assert.equal(calcTailSamples(-100, 44100), 0)
  })
})

// ─── defaultRenderOptions ────────────────────────────────────────────────────

describe('ProjectRenderer / defaultRenderOptions', () => {
  it('startBar=1, endBar=totalBars+1', () => {
    const proj = makeProject([], 120, 8)
    const opts = defaultRenderOptions(proj, 44100)
    assert.equal(opts.startBar, 1)
    assert.equal(opts.endBar, 9)
  })

  it('tailSamples > 0 (500 ms default)', () => {
    const proj = makeProject([], 120, 4)
    const opts = defaultRenderOptions(proj, 44100)
    assert.ok(opts.tailSamples > 0)
  })

  it('sampleRate matches argument', () => {
    const proj = makeProject([], 120, 4)
    assert.equal(defaultRenderOptions(proj, 48000).sampleRate, 48000)
  })
})
