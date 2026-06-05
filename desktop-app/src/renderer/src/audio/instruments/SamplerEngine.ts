import { clamp } from '../AudioEngine'

export interface SamplerZone {
  id:          string
  name:        string
  buffer:      AudioBuffer | null   // null = unloaded
  rootPitch:   number              // MIDI pitch of the sample as recorded
  pitchLo:     number              // lowest MIDI pitch this zone covers (0–127)
  pitchHi:     number              // highest MIDI pitch this zone covers (0–127)
  velLo:       number              // 0–127
  velHi:       number              // 0–127
  loopEnabled: boolean
  loopStart:   number              // sample frames
  loopEnd:     number              // sample frames (0 = end of buffer)
  tune:        number              // fine-tune cents (-100 to +100)
  gain:        number              // zone gain 0–2
}

export interface SamplerConfig {
  attack:    number   // 0.001–5s
  decay:     number   // 0.001–5s
  sustain:   number   // 0.0–1.0
  release:   number   // 0.001–10s
  polyphony: number   // 1–32
  ampVelSensitivity: number   // 0=ignore velocity, 1=full tracking
}

export const DEFAULT_SAMPLER_CONFIG: SamplerConfig = {
  attack:    0.001,
  decay:     0.01,
  sustain:   1.0,
  release:   0.3,
  polyphony: 16,
  ampVelSensitivity: 0.8,
}

interface SamplerVoice {
  pitch:   number
  src:     AudioBufferSourceNode
  ampEnv:  GainNode
  startedAt: number
}

export class SamplerEngine {
  readonly output: GainNode   // connect to MidiTrackNode.synthInput or AudioTrackNode.input

  private _ctx:    AudioContext
  private _zones:  Map<string, SamplerZone> = new Map()
  private _voices: Map<number, SamplerVoice[]> = new Map()  // pitch → active voices
  private _config: SamplerConfig = { ...DEFAULT_SAMPLER_CONFIG }

  constructor(ctx: AudioContext) {
    this._ctx   = ctx
    this.output = ctx.createGain()
    this.output.gain.value = 1
  }

  // ── Zone management ───────────────────────────────────────────────────────

  addZone(opts: Omit<SamplerZone, 'id'>): string {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2)
    this._zones.set(id, { id, ...opts })
    return id
  }

  setZoneBuffer(zoneId: string, buffer: AudioBuffer): void {
    const z = this._zones.get(zoneId)
    if (z) { this._zones.set(zoneId, { ...z, buffer }) }
  }

  removeZone(id: string): void { this._zones.delete(id) }

  listZones(): SamplerZone[] { return [...this._zones.values()] }

  // ── Playback ─────────────────────────────────────────────────────────────

  noteOn(pitch: number, velocity: number): void {
    const ctx  = this._ctx
    const p    = this._config
    const now  = ctx.currentTime

    // Enforce polyphony (count all active voices)
    const totalVoices = [...this._voices.values()].reduce((s, v) => s + v.length, 0)
    if (totalVoices >= p.polyphony) {
      // Steal oldest voice (lowest startedAt across all pitches)
      let oldest: { pitch: number; idx: number; time: number } | null = null
      for (const [vPitch, arr] of this._voices) {
        arr.forEach((v, idx) => {
          if (!oldest || v.startedAt < oldest.time) oldest = { pitch: vPitch, idx, time: v.startedAt }
        })
      }
      if (oldest) {
        const o = oldest as { pitch: number; idx: number; time: number }
        const arr = this._voices.get(o.pitch)
        if (arr) {
          this._releaseVoice(arr[o.idx]!, 0.01)
          arr.splice(o.idx, 1)
          if (arr.length === 0) this._voices.delete(o.pitch)
        }
      }
    }

    // Find matching zone
    const zone = this._findZone(pitch, velocity)
    if (!zone || !zone.buffer) return

    // Compute playback rate: pitch shift from rootPitch to desired pitch
    const semitones = (pitch - zone.rootPitch)
    const rate      = Math.pow(2, (semitones + zone.tune / 100) / 12)

    // Create source
    const src = ctx.createBufferSource()
    src.buffer       = zone.buffer
    src.playbackRate.value = clamp(rate, 0.01, 4)

    if (zone.loopEnabled && zone.loopEnd > 0) {
      src.loop           = true
      src.loopStart      = zone.loopStart / zone.buffer.sampleRate
      src.loopEnd        = zone.loopEnd   / zone.buffer.sampleRate
    }

    // Amp envelope + velocity
    const velAmp = 1 - p.ampVelSensitivity * (1 - velocity / 127)
    const ampEnv = ctx.createGain()
    ampEnv.gain.setValueAtTime(0, now)
    ampEnv.gain.linearRampToValueAtTime(velAmp * zone.gain, now + p.attack)
    ampEnv.gain.linearRampToValueAtTime(velAmp * zone.gain * p.sustain, now + p.attack + p.decay)

    src.connect(ampEnv)
    ampEnv.connect(this.output)
    src.start(now)

    src.onended = () => {
      src.disconnect()
      ampEnv.disconnect()
    }

    const voice: SamplerVoice = { pitch, src, ampEnv, startedAt: now }
    const arr = this._voices.get(pitch) ?? []
    arr.push(voice)
    this._voices.set(pitch, arr)
  }

  noteOff(pitch: number): void {
    const arr = this._voices.get(pitch)
    if (!arr || arr.length === 0) return
    for (const v of arr) this._releaseVoice(v, this._config.release)
    this._voices.delete(pitch)
  }

  allNotesOff(): void {
    for (const arr of this._voices.values()) {
      for (const v of arr) this._releaseVoice(v, 0.05)
    }
    this._voices.clear()
  }

  private _releaseVoice(voice: SamplerVoice, release: number): void {
    const now = this._ctx.currentTime
    voice.ampEnv.gain.cancelScheduledValues(now)
    voice.ampEnv.gain.setValueAtTime(voice.ampEnv.gain.value, now)
    voice.ampEnv.gain.linearRampToValueAtTime(0, now + release)
    try { voice.src.stop(now + release + 0.05) } catch { /* already stopped */ }
  }

  private _findZone(pitch: number, velocity: number): SamplerZone | null {
    // First matching zone wins (sorted by specificity = narrower pitch range first)
    const candidates = [...this._zones.values()].filter(z =>
      pitch >= z.pitchLo && pitch <= z.pitchHi &&
      velocity >= z.velLo && velocity <= z.velHi
    )
    if (candidates.length === 0) return null
    candidates.sort((a, b) => (a.pitchHi - a.pitchLo) - (b.pitchHi - b.pitchLo))
    return candidates[0] ?? null
  }

  setConfig(cfg: Partial<SamplerConfig>): void {
    this._config = { ...this._config, ...cfg }
  }

  getConfig(): SamplerConfig { return { ...this._config } }

  dispose(): void {
    this.allNotesOff()
    this.output.disconnect()
  }
}
