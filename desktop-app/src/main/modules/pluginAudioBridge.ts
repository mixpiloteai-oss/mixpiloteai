// ─── Plugin Audio Bridge ──────────────────────────────────────────────────────
// Bridges the plugin host manager with the audio engine's processing graph.
// Handles real-time audio routing, MIDI routing, and latency compensation.

import { EventEmitter } from 'events'
import { pluginHostManager } from './pluginHost'

export interface AudioRouteConfig {
  instanceId: string
  trackId: string
  inputGain: number    // linear 0–2
  outputGain: number
  bypassEnabled: boolean
  latencyCompensationMs: number
}

export interface MidiRouteConfig {
  instanceId: string
  fromTrackId: string
  channel: number   // 0 = all channels, 1–16 = specific
}

class PluginAudioBridge extends EventEmitter {
  private routes     = new Map<string, AudioRouteConfig>()
  private midiRoutes = new Map<string, MidiRouteConfig>()
  private sampleRate = 44100
  private bufferSize = 512

  /** Configure audio routing for a plugin instance. */
  setAudioRoute(config: AudioRouteConfig): void {
    this.routes.set(config.instanceId, config)
  }

  removeAudioRoute(instanceId: string): void {
    this.routes.delete(instanceId)
  }

  /** Configure MIDI routing to a plugin. */
  setMidiRoute(config: MidiRouteConfig): void {
    this.midiRoutes.set(config.instanceId, config)
  }

  removeMidiRoute(instanceId: string): void {
    this.midiRoutes.delete(instanceId)
  }

  /** Process a block of audio through all plugins on a track in order. */
  async processTrackPlugins(
    trackId: string,
    inputSamples: Float32Array,
    numSamples: number,
    channels: number,
  ): Promise<Float32Array> {
    // Find all active, non-bypassed plugins on this track.
    const trackPlugins = [...this.routes.values()]
      .filter(r => r.trackId === trackId && !r.bypassEnabled)

    let current = inputSamples
    for (const route of trackPlugins) {
      try {
        const output = await pluginHostManager.processAudio(
          route.instanceId,
          Array.from(current),
          numSamples,
          channels,
        )
        if (output && output.length > 0) {
          const buf = new Float32Array(output)
          for (let i = 0; i < buf.length; i++) buf[i] *= route.outputGain
          current = buf
        }
      } catch (err) {
        console.error(`[audio-bridge] plugin ${route.instanceId} process failed:`, err)
        // Continue with unprocessed audio on plugin error.
      }
    }
    return current
  }

  /** Route a MIDI event to all plugins subscribed for the given track. */
  routeMidi(
    fromTrackId: string,
    eventType: string,
    channel: number,
    note: number,
    velocity: number,
    control: number,
    value: number,
    pitchBend: number,
    sampleOffset: number,
  ): void {
    for (const [instanceId, route] of this.midiRoutes) {
      if (route.fromTrackId !== fromTrackId) continue
      if (route.channel !== 0 && route.channel !== channel) continue
      void pluginHostManager
        .sendMidi(instanceId, eventType, channel, note, velocity, control, value, pitchBend, sampleOffset)
        .catch(err => {
          console.error(`[audio-bridge] MIDI route failed for ${instanceId}:`, err)
        })
    }
  }

  setSampleRate(rate: number): void { this.sampleRate = rate }
  setBufferSize(size: number): void { this.bufferSize = size }

  getSampleRate(): number { return this.sampleRate }
  getBufferSize(): number { return this.bufferSize }

  getRoutes(): AudioRouteConfig[] {
    return [...this.routes.values()]
  }

  getMidiRoutes(): MidiRouteConfig[] {
    return [...this.midiRoutes.values()]
  }
}

export const pluginAudioBridge = new PluginAudioBridge()
