import { clamp } from '../AudioEngine'

export type FilterType = 'lowpass' | 'highpass' | 'bandpass'
export type LfoTarget  = 'pitch' | 'filter' | 'amp'

export interface SynthParams {
  // Oscillators
  osc1Wave:        OscillatorType   // 'sine'|'square'|'sawtooth'|'triangle'
  osc1Level:       number           // 0.0–1.0
  osc2Wave:        OscillatorType
  osc2Level:       number           // 0.0–1.0
  osc2Detune:      number           // cents, -100 to +100
  osc2Semitones:   number           // integer semitones, -24 to +24

  // Amp ADSR (seconds)
  attack:          number           // 0.001–10
  decay:           number           // 0.001–10
  sustain:         number           // 0.0–1.0
  release:         number           // 0.001–10

  // Filter
  filterType:      FilterType
  filterCutoff:    number           // Hz 20–20000
  filterResonance: number           // Q 0.1–20

  // Filter ADSR envelope
  filterEnvAmount: number           // octaves, -4 to +4 (0 = no envelope)
  filterAttack:    number           // 0.001–10
  filterDecay:     number           // 0.001–10
  filterSustain:   number           // 0.0–1.0 (as fraction of filterEnvAmount)
  filterRelease:   number           // 0.001–10

  // LFO
  lfoRate:         number           // Hz 0.1–20
  lfoAmount:       number           // 0.0–1.0
  lfoTarget:       LfoTarget

  // Master
  volume:          number           // 0.0–1.0
  polyphony:       number           // 1–16
}

export const DEFAULT_SYNTH_PARAMS: SynthParams = {
  osc1Wave:        'sawtooth',
  osc1Level:       0.8,
  osc2Wave:        'sawtooth',
  osc2Level:       0.3,
  osc2Detune:      7,
  osc2Semitones:   0,
  attack:          0.005,
  decay:           0.1,
  sustain:         0.7,
  release:         0.2,
  filterType:      'lowpass',
  filterCutoff:    4000,
  filterResonance: 1.2,
  filterEnvAmount: 2.0,
  filterAttack:    0.01,
  filterDecay:     0.3,
  filterSustain:   0.2,
  filterRelease:   0.4,
  lfoRate:         3.0,
  lfoAmount:       0,
  lfoTarget:       'filter',
  volume:          0.8,
  polyphony:       8,
}

interface SynthVoice {
  pitch:    number
  osc1:     OscillatorNode
  osc2:     OscillatorNode
  osc2Gain: GainNode
  filter:   BiquadFilterNode
  filterEnvGain: GainNode  // not used directly — filter cutoff modulated via AudioParam
  ampEnv:   GainNode
  lfoGain:  GainNode       // LFO → target
  startedAt: number        // ctx.currentTime when noteOn fired
}

export class SubtractiveSynth {
  readonly output: GainNode   // connect to AudioTrackNode.input or MidiTrackNode.synthInput

  private _ctx:    AudioContext
  private _params: SynthParams = { ...DEFAULT_SYNTH_PARAMS }
  private _voices: Map<number, SynthVoice> = new Map()
  private _lfo:    OscillatorNode
  private _lfoAmp: GainNode

  constructor(ctx: AudioContext) {
    this._ctx = ctx
    this.output = ctx.createGain()
    this.output.gain.value = this._params.volume

    // Master LFO (shared across all voices)
    this._lfo    = ctx.createOscillator()
    this._lfoAmp = ctx.createGain()
    this._lfo.type = 'sine'
    this._lfo.frequency.value = this._params.lfoRate
    this._lfoAmp.gain.value   = this._params.lfoAmount
    this._lfo.connect(this._lfoAmp)
    this._lfo.start()
  }

  noteOn(pitch: number, velocity: number): void {
    const ctx = this._ctx
    const p   = this._params
    const now = ctx.currentTime

    // Polyphony: steal oldest voice if at limit
    if (this._voices.size >= p.polyphony) {
      const oldest = [...this._voices.entries()].sort((a, b) => a[1].startedAt - b[1].startedAt)[0]
      if (oldest) { this._releaseVoice(oldest[1]); this._voices.delete(oldest[0]) }
    }

    const freq = 440 * Math.pow(2, (pitch - 69) / 12)

    // OSC 1
    const osc1 = ctx.createOscillator()
    osc1.type  = p.osc1Wave
    osc1.frequency.value = freq

    // OSC 2
    const osc2     = ctx.createOscillator()
    osc2.type      = p.osc2Wave
    osc2.frequency.value = freq * Math.pow(2, (p.osc2Semitones + p.osc2Detune / 100) / 12)
    const osc2Gain = ctx.createGain()
    osc2Gain.gain.value  = p.osc2Level

    // Mix oscillators
    const oscMix = ctx.createGain()
    oscMix.gain.value = p.osc1Level
    osc1.connect(oscMix)
    osc2.connect(osc2Gain)
    osc2Gain.connect(oscMix)

    // Filter
    const filter           = ctx.createBiquadFilter()
    filter.type            = p.filterType
    filter.frequency.value = Math.min(p.filterCutoff, ctx.sampleRate / 2 - 1)
    filter.Q.value         = p.filterResonance

    // Filter envelope: schedule cutoff AudioParam
    const envPeak = p.filterCutoff * Math.pow(2, p.filterEnvAmount)
    filter.frequency.cancelScheduledValues(now)
    filter.frequency.setValueAtTime(p.filterCutoff, now)
    filter.frequency.linearRampToValueAtTime(clamp(envPeak, 20, ctx.sampleRate / 2), now + p.filterAttack)
    filter.frequency.linearRampToValueAtTime(
      clamp(p.filterCutoff + (envPeak - p.filterCutoff) * p.filterSustain, 20, ctx.sampleRate / 2),
      now + p.filterAttack + p.filterDecay
    )

    // Amp envelope
    const ampEnv = ctx.createGain()
    const velScale = 0.2 + (velocity / 127) * 0.8
    ampEnv.gain.setValueAtTime(0, now)
    ampEnv.gain.linearRampToValueAtTime(velScale, now + p.attack)
    ampEnv.gain.linearRampToValueAtTime(p.sustain * velScale, now + p.attack + p.decay)

    // LFO routing: lfoAmp → target AudioParam
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = p.lfoAmount
    if (p.lfoAmount > 0) {
      this._lfoAmp.connect(lfoGain)
      if (p.lfoTarget === 'filter') {
        lfoGain.gain.value = p.lfoAmount * 500   // Hz modulation depth
        lfoGain.connect(filter.frequency)
      } else if (p.lfoTarget === 'amp') {
        lfoGain.gain.value = p.lfoAmount * 0.3
        lfoGain.connect(ampEnv.gain)
      } else {
        // pitch: small semitone variation (cents)
        lfoGain.gain.value = p.lfoAmount * 50
        lfoGain.connect(osc1.detune)
        lfoGain.connect(osc2.detune)
      }
    }

    // Wire chain: oscMix → filter → ampEnv → output
    oscMix.connect(filter)
    filter.connect(ampEnv)
    ampEnv.connect(this.output)

    osc1.start(now)
    osc2.start(now)

    const voice: SynthVoice = {
      pitch, osc1, osc2, osc2Gain, filter, filterEnvGain: ctx.createGain(), ampEnv, lfoGain, startedAt: now
    }
    this._voices.set(pitch, voice)
  }

  noteOff(pitch: number): void {
    const voice = this._voices.get(pitch)
    if (!voice) return
    this._releaseVoice(voice)
    this._voices.delete(pitch)
  }

  private _releaseVoice(voice: SynthVoice): void {
    const now = this._ctx.currentTime
    const p   = this._params

    // Amp release
    voice.ampEnv.gain.cancelScheduledValues(now)
    voice.ampEnv.gain.setValueAtTime(voice.ampEnv.gain.value, now)
    voice.ampEnv.gain.linearRampToValueAtTime(0, now + p.release)

    // Filter release
    voice.filter.frequency.cancelScheduledValues(now)
    voice.filter.frequency.setValueAtTime(voice.filter.frequency.value, now)
    voice.filter.frequency.linearRampToValueAtTime(p.filterCutoff, now + p.filterRelease)

    const stopAt = now + Math.max(p.release, p.filterRelease) + 0.05
    try { voice.osc1.stop(stopAt) } catch { /* already stopped */ }
    try { voice.osc2.stop(stopAt) } catch { /* already stopped */ }
  }

  allNotesOff(): void {
    for (const voice of this._voices.values()) this._releaseVoice(voice)
    this._voices.clear()
  }

  setParams(patch: Partial<SynthParams>): void {
    this._params = { ...this._params, ...patch }
    // Apply live-updatable params immediately
    this.output.gain.value        = this._params.volume
    this._lfo.frequency.value     = this._params.lfoRate
    this._lfoAmp.gain.value       = this._params.lfoAmount
  }

  getParams(): SynthParams { return { ...this._params } }

  dispose(): void {
    this.allNotesOff()
    try { this._lfo.stop() } catch { /* already stopped */ }
    this._lfo.disconnect()
    this._lfoAmp.disconnect()
    this.output.disconnect()
  }
}
