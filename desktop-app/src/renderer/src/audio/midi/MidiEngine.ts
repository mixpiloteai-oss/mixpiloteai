import type { PRNote } from '../../components/piano-roll/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MidiEvent {
  type:     'note-on' | 'note-off' | 'cc' | 'pitch-bend'
  channel:  number
  pitch?:   number
  velocity?: number
  cc?:      number
  value?:   number
  bend?:    number
  time:     number  // AudioContext seconds
}

export interface MidiOutputPort {
  id:   string
  name: string
}

interface ActiveNote {
  pitch:   number
  channel: number
  port:    MIDIOutput | null
}

// ─── MidiEngine ───────────────────────────────────────────────────────────────

export class MidiEngine {
  private audioCtx:    AudioContext | null = null
  private midiAccess:  MIDIAccess   | null = null
  private activeNotes: Map<string, ActiveNote> = new Map()
  private outputPortId: string | null = null
  private bpm           = 120
  private scheduledIds: Set<number>  = new Set()

  async init(): Promise<void> {
    if (!this.audioCtx) {
      this.audioCtx = new AudioContext({ latencyHint: 'interactive' })
    }
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume()
    }
    if (typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator) {
      try {
        this.midiAccess = await navigator.requestMIDIAccess()
      } catch {
        // WebMIDI unavailable — audio preview still works
      }
    }
  }

  getOutputPorts(): MidiOutputPort[] {
    if (!this.midiAccess) return []
    const ports: MidiOutputPort[] = []
    this.midiAccess.outputs.forEach(o => ports.push({ id: o.id, name: o.name ?? o.id }))
    return ports
  }

  setOutputPort(id: string | null): void {
    this.outputPortId = id
  }

  setBpm(bpm: number): void {
    this.bpm = bpm
  }

  // ── Immediate send ────────────────────────────────────────────────────────

  noteOn(pitch: number, velocity: number, channel: number): void {
    this._sendMidi([0x90 | (channel & 0xF), pitch & 0x7F, velocity & 0x7F])
    this._previewOscillator(pitch, velocity)
    const key = `${channel}-${pitch}`
    const port = this._getPort()
    this.activeNotes.set(key, { pitch, channel, port })
  }

  noteOff(pitch: number, channel: number): void {
    this._sendMidi([0x80 | (channel & 0xF), pitch & 0x7F, 0])
    this.activeNotes.delete(`${channel}-${pitch}`)
  }

  sendCC(cc: number, value: number, channel: number): void {
    this._sendMidi([0xB0 | (channel & 0xF), cc & 0x7F, value & 0x7F])
  }

  // ── Scheduled playback ────────────────────────────────────────────────────

  scheduleNotes(notes: PRNote[], startBeat: number, audioTime: number): void {
    const secondsPerBeat = 60 / this.bpm
    for (const note of notes) {
      const noteOnTime  = audioTime + (note.startBeat - startBeat) * secondsPerBeat
      const noteOffTime = noteOnTime + note.lengthBeats * secondsPerBeat
      const channel     = note.channel ?? 0

      const onDelay  = Math.max(0, noteOnTime  - (this.audioCtx?.currentTime ?? 0)) * 1000
      const offDelay = Math.max(0, noteOffTime - (this.audioCtx?.currentTime ?? 0)) * 1000

      const onId = window.setTimeout(() => {
        this.noteOn(note.pitch, note.velocity, channel)
        this.scheduledIds.delete(onId)
      }, onDelay)

      const offId = window.setTimeout(() => {
        this.noteOff(note.pitch, channel)
        this.scheduledIds.delete(offId)
      }, offDelay)

      this.scheduledIds.add(onId)
      this.scheduledIds.add(offId)
    }
  }

  cancelScheduled(): void {
    for (const id of this.scheduledIds) window.clearTimeout(id)
    this.scheduledIds.clear()
    // send note-off for all active notes
    this.activeNotes.forEach(n => this.noteOff(n.pitch, n.channel))
    this.activeNotes.clear()
  }

  panic(): void {
    for (let ch = 0; ch < 16; ch++) {
      for (let p = 0; p < 128; p++) {
        this._sendMidi([0x80 | ch, p, 0])
      }
    }
    this.activeNotes.clear()
  }

  destroy(): void {
    this.cancelScheduled()
    this.panic()
    this.audioCtx?.close()
    this.audioCtx = null
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private _getPort(): MIDIOutput | null {
    if (!this.midiAccess || !this.outputPortId) return null
    return this.midiAccess.outputs.get(this.outputPortId) ?? null
  }

  private _sendMidi(bytes: number[]): void {
    const port = this._getPort()
    if (port) {
      try { port.send(bytes) } catch { /* ignore stale port */ }
    }
  }

  private _previewOscillator(pitch: number, velocity: number): void {
    const ctx = this.audioCtx
    if (!ctx) return
    const freq = 440 * Math.pow(2, (pitch - 69) / 12)
    const now  = ctx.currentTime

    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type      = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime((velocity / 127) * 0.25, now + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.15)
    osc.onended = () => { gain.disconnect(); osc.disconnect() }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _instance: MidiEngine | null = null

export function getMidiEngine(): MidiEngine {
  if (!_instance) _instance = new MidiEngine()
  return _instance
}
