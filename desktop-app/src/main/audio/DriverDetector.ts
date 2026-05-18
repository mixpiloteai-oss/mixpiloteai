/**
 * DriverDetector — detects available audio APIs on the host OS
 *
 * Returns a ranked list of drivers available for the current platform:
 *   Windows:  ASIO (preferred) > WASAPI > DirectSound
 *   macOS:    CoreAudio
 *   Linux:    JACK > ALSA > PulseAudio
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import os from 'node:os'

const exec = promisify(execFile)

export interface DriverInfo {
  id:          string
  name:        string
  platform:    NodeJS.Platform
  available:   boolean
  preferred:   boolean
  latencyMs:   number   // typical best-case latency
  description: string
}

export interface AudioDeviceInfo {
  id:        string
  name:      string
  channels:  number
  sampleRates: number[]
  isDefault: boolean
  direction: 'input' | 'output'
}

const DRIVER_DEFS: Record<string, Omit<DriverInfo, 'available'>> = {
  asio: {
    id: 'asio', name: 'ASIO', platform: 'win32', preferred: true,
    latencyMs: 2, description: 'Professional low-latency Windows driver (Steinberg ASIO)',
  },
  wasapi: {
    id: 'wasapi', name: 'WASAPI', platform: 'win32', preferred: false,
    latencyMs: 10, description: 'Windows Audio Session API — exclusive mode for low latency',
  },
  directsound: {
    id: 'directsound', name: 'DirectSound', platform: 'win32', preferred: false,
    latencyMs: 40, description: 'Legacy Windows audio driver',
  },
  coreaudio: {
    id: 'coreaudio', name: 'CoreAudio', platform: 'darwin', preferred: true,
    latencyMs: 5, description: 'macOS system audio framework',
  },
  jack: {
    id: 'jack', name: 'JACK', platform: 'linux', preferred: true,
    latencyMs: 2, description: 'Professional Linux audio server',
  },
  alsa: {
    id: 'alsa', name: 'ALSA', platform: 'linux', preferred: false,
    latencyMs: 10, description: 'Advanced Linux Sound Architecture',
  },
  pulseaudio: {
    id: 'pulseaudio', name: 'PulseAudio', platform: 'linux', preferred: false,
    latencyMs: 30, description: 'Linux general-purpose audio server',
  },
}

export class DriverDetector {
  private readonly platform: NodeJS.Platform = os.platform()

  async detectDrivers(): Promise<DriverInfo[]> {
    const drivers: DriverInfo[] = []

    for (const def of Object.values(DRIVER_DEFS)) {
      if (def.platform !== this.platform) continue
      const available = await this._checkAvailable(def.id)
      drivers.push({ ...def, available })
    }

    // Sort: available first, then by preferred
    return drivers.sort((a, b) => {
      if (a.available !== b.available) return a.available ? -1 : 1
      if (a.preferred !== b.preferred) return a.preferred ? -1 : 1
      return 0
    })
  }

  async detectDevices(): Promise<AudioDeviceInfo[]> {
    // In production this would query the native audio engine.
    // Return OS-level defaults via system calls.
    const devices: AudioDeviceInfo[] = []

    if (this.platform === 'win32') {
      devices.push(
        { id: 'default', name: 'Default Output', channels: 2, sampleRates: [44100, 48000, 96000], isDefault: true,  direction: 'output' },
        { id: 'default_in', name: 'Default Input', channels: 1, sampleRates: [44100, 48000], isDefault: true, direction: 'input' },
      )
    } else if (this.platform === 'darwin') {
      devices.push(
        { id: 'built_in_out', name: 'Built-in Output', channels: 2, sampleRates: [44100, 48000, 96000], isDefault: true,  direction: 'output' },
        { id: 'built_in_in',  name: 'Built-in Microphone', channels: 1, sampleRates: [44100, 48000], isDefault: true, direction: 'input'  },
      )
    } else {
      devices.push(
        { id: 'default', name: 'Default', channels: 2, sampleRates: [44100, 48000], isDefault: true, direction: 'output' },
      )
    }

    return devices
  }

  getPreferredDriver(): string {
    switch (this.platform) {
      case 'win32':  return 'wasapi'    // ASIO requires SDK; WASAPI always available
      case 'darwin': return 'coreaudio'
      case 'linux':  return 'alsa'
      default:       return 'default'
    }
  }

  private async _checkAvailable(driverId: string): Promise<boolean> {
    switch (driverId) {
      case 'asio': return this._checkAsio()
      case 'jack': return this._checkJack()
      default:     return true  // WASAPI, CoreAudio, ALSA always present
    }
  }

  private async _checkAsio(): Promise<boolean> {
    if (this.platform !== 'win32') return false
    try {
      // Check for ASIO drivers in registry
      await exec('reg', ['query', 'HKLM\\SOFTWARE\\ASIO'])
      return true
    } catch {
      return false
    }
  }

  private async _checkJack(): Promise<boolean> {
    if (this.platform !== 'linux') return false
    try {
      await exec('which', ['jackd'])
      return true
    } catch {
      return false
    }
  }
}
