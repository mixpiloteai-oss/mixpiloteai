/**
 * RecordingEngine — audio and MIDI capture
 *
 * Audio recording: captures from a MediaStream (microphone or loopback)
 * into AudioBuffer segments using ScriptProcessorNode → MediaRecorder fallback
 * or the modern AudioWorklet approach.
 *
 * MIDI recording: listens to WebMIDI input events and timestamps them
 * relative to the transport's AudioContext clock for sample-accurate alignment.
 *
 * Architecture:
 *   MediaStream → MediaRecorder (Blob chunks) → assembled ArrayBuffer → AudioBuffer
 *   WebMIDI input → MIDI event queue (timestamped in beats)
 */

import type { MidiNote } from '../types/project'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RecordedAudioClip {
  id:          string
  trackId:     string
  startBeat:   number
  buffer:      AudioBuffer
  sampleRate:  number
  channels:    number
  durationSec: number
}

export interface RecordedMidiClip {
  id:        string
  trackId:   string
  startBeat: number
  notes:     MidiNote[]
}

export type RecordState = 'idle' | 'armed' | 'recording' | 'stopping'

export interface RecordingEngineEvents {
  onAudioClipReady:  (clip: RecordedAudioClip) => void
  onMidiClipReady:   (clip: RecordedMidiClip)  => void
  onStateChange:     (state: RecordState)       => void
  onLevelMeter:      (rms: number, peak: number)=> void
}

// ─── Active MIDI note tracker ─────────────────────────────────────────────────

interface ActiveNote {
  pitch:     number
  velocity:  number
  startBeat: number
  id:        string
}

let _noteId = 0
const mkNoteId = () => `rec${_noteId++}`

// ─── RecordingEngine ──────────────────────────────────────────────────────────

export class RecordingEngine {
  private readonly ctx:     AudioContext
  private readonly events:  RecordingEngineEvents

  // Audio recording
  private _mediaRecorder:   MediaRecorder | null  = null
  private _chunks:          Blob[]                = []
  private _inputStream:     MediaStream | null    = null

  // MIDI recording
  private _midiInput:       MIDIInput | null      = null
  private _activeNotes:     Map<number, ActiveNote> = new Map()
  private _recordedNotes:   MidiNote[]            = []

  // State
  private _state:           RecordState           = 'idle'
  private _recordStartBeat  = 0
  private _currentTrackId   = ''
  private _currentClipId    = ''
  private _punchInBeat:  number = -Infinity
  private _punchOutBeat: number = Infinity
  get punchInBeat():  number { return this._punchInBeat }
  get punchOutBeat(): number { return this._punchOutBeat }

  // Level metering (for recording VU)
  private _analyserNode:    AnalyserNode | null   = null
  private _analyserBuf:     Float32Array<ArrayBuffer> | null = null
  private _rafId            = 0

  constructor(ctx: AudioContext, events: RecordingEngineEvents) {
    this.ctx    = ctx
    this.events = events
  }

  // ── Audio recording ───────────────────────────────────────────────────────

  async prepareAudioInput(deviceId?: string): Promise<void> {
    const constraints: MediaStreamConstraints = {
      audio: {
        deviceId:           deviceId ? { exact: deviceId } : undefined,
        echoCancellation:   false,
        noiseSuppression:   false,
        autoGainControl:    false,
        sampleRate:         this.ctx.sampleRate,
      },
    }
    this._inputStream = await navigator.mediaDevices.getUserMedia(constraints)

    // Hook up analyser for level metering
    const src = this.ctx.createMediaStreamSource(this._inputStream)
    this._analyserNode = this.ctx.createAnalyser()
    this._analyserNode.fftSize = 256
    this._analyserNode.smoothingTimeConstant = 0
    src.connect(this._analyserNode)
    this._analyserBuf = new Float32Array(this._analyserNode.fftSize) as Float32Array<ArrayBuffer>

    this._startMeterLoop()
  }

  startAudioRecord(trackId: string, clipId: string, startBeat: number): void {
    if (!this._inputStream || this._state === 'recording') return
    if (!MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      console.warn('[RecordingEngine] webm/opus not supported — using default format')
    }
    this._currentTrackId  = trackId
    this._currentClipId   = clipId
    this._recordStartBeat = startBeat
    this._chunks          = []

    const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? { mimeType: 'audio/webm;codecs=opus' }
      : {}
    this._mediaRecorder = new MediaRecorder(this._inputStream, options)
    this._mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) this._chunks.push(e.data) }
    this._mediaRecorder.onstop = () => this._finaliseAudioClip()

    this._mediaRecorder.start(100)  // collect 100ms chunks
    this._setState('recording')
  }

  stopAudioRecord(): void {
    if (this._state !== 'recording' || !this._mediaRecorder) return
    this._setState('stopping')
    this._mediaRecorder.stop()
  }

  private async _finaliseAudioClip(): Promise<void> {
    const blob   = new Blob(this._chunks, { type: this._mediaRecorder?.mimeType ?? 'audio/webm' })
    const arrayBuffer = await blob.arrayBuffer()

    try {
      const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer)
      this.events.onAudioClipReady({
        id:          this._currentClipId,
        trackId:     this._currentTrackId,
        startBeat:   this._recordStartBeat,
        buffer:      audioBuffer,
        sampleRate:  audioBuffer.sampleRate,
        channels:    audioBuffer.numberOfChannels,
        durationSec: audioBuffer.duration,
      })
    } catch (err) {
      console.error('[RecordingEngine] decodeAudioData failed:', err)
    }
    this._setState('idle')
  }

  // ── MIDI recording ────────────────────────────────────────────────────────

  async prepareMidiInput(inputId?: string): Promise<boolean> {
    if (!('requestMIDIAccess' in navigator)) {
      console.warn('[RecordingEngine] WebMIDI not available')
      return false
    }
    try {
      const access = await (navigator as Navigator & { requestMIDIAccess(): Promise<MIDIAccess> }).requestMIDIAccess()
      const inputs = [...access.inputs.values()]
      const input  = inputId ? inputs.find(i => i.id === inputId) : inputs[0]
      if (!input) { console.warn('[RecordingEngine] no MIDI input found'); return false }
      this._midiInput = input
      return true
    } catch (err) {
      console.warn('[RecordingEngine] MIDI access denied:', err)
      return false
    }
  }

  startMidiRecord(trackId: string, clipId: string, startBeat: number, bpmRef: () => number, timeSigRef: () => number): void {
    this._currentTrackId  = trackId
    this._currentClipId   = clipId
    this._recordStartBeat = startBeat
    this._recordedNotes   = []
    this._activeNotes.clear()

    if (!this._midiInput) { console.warn('[RecordingEngine] no MIDI input'); return }

    this._midiInput.onmidimessage = (e: MIDIMessageEvent) => {
      if (!e.data) return
      const [status, pitch, velocity] = Array.from(e.data)
      const bpm     = bpmRef()
      const tSig    = timeSigRef()
      const elapsed = (this.ctx.currentTime * bpm / 60)
      const beat    = startBeat + elapsed

      if ((status & 0xF0) === 0x90 && velocity > 0) {
        // Note on
        this._activeNotes.set(pitch, { pitch, velocity, startBeat: beat, id: mkNoteId() })
      } else if ((status & 0xF0) === 0x80 || ((status & 0xF0) === 0x90 && velocity === 0)) {
        // Note off
        const active = this._activeNotes.get(pitch)
        if (active) {
          this._recordedNotes.push({
            id:          active.id,
            pitch:       active.pitch,
            startBeat:   active.startBeat - startBeat,
            lengthBeats: beat - active.startBeat,
            velocity:    active.velocity,
          })
          this._activeNotes.delete(pitch)
        }
      }
      void tSig
    }
    this._setState('recording')
  }

  stopMidiRecord(): void {
    if (this._midiInput) this._midiInput.onmidimessage = null

    // Terminate any notes still held
    for (const active of this._activeNotes.values()) {
      const elapsed = this.ctx.currentTime
      this._recordedNotes.push({
        id:          active.id,
        pitch:       active.pitch,
        startBeat:   active.startBeat - this._recordStartBeat,
        lengthBeats: Math.max(0.0625, elapsed),
        velocity:    active.velocity,
      })
    }
    this._activeNotes.clear()

    if (this._recordedNotes.length > 0) {
      this.events.onMidiClipReady({
        id:        this._currentClipId,
        trackId:   this._currentTrackId,
        startBeat: this._recordStartBeat,
        notes:     [...this._recordedNotes],
      })
    }
    this._setState('idle')
  }

  // ── Punch in / out ────────────────────────────────────────────────────────

  setPunchRegion(inBeat: number, outBeat: number): void {
    this._punchInBeat  = inBeat
    this._punchOutBeat = outBeat
  }

  clearPunchRegion(): void {
    this._punchInBeat  = -Infinity
    this._punchOutBeat = Infinity
  }

  // ── State ─────────────────────────────────────────────────────────────────

  get state(): RecordState { return this._state }

  private _setState(s: RecordState): void {
    this._state = s
    this.events.onStateChange(s)
  }

  // ── Meter loop ────────────────────────────────────────────────────────────

  private _startMeterLoop(): void {
    const tick = () => {
      if (this._analyserNode && this._analyserBuf) {
        this._analyserNode.getFloatTimeDomainData(this._analyserBuf)
        let sumSq = 0, peak = 0
        for (let i = 0; i < this._analyserBuf.length; i++) {
          const v = Math.abs(this._analyserBuf[i])
          sumSq += v * v
          if (v > peak) peak = v
        }
        this.events.onLevelMeter(Math.sqrt(sumSq / this._analyserBuf.length), peak)
      }
      this._rafId = requestAnimationFrame(tick)
    }
    this._rafId = requestAnimationFrame(tick)
  }

  dispose(): void {
    cancelAnimationFrame(this._rafId)
    if (this._mediaRecorder?.state === 'recording') this._mediaRecorder.stop()
    if (this._midiInput) this._midiInput.onmidimessage = null
    if (this._inputStream) this._inputStream.getTracks().forEach(t => t.stop())
    this._analyserNode?.disconnect()
  }
}
