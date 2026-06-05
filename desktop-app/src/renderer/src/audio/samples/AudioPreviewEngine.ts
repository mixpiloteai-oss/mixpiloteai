// AudioPreviewEngine — Web Audio API preview with optional BPM sync
// Decodes audio files via IPC (recordingReadPcm), plays through a GainNode.
// BPM sync: schedules loop start to align with the host transport beat grid.

export interface PreviewOptions {
  volume?:      number   // 0..1, default 0.8
  loop?:        boolean  // default false
  bpmSync?:     boolean  // align playback start to next beat boundary
  hostBpm?:     number   // host tempo for BPM sync
  hostTime?:    number   // AudioContext.currentTime at last beat (for sync)
}

export interface PreviewState {
  id:           string
  path:         string
  playing:      boolean
  duration:     number   // seconds
  startedAt:    number   // AudioContext.currentTime
}

type PreviewEndCallback = (id: string) => void

export class AudioPreviewEngine {
  private _ctx:      AudioContext | null = null
  private _gain:     GainNode | null = null
  private _source:   AudioBufferSourceNode | null = null
  private _current:  PreviewState | null = null
  private _onEnd:    PreviewEndCallback | null = null

  // Lazily create AudioContext (must be triggered by user gesture)
  private _ensureCtx(): AudioContext {
    if (!this._ctx) {
      this._ctx  = new AudioContext()
      this._gain = this._ctx.createGain()
      this._gain.connect(this._ctx.destination)
    }
    if (this._ctx.state === 'suspended') {
      void this._ctx.resume()
    }
    return this._ctx
  }

  onEnd(cb: PreviewEndCallback): void {
    this._onEnd = cb
  }

  get currentState(): PreviewState | null {
    return this._current
  }

  get volume(): number {
    return this._gain?.gain.value ?? 0.8
  }

  setVolume(v: number): void {
    if (this._gain) {
      this._gain.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), this._ensureCtx().currentTime, 0.01)
    }
  }

  async play(id: string, path: string, opts: PreviewOptions = {}): Promise<void> {
    this.stop()
    const ctx = this._ensureCtx()

    // Fetch PCM data via IPC
    const api = (window as Window & { electronAPI?: { recordingReadPcm?: (p: string) => Promise<number[]> } }).electronAPI
    if (!api?.recordingReadPcm) return

    let rawSamples: number[]
    try {
      rawSamples = await api.recordingReadPcm(path)
    } catch {
      return
    }
    if (rawSamples.length === 0) return

    const sampleRate = ctx.sampleRate
    const audioBuffer = ctx.createBuffer(1, rawSamples.length, sampleRate)
    const channelData = audioBuffer.getChannelData(0)
    for (let i = 0; i < rawSamples.length; i++) {
      channelData[i] = rawSamples[i]
    }

    const source = ctx.createBufferSource()
    source.buffer = audioBuffer
    source.loop   = opts.loop ?? false
    source.connect(this._gain!)

    if (opts.volume !== undefined) {
      this._gain!.gain.value = Math.max(0, Math.min(1, opts.volume))
    }

    // BPM sync: schedule start at the next beat boundary
    let when = ctx.currentTime
    if (opts.bpmSync && opts.hostBpm && opts.hostBpm > 0 && opts.hostTime !== undefined) {
      when = this._nextBeatTime(ctx.currentTime, opts.hostBpm, opts.hostTime)
    }

    source.start(when)
    this._source = source
    this._current = { id, path, playing: true, duration: audioBuffer.duration, startedAt: when }

    source.onended = () => {
      if (this._current?.id === id) {
        this._current = null
      }
      this._onEnd?.(id)
    }
  }

  stop(): void {
    if (this._source) {
      try { this._source.stop() } catch { /* already stopped */ }
      this._source = null
    }
    this._current = null
  }

  // Returns the AudioContext currentTime of the next beat boundary
  private _nextBeatTime(now: number, bpm: number, lastBeatTime: number): number {
    const beatDuration = 60 / bpm
    const elapsed      = now - lastBeatTime
    if (elapsed < 0) return lastBeatTime
    const beatsElapsed = elapsed / beatDuration
    const nextBeat     = Math.ceil(beatsElapsed)
    return lastBeatTime + nextBeat * beatDuration
  }

  dispose(): void {
    this.stop()
    if (this._ctx) {
      void this._ctx.close()
      this._ctx  = null
      this._gain = null
    }
  }
}

// Module-level singleton (browser-only)
let _instance: AudioPreviewEngine | null = null

export function getAudioPreviewEngine(): AudioPreviewEngine {
  if (!_instance) _instance = new AudioPreviewEngine()
  return _instance
}
