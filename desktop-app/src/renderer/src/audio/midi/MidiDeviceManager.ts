import { detectProfile } from './HardwareProfiles'
import type { HardwareProfile } from './HardwareProfiles'

// ─── Public types ─────────────────────────────────────────────────────────────

export interface MidiDevice {
  id:      string
  name:    string
  type:    'input' | 'output'
  state:   'connected' | 'disconnected'
  profile: HardwareProfile
  rawPort: MIDIPort
}

export type MidiDeviceListener  = (devices: MidiDevice[]) => void
export type MidiMessageListener = (deviceId: string, data: Uint8Array, timestamp: number) => void

// ─── MidiDeviceManager ────────────────────────────────────────────────────────

export class MidiDeviceManager {
  private access:           MIDIAccess | null           = null
  private devices:          Map<string, MidiDevice>     = new Map()
  private deviceListeners:  Set<MidiDeviceListener>     = new Set()
  private messageListeners: Set<MidiMessageListener>    = new Set()
  private initialized:      boolean                     = false

  // ── Initialisation ──────────────────────────────────────────────────────────

  async init(): Promise<boolean> {
    if (this.initialized) return this.access !== null

    if (typeof navigator === 'undefined' || !('requestMIDIAccess' in navigator)) {
      this.initialized = true
      return false
    }

    try {
      this.access = await navigator.requestMIDIAccess({ sysex: true })
      this._buildDevices()

      this.access.onstatechange = () => {
        this._buildDevices()
        this._notifyDeviceListeners()
      }

      this.initialized = true
      return true
    } catch {
      // WebMIDI unavailable or user denied permission
      this.initialized = true
      return false
    }
  }

  // ── Device queries ──────────────────────────────────────────────────────────

  getInputDevices(): MidiDevice[] {
    return [...this.devices.values()].filter(d => d.type === 'input')
  }

  getOutputDevices(): MidiDevice[] {
    return [...this.devices.values()].filter(d => d.type === 'output')
  }

  getAllDevices(): MidiDevice[] {
    return [...this.devices.values()]
  }

  // ── Send helpers ────────────────────────────────────────────────────────────

  sendToDevice(deviceId: string, bytes: number[]): void {
    if (!this.access) return

    // deviceId is "output-<port.id>" — strip the prefix to get the raw port id
    const portId = deviceId.startsWith('output-') ? deviceId.slice(7) : deviceId
    const port   = this.access.outputs.get(portId)
    if (!port) return

    try {
      port.send(bytes)
    } catch {
      // stale port — ignore
    }
  }

  sendSysex(deviceId: string, bytes: number[]): void {
    const hasPrefix = bytes[0] === 0xF0
    const hasSuffix = bytes[bytes.length - 1] === 0xF7

    const payload = [
      ...(hasPrefix ? [] : [0xF0]),
      ...bytes,
      ...(hasSuffix ? [] : [0xF7]),
    ]

    this.sendToDevice(deviceId, payload)
  }

  // ── Listener subscriptions ──────────────────────────────────────────────────

  onDeviceChange(listener: MidiDeviceListener): () => void {
    this.deviceListeners.add(listener)
    return () => { this.deviceListeners.delete(listener) }
  }

  onMessage(listener: MidiMessageListener): () => void {
    this.messageListeners.add(listener)
    return () => { this.messageListeners.delete(listener) }
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────────

  destroy(): void {
    this.deviceListeners.clear()
    this.messageListeners.clear()

    if (this.access) {
      this.access.onstatechange = null

      // Detach all input message handlers
      this.access.inputs.forEach(port => {
        port.onmidimessage = null
      })
    }

    this.devices.clear()
    this.access      = null
    this.initialized = false
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private _buildDevices(): void {
    if (!this.access) return

    this.devices.clear()

    this.access.inputs.forEach(port => {
      const id:      string          = `input-${port.id}`
      const name:    string          = port.name ?? port.id
      const profile: HardwareProfile = detectProfile(name)

      const device: MidiDevice = {
        id,
        name,
        type:    'input',
        state:   port.state === 'connected' ? 'connected' : 'disconnected',
        profile,
        rawPort: port,
      }

      this.devices.set(id, device)

      // Attach MIDI message handler
      port.onmidimessage = (event: MIDIMessageEvent) => {
        if (!(event.data instanceof Uint8Array)) return
        const data: Uint8Array = event.data
        this.messageListeners.forEach(listener => {
          listener(id, data, event.timeStamp)
        })
      }
    })

    this.access.outputs.forEach(port => {
      const id:      string          = `output-${port.id}`
      const name:    string          = port.name ?? port.id
      const profile: HardwareProfile = detectProfile(name)

      const device: MidiDevice = {
        id,
        name,
        type:    'output',
        state:   port.state === 'connected' ? 'connected' : 'disconnected',
        profile,
        rawPort: port,
      }

      this.devices.set(id, device)
    })
  }

  private _notifyDeviceListeners(): void {
    const all = this.getAllDevices()
    this.deviceListeners.forEach(listener => listener(all))
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _instance: MidiDeviceManager | null = null

export function getMidiDeviceManager(): MidiDeviceManager {
  if (!_instance) _instance = new MidiDeviceManager()
  return _instance
}
