/**
 * MidiTrackNode — MIDI track with synthesis and event scheduling
 *
 * Handles:
 *   - MIDI event playback from clip notes
 *   - Real-time MIDI input forwarding (when armed)
 *   - Synthesis via OscillatorNode (built-in synth stub)
 *   - Future: AudioWorklet plugin hosting
 *
 * Signal chain:
 *   [Oscillator / AudioWorklet synth] → gainNode → panNode → analyser → destination
 */

import { AudioEngine, dbToGain, gainToDb, clamp } from '../AudioEngine'
import type { ChannelLevel }                       from '../types'
import type { MidiNote }                           from '../../types/project'

// ─── MIDI event types ─────────────────────────────────────────────────────────

export interface MidiNoteOnEvent  { type: 'noteon';  pitch: number; velocity: number; time: number }
export interface MidiNoteOffEvent { type: 'noteoff'; pitch: number; time: number }
export type MidiEvent = MidiNoteOnEvent | MidiNoteOffEvent

// ─── Voice (simple oscillator voice) ─────────────────────────────────────────

interface Voice {
  pitch:     number
  osc:       OscillatorNode
  envGain:   GainNode
}

// ─── MidiTrackNode ────────────────────────────────────────────────────────────

export class MidiTrackNode {
  readonly id:           string
  readonly name:         string

  readonly gainNode:     GainNode
  readonly panNode:      StereoPannerNode
  readonly analyserNode: AnalyserNode
  /** Connect synthesized audio here (AudioWorklet or internal synth). */
  readonly synthInput:   GainNode

  private readonly engine: AudioEngine
  private _gainDb    = 0
  private _pan       = 0
  private _muted     = false
  private _soloed    = false
  private _soloMuted = false
  private _armed     = false

  // Voice polyphony (simple built-in synth)
  private _voices:    Map<number, Voice> = new Map()
  private _waveform:  OscillatorType     = 'sawtooth'
  private _attack     = 0.005
  private _release    = 0.1

  // Scheduled note-offs for clip playback
  private _noteOffTimeouts: Set<ReturnType<typeof setTimeout>> = new Set()

  private _analyserBuf: Float32Array<ArrayBuffer>
  private _peakHold    = 0
  private _peakTime    = 0

  constructor(id: string, name: string, engine: AudioEngine, destination: AudioNode) {
    this.id     = id
    this.name   = name
    this.engine = engine
    const ctx   = engine.ctx

    this.synthInput   = ctx.createGain()
    this.gainNode     = ctx.createGain()
    this.panNode      = ctx.createStereoPanner()
    this.analyserNode = ctx.createAnalyser()

    this.analyserNode.fftSize               = 256
    this.analyserNode.smoothingTimeConstant = 0

    this.synthInput.connect(this.gainNode)
    this.gainNode.connect(this.panNode)
    this.panNode.connect(this.analyserNode)
    this.analyserNode.connect(destination)

    this._analyserBuf = new Float32Array(this.analyserNode.fftSize) as Float32Array<ArrayBuffer>
  }

  // ── Channel strip ─────────────────────────────────────────────────────────

  setGain(db: number): void { this._gainDb = clamp(db, -60, 12); this._applyGain() }
  setPan(pan: number): void {
    this._pan = clamp(pan, -1, 1)
    this.panNode.pan.setTargetAtTime(this._pan, this.engine.ctx.currentTime, 0.005)
  }
  setMuted(m: boolean): void     { this._muted     = m;  this._applyGain() }
  setSoloed(s: boolean): void    { this._soloed     = s }
  setSoloMuted(sm: boolean): void{ this._soloMuted  = sm; this._applyGain() }
  setArmed(a: boolean): void     { this._armed      = a }

  get gainDb():  number  { return this._gainDb }
  get pan():     number  { return this._pan }
  get muted():   boolean { return this._muted }
  get soloed():  boolean { return this._soloed }
  get armed():   boolean { return this._armed }

  // ── Synthesis settings ────────────────────────────────────────────────────

  setWaveform(wf: OscillatorType): void { this._waveform = wf }
  setAttack(sec: number): void          { this._attack   = Math.max(0.001, sec) }
  setRelease(sec: number): void         { this._release  = Math.max(0.01,  sec) }

  // ── Real-time MIDI ────────────────────────────────────────────────────────

  noteOn(pitch: number, velocity: number): void {
    this.noteOff(pitch)  // kill any existing voice on this pitch

    const ctx       = this.engine.ctx
    const freq      = 440 * Math.pow(2, (pitch - 69) / 12)
    const ampTarget = (velocity / 127) * 0.6

    const osc      = ctx.createOscillator()
    const envGain  = ctx.createGain()

    osc.type      = this._waveform
    osc.frequency.value = freq
    envGain.gain.value  = 0

    osc.connect(envGain)
    envGain.connect(this.synthInput)
    osc.start()

    envGain.gain.setTargetAtTime(ampTarget, ctx.currentTime, this._attack)

    this._voices.set(pitch, { pitch, osc, envGain })
  }

  noteOff(pitch: number): void {
    const voice = this._voices.get(pitch)
    if (!voice) return
    const ctx   = this.engine.ctx
    voice.envGain.gain.setTargetAtTime(0, ctx.currentTime, this._release * 0.4)
    const stopAt = ctx.currentTime + this._release * 2
    voice.osc.stop(stopAt)
    voice.osc.onended = () => {
      voice.osc.disconnect()
      voice.envGain.disconnect()
    }
    this._voices.delete(pitch)
  }

  allNotesOff(): void {
    for (const pitch of [...this._voices.keys()]) this.noteOff(pitch)
    for (const t of this._noteOffTimeouts) clearTimeout(t)
    this._noteOffTimeouts.clear()
  }

  // ── Clip scheduling ───────────────────────────────────────────────────────

  /**
   * Schedule a set of MIDI notes for playback.
   * All times are in seconds relative to AudioContext.currentTime.
   */
  scheduleNotes(notes: MidiNote[], clipStartContextTime: number, bpm: number): void {
    const spb = 60 / bpm

    for (const note of notes) {
      const onTime  = clipStartContextTime + note.startBeat * spb
      const offTime = onTime + note.lengthBeats * spb
      const now     = this.engine.ctx.currentTime

      if (offTime < now) continue  // already passed

      const onDelay  = Math.max(0, (onTime  - now) * 1000)
      const offDelay = Math.max(0, (offTime - now) * 1000)

      const tOn = setTimeout(() => {
        this.noteOn(note.pitch, note.velocity)
        this._noteOffTimeouts.delete(tOn)
      }, onDelay)

      const tOff = setTimeout(() => {
        this.noteOff(note.pitch)
        this._noteOffTimeouts.delete(tOff)
      }, offDelay)

      this._noteOffTimeouts.add(tOn)
      this._noteOffTimeouts.add(tOff)
    }
  }

  // ── Metering ─────────────────────────────────────────────────────────────

  getLevel(): ChannelLevel {
    this.analyserNode.getFloatTimeDomainData(this._analyserBuf)
    let sumSq = 0, peak = 0
    for (let i = 0; i < this._analyserBuf.length; i++) {
      const v = Math.abs(this._analyserBuf[i])
      sumSq += v * v
      if (v > peak) peak = v
    }
    const rms = Math.sqrt(sumSq / this._analyserBuf.length)
    const now = performance.now()
    if (peak >= this._peakHold) { this._peakHold = peak; this._peakTime = now }
    else if (now - this._peakTime > 1500) { this._peakHold = Math.max(this._peakHold - 0.005, peak) }
    return { rms, peak: this._peakHold, dbfs: gainToDb(rms) }
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private _applyGain(): void {
    const silent = this._muted || this._soloMuted
    const target = silent ? 0 : dbToGain(this._gainDb)
    this.gainNode.gain.setTargetAtTime(target, this.engine.ctx.currentTime, 0.005)
  }

  dispose(): void {
    this.allNotesOff()
    this.synthInput.disconnect()
    this.gainNode.disconnect()
    this.panNode.disconnect()
    this.analyserNode.disconnect()
  }
}
