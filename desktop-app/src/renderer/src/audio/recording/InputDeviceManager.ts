// ─── InputDeviceManager ────────────────────────────────────────────────────────
// Browser-only input device enumeration and stream acquisition.
// Uses navigator.mediaDevices exclusively — no Node.js imports.

export interface AudioDeviceInfo {
  deviceId:     string
  label:        string
  channelCount: number
}

export class InputDeviceManager {
  async listInputDevices(): Promise<AudioDeviceInfo[]> {
    if (!navigator.mediaDevices) return []

    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices
      .filter(d => d.kind === 'audioinput')
      .map(d => ({
        deviceId:     d.deviceId,
        label:        d.label || `Microphone (${d.deviceId.slice(0, 8)})`,
        channelCount: 2,
      }))
  }

  async getInputStream(
    deviceId: string,
    channelCount: 1 | 2,
    sampleRate: number,
  ): Promise<MediaStream> {
    return navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId:         { exact: deviceId },
        channelCount:     { exact: channelCount },
        sampleRate:       { exact: sampleRate },
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl:  false,
      },
    })
  }

  async requestPermission(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(t => t.stop())
      return true
    } catch {
      return false
    }
  }
}
