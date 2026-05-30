// ─── RecordingEngine ───────────────────────────────────────────────────────────
// Browser-only Web Audio recording engine.
// Connects MediaStream → ScriptProcessorNode, forwards interleaved PCM to the
// main process via IPC. No Node.js imports.

import { InputDeviceManager } from './InputDeviceManager.ts'
import { BufferManager } from './BufferManager.ts'
import { LatencyCompensator } from './LatencyCompensator.ts'
import type { RecordingResult } from './TakeManager.ts'

export interface RecordingOptions {
  punchIn?:   number   // sample offset
  punchOut?:  number   // sample offset (undefined = record until stop)
  loop?:      boolean
  loopStart?: number
  loopEnd?:   number
  format:     'wav' | 'flac'
  bitDepth:   16 | 24 | 32
  sampleRate: number
}

export interface ArmedTrack {
  trackId:       string
  deviceId:      string
  channelCount:  1 | 2
  stream:        MediaStream
  sourceNode:    MediaStreamAudioSourceNode
  processorNode: ScriptProcessorNode
  gainNode:      GainNode
  monitorGain:   GainNode | null
  bufferManager: BufferManager
}

export class RecordingEngine {
  private _ctx:         AudioContext
  private _armed:       Map<string, ArmedTrack> = new Map()
  private _sessions:    Map<string, string>     = new Map()  // trackId → sessionId
  private _compensator: LatencyCompensator      = new LatencyCompensator()
  private _inputMgr:    InputDeviceManager      = new InputDeviceManager()

  constructor(ctx: AudioContext) {
    this._ctx = ctx
  }

  async arm(trackId: string, deviceId: string, channelCount: 1 | 2): Promise<void> {
    // If already armed, disarm first
    this.disarm(trackId)

    const stream     = await this._inputMgr.getInputStream(deviceId, channelCount, this._ctx.sampleRate)
    const sourceNode = this._ctx.createMediaStreamSource(stream)
    const gainNode   = this._ctx.createGain()

    // ScriptProcessorNode for capturing PCM (bufferSize 4096)
    const processorNode = this._ctx.createScriptProcessor(4096, channelCount, channelCount)

    // 30 s ring buffer
    const bufferManager = new BufferManager(this._ctx.sampleRate * 30, channelCount)

    processorNode.onaudioprocess = (e) => {
      const channels: Float32Array[] = []
      for (let ch = 0; ch < channelCount; ch++) {
        channels.push(new Float32Array(e.inputBuffer.getChannelData(ch)))
      }
      bufferManager.write(channels)
    }

    sourceNode.connect(gainNode)
    gainNode.connect(processorNode)
    processorNode.connect(this._ctx.destination)  // needed to keep processor alive

    this._armed.set(trackId, {
      trackId, deviceId, channelCount, stream, sourceNode, processorNode, gainNode,
      monitorGain: null, bufferManager,
    })
  }

  disarm(trackId: string): void {
    const armed = this._armed.get(trackId)
    if (!armed) return
    armed.processorNode.disconnect()
    armed.gainNode.disconnect()
    armed.sourceNode.disconnect()
    armed.monitorGain?.disconnect()
    armed.stream.getTracks().forEach(t => t.stop())
    this._armed.delete(trackId)
  }

  async startRecording(trackId: string, takeNumber: number, options: RecordingOptions): Promise<void> {
    const armed = this._armed.get(trackId)
    if (!armed) throw new Error(`Track ${trackId} is not armed`)

    // Reset buffer
    armed.bufferManager.reset()

    // Start IPC recording session
    const result = await window.electronAPI?.recordingStart({
      trackId,
      takeNumber,
      format:       options.format,
      sampleRate:   options.sampleRate,
      channelCount: armed.channelCount,
      bitDepth:     options.bitDepth,
    })
    if (!result) throw new Error('Recording IPC unavailable')
    this._sessions.set(trackId, result.sessionId)

    // Wire onaudioprocess to also send chunks via IPC
    armed.processorNode.onaudioprocess = (e) => {
      const channels: Float32Array[] = []
      for (let ch = 0; ch < armed.channelCount; ch++) {
        channels.push(new Float32Array(e.inputBuffer.getChannelData(ch)))
      }
      armed.bufferManager.write(channels)

      // Interleave channels for IPC transfer
      const size        = channels[0].length
      const interleaved = new Float32Array(size * armed.channelCount)
      for (let i = 0; i < size; i++) {
        for (let ch = 0; ch < armed.channelCount; ch++) {
          interleaved[i * armed.channelCount + ch] = channels[ch][i]
        }
      }

      const sessionId = this._sessions.get(trackId)
      if (sessionId) {
        void window.electronAPI?.recordingChunk({ sessionId, data: Array.from(interleaved) })
      }
    }
  }

  async stopRecording(trackId: string): Promise<RecordingResult | null> {
    const sessionId = this._sessions.get(trackId)
    if (!sessionId) return null

    const result = await window.electronAPI?.recordingFinalize(sessionId)
    this._sessions.delete(trackId)

    if (!result) return null
    return result as RecordingResult
  }

  getMonitorLevel(trackId: string): { peak: number; rms: number } {
    const armed = this._armed.get(trackId)
    if (!armed) return { peak: 0, rms: 0 }

    // Read recent samples from buffer to compute level
    const count = Math.min(armed.bufferManager.getAvailable(), 512)
    if (count === 0) return { peak: 0, rms: 0 }
    const chunks = armed.bufferManager.read(count)
    if (!chunks) return { peak: 0, rms: 0 }
    // Put samples back — we just peeked
    armed.bufferManager.write(chunks)

    let peak = 0
    let sumSq = 0
    for (const ch of chunks) {
      for (const s of ch) {
        const abs = Math.abs(s)
        if (abs > peak) peak = abs
        sumSq += s * s
      }
    }
    return { peak, rms: Math.sqrt(sumSq / (chunks[0].length * chunks.length)) }
  }

  enableDirectMonitor(trackId: string, gainDb: number): void {
    const armed = this._armed.get(trackId)
    if (!armed) return
    if (armed.monitorGain) return  // already enabled
    const monitorGain = this._ctx.createGain()
    monitorGain.gain.value = Math.pow(10, gainDb / 20)
    armed.gainNode.connect(monitorGain)
    monitorGain.connect(this._ctx.destination)
    this._armed.set(trackId, { ...armed, monitorGain })
  }

  disableDirectMonitor(trackId: string): void {
    const armed = this._armed.get(trackId)
    if (!armed?.monitorGain) return
    armed.monitorGain.disconnect()
    this._armed.set(trackId, { ...armed, monitorGain: null })
  }

  isArmed(trackId: string): boolean {
    return this._armed.has(trackId)
  }

  getArmedTracks(): string[] {
    return [...this._armed.keys()]
  }

  dispose(): void {
    for (const trackId of [...this._armed.keys()]) this.disarm(trackId)
  }
}
