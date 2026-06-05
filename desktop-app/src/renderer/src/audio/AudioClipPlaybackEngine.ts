import type { Transport } from './Transport'
import type { TrackManager } from './tracks/TrackManager'
import { AudioTrackNode } from './tracks/AudioTrackNode'
import { WaveformLoader } from './WaveformLoader'
import { useProjectStore } from '../store/projectStore'
import type { Unsubscribe } from './types'
import { SCHEDULER_AHEAD } from './types'

export class AudioClipPlaybackEngine {
  private readonly transport: Transport
  private readonly trackManager: TrackManager
  private readonly loader: WaveformLoader

  private _clockUnsub: Unsubscribe | null = null
  private _scheduled: Set<string> = new Set()
  private _lastBeatIdx = -1

  constructor(transport: Transport, trackManager: TrackManager, loader: WaveformLoader) {
    this.transport = transport
    this.trackManager = trackManager
    this.loader = loader
  }

  start(): void {
    if (this._clockUnsub) return
    this._scheduled.clear()
    this._lastBeatIdx = -1
    this._clockUnsub = this.transport.onBeat((beatIdx, scheduledTime, _pos) => {
      this._onBeat(beatIdx, scheduledTime)
    })
  }

  stop(): void {
    if (this._clockUnsub) { this._clockUnsub(); this._clockUnsub = null }
    // Stop all active audio clips on all audio track nodes
    const project = useProjectStore.getState().project
    for (const track of project.tracks) {
      if (track.type !== 'audio') continue
      const node = this.trackManager.getTrack(track.id)
      if (node instanceof AudioTrackNode) node.stopAllClips(10)
    }
    this._scheduled.clear()
  }

  seek(_bar: number): void {
    this._scheduled.clear()
    this._lastBeatIdx = -1
  }

  private _onBeat(beatIdx: number, scheduledTime: number): void {
    // Loop wrap detection
    if (beatIdx <= this._lastBeatIdx) this._scheduled.clear()
    this._lastBeatIdx = beatIdx

    const project = useProjectStore.getState().project
    const bpm = this.transport.bpm
    const tsTop = this.transport.timeSigTop
    const secPerBeat = 60 / bpm
    const lookaheadBeats = SCHEDULER_AHEAD / secPerBeat

    const windowStart = beatIdx
    const windowEnd = beatIdx + lookaheadBeats

    for (const track of project.tracks) {
      if (track.type !== 'audio') continue
      if (track.muted) continue

      const node = this.trackManager.getTrack(track.id)
      if (!(node instanceof AudioTrackNode)) continue

      for (const clip of track.clips) {
        if (clip.muted) continue
        if (!clip.audioFilePath) continue  // skip MIDI-only clips

        const clipStartBeat = (clip.startBar - 1) * tsTop
        const clipEndBeat = clipStartBeat + clip.lengthBars * tsTop

        // Skip clips entirely outside window
        if (clipEndBeat <= windowStart) continue
        if (clipStartBeat >= windowEnd) continue

        // Dedup: one schedule per clip per playback session
        const dedupKey = `${track.id}:${clip.id}`
        if (this._scheduled.has(dedupKey)) continue
        this._scheduled.add(dedupKey)

        // Compute AudioContext time when clip should start
        const clipStartContextTime = scheduledTime + (clipStartBeat - beatIdx) * secPerBeat
        // How far into the buffer to start (if clip already started before window)
        const offsetSec = Math.max(0, scheduledTime - clipStartContextTime)
        const durationSec = (clip.lengthBars * tsTop) * secPerBeat - offsetSec

        if (durationSec <= 0) continue

        const audioFilePath = clip.audioFilePath

        // Load buffer and schedule (fire-and-forget, catch errors)
        this.loader.load(audioFilePath).then((buffer: AudioBuffer | null) => {
          if (!buffer) return
          node.scheduleClip({
            buffer,
            startContextTime: Math.max(scheduledTime, clipStartContextTime),
            offsetSec,
            durationSec,
            clipGainDb: clip.clipGainDb ?? 0,
            fadeInSec: clip.fadeInSec ?? 0,
            fadeOutSec: clip.fadeOutSec ?? 0,
          }).catch(() => { /* schedule failed — clip was stopped */ })
        }).catch(() => { /* file load failed — skip clip */ })
      }
    }
  }

  dispose(): void { this.stop() }
}
