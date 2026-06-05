export interface SeqStep {
  active: boolean
  pitch: number
  velocity: number
  gate: number // 0-1
  probability: number // 0-100
  accent: boolean
}

export interface SeqTrack {
  id:      string
  name:    string
  channel: number
  color:   string
  steps:   SeqStep[]
  muted:   boolean
  soloed:  boolean
}

export type SeqNoteOnFn = (pitch: number, velocity: number, channel: number) => void
export type SeqNoteOffFn = (pitch: number, channel: number) => void

export class StepSequencerEngine {
  private tracks: SeqTrack[] = []
  private stepCount: number = 16
  private currentStep: number = 0
  private bpm: number = 120
  private isPlaying: boolean = false
  private intervalId: ReturnType<typeof setInterval> | null = null
  private noteOnFn: SeqNoteOnFn | null = null
  private noteOffFn: SeqNoteOffFn | null = null
  private onStep: ((step: number) => void) | null = null

  setCallbacks(noteOn: SeqNoteOnFn, noteOff: SeqNoteOffFn): void {
    this.noteOnFn = noteOn
    this.noteOffFn = noteOff
  }

  setOnStep(fn: (step: number) => void): void {
    this.onStep = fn
  }

  setBpm(bpm: number): void {
    this.bpm = bpm
    if (this.isPlaying) {
      this.stop()
      this.start()
    }
  }

  setStepCount(n: number): void {
    this.stepCount = n
  }

  setTracks(tracks: SeqTrack[]): void {
    this.tracks = tracks
  }

  updateTrack(trackId: string, patch: Partial<SeqTrack>): void {
    const idx = this.tracks.findIndex((t) => t.id === trackId)
    if (idx !== -1) {
      this.tracks[idx] = { ...this.tracks[idx]!, ...patch }
    }
  }

  updateStep(trackId: string, stepIdx: number, patch: Partial<SeqStep>): void {
    const track = this.tracks.find((t) => t.id === trackId)
    if (track && track.steps[stepIdx] !== undefined) {
      track.steps[stepIdx] = { ...track.steps[stepIdx]!, ...patch }
    }
  }

  start(): void {
    if (this.isPlaying) return
    this.isPlaying = true
    this.currentStep = 0
    const stepMs = this._computeStepMs()
    this._tick()
    this.intervalId = setInterval(() => this._tick(), stepMs)
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.isPlaying = false
    this.currentStep = 0
    this.onStep?.(0)
  }

  reset(): void {
    this.currentStep = 0
    this.onStep?.(0)
  }

  getCurrentStep(): number {
    return this.currentStep % this.stepCount
  }

  isRunning(): boolean {
    return this.isPlaying
  }

  private _tick(): void {
    const step = this.currentStep % this.stepCount
    const hasSolo = this.tracks.some((t) => t.soloed)
    const stepMs = this._computeStepMs()

    for (const track of this.tracks) {
      if (hasSolo && !track.soloed) continue
      if (track.muted) continue
      const s = track.steps[step]
      if (!s || !s.active) continue
      if (Math.random() * 100 > s.probability) continue

      const vel = s.accent ? Math.min(127, s.velocity + 30) : s.velocity
      this.noteOnFn?.(s.pitch, vel, track.channel)
      const pitch = s.pitch
      const channel = track.channel
      setTimeout(() => this.noteOffFn?.(pitch, channel), stepMs * s.gate * 0.95)
    }

    this.onStep?.(step)
    this.currentStep++
  }

  private _computeStepMs(): number {
    return 60000 / this.bpm / 4
  }
}

let _seqInstance: StepSequencerEngine | null = null

export function getStepSequencerEngine(): StepSequencerEngine {
  if (_seqInstance === null) {
    _seqInstance = new StepSequencerEngine()
  }
  return _seqInstance
}
