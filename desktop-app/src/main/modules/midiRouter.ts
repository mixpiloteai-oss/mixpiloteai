// ─── MIDI Router ──────────────────────────────────────────────────────────────
// Manages MIDI input device connections and routes events to plugin instances.

import { EventEmitter } from 'events'
import { pluginAudioBridge } from './pluginAudioBridge'

export interface MidiInputDevice {
  id: string
  name: string
  isVirtual: boolean
}

export interface MidiMessage {
  channel: number
  type: 'note_on' | 'note_off' | 'control_change' | 'program_change' | 'pitch_bend' | 'aftertouch'
  note: number
  velocity: number
  control: number
  value: number
  pitchBend: number
  timestamp: number
  trackId: string
}

class MidiRouter extends EventEmitter {
  private devices: MidiInputDevice[] = []
  /** trackId → deviceId */
  private trackBindings = new Map<string, string>()

  /** List available MIDI input devices. */
  getDevices(): MidiInputDevice[] {
    return [
      { id: 'virtual', name: 'Virtual MIDI Input', isVirtual: true },
      ...this.devices,
    ]
  }

  /** Bind a MIDI input device to a track. */
  bindDeviceToTrack(deviceId: string, trackId: string): void {
    this.trackBindings.set(trackId, deviceId)
  }

  unbindTrack(trackId: string): void {
    this.trackBindings.delete(trackId)
  }

  getBinding(trackId: string): string | undefined {
    return this.trackBindings.get(trackId)
  }

  /** Dispatch an incoming MIDI message to the routing engine. */
  dispatch(msg: MidiMessage): void {
    this.emit('midi-message', msg)

    pluginAudioBridge.routeMidi(
      msg.trackId,
      msg.type,
      msg.channel,
      msg.note,
      msg.velocity,
      msg.control,
      msg.value,
      msg.pitchBend,
      0, // sample offset within current buffer
    )
  }

  /** Inject a MIDI note-on event programmatically (e.g. from piano roll). */
  injectNoteOn(trackId: string, note: number, velocity: number, channel = 1): void {
    this.dispatch({
      channel, type: 'note_on', note, velocity,
      control: 0, value: 0, pitchBend: 0,
      timestamp: Date.now(), trackId,
    })
  }

  injectNoteOff(trackId: string, note: number, channel = 1): void {
    this.dispatch({
      channel, type: 'note_off', note, velocity: 0,
      control: 0, value: 0, pitchBend: 0,
      timestamp: Date.now(), trackId,
    })
  }

  injectCC(trackId: string, control: number, value: number, channel = 1): void {
    this.dispatch({
      channel, type: 'control_change', note: 0, velocity: 0,
      control, value, pitchBend: 0,
      timestamp: Date.now(), trackId,
    })
  }
}

export const midiRouter = new MidiRouter()
