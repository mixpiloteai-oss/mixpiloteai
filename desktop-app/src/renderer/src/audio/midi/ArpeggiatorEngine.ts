type ArpMode = 'up' | 'down' | 'up-down' | 'down-up' | 'random' | 'order' | 'chord'
type ArpRate = '1/32' | '1/16' | '1/8' | '1/4' | '1/2' | '1/1'

const ARP_RATE_BEATS: Record<ArpRate, number> = {
  '1/32': 0.125,
  '1/16': 0.25,
  '1/8': 0.5,
  '1/4': 1,
  '1/2': 2,
  '1/1': 4,
}

export interface ArpConfig {
  mode: ArpMode
  rate: ArpRate
  octaves: number // 1-4
  gate: number // 0-1 fraction of step
  channel: number // output MIDI channel 0-15
}

export type NoteOnFn = (pitch: number, velocity: number, channel: number) => void
export type NoteOffFn = (pitch: number, channel: number) => void

export class ArpeggiatorEngine {
  private config: ArpConfig = {
    mode: 'up',
    rate: '1/8',
    octaves: 1,
    gate: 0.8,
    channel: 0,
  }
  private heldNotes: number[] = []
  private activeNotes: Set<number> = new Set()
  private stepIndex: number = 0
  private pattern: number[] = []
  private bpm: number = 120
  private intervalId: ReturnType<typeof setInterval> | null = null
  private noteOnFn: NoteOnFn | null = null
  private noteOffFn: NoteOffFn | null = null
  private onStepChange: ((step: number) => void) | null = null

  setCallbacks(noteOn: NoteOnFn, noteOff: NoteOffFn): void {
    this.noteOnFn = noteOn
    this.noteOffFn = noteOff
  }

  setOnStepChange(fn: (step: number) => void): void {
    this.onStepChange = fn
  }

  setConfig(patch: Partial<ArpConfig>): void {
    this.config = { ...this.config, ...patch }
    this._buildPattern()
    this._restart()
  }

  setBpm(bpm: number): void {
    this.bpm = bpm
    this._restart()
  }

  noteOn(pitch: number): void {
    if (!this.heldNotes.includes(pitch)) {
      this.heldNotes.push(pitch)
    }
    this._buildPattern()
  }

  noteOff(pitch: number): void {
    this.heldNotes = this.heldNotes.filter((n) => n !== pitch)
    this._buildPattern()
  }

  start(): void {
    if (this.intervalId !== null) return
    this.stepIndex = 0
    const stepMs = this._computeStepMs()
    this._tick()
    this.intervalId = setInterval(() => this._tick(), stepMs)
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    for (const p of this.activeNotes) {
      this.noteOffFn?.(p, this.config.channel)
    }
    this.activeNotes.clear()
    this.stepIndex = 0
  }

  getCurrentStep(): number {
    return this.stepIndex
  }

  private _buildPattern(): void {
    if (this.heldNotes.length === 0) {
      this.pattern = []
      return
    }

    const sorted = [...this.heldNotes].sort((a, b) => a - b)

    switch (this.config.mode) {
      case 'up': {
        const up: number[] = []
        for (let oct = 0; oct < this.config.octaves; oct++) {
          for (const note of sorted) {
            up.push(note + 12 * oct)
          }
        }
        this.pattern = up
        break
      }
      case 'down': {
        const up: number[] = []
        for (let oct = 0; oct < this.config.octaves; oct++) {
          for (const note of sorted) {
            up.push(note + 12 * oct)
          }
        }
        this.pattern = up.reverse()
        break
      }
      case 'up-down': {
        const up: number[] = []
        for (let oct = 0; oct < this.config.octaves; oct++) {
          for (const note of sorted) {
            up.push(note + 12 * oct)
          }
        }
        const down = [...up].reverse()
        // no duplicate at endpoints
        this.pattern = [...up.slice(0, -1), ...down.slice(0, -1)]
        break
      }
      case 'down-up': {
        const up: number[] = []
        for (let oct = 0; oct < this.config.octaves; oct++) {
          for (const note of sorted) {
            up.push(note + 12 * oct)
          }
        }
        const down = [...up].reverse()
        const upDown = [...up.slice(0, -1), ...down.slice(0, -1)]
        this.pattern = [...upDown.slice(upDown.length / 2), ...upDown.slice(0, upDown.length / 2)]
        // simpler: down-up is just reversed up-down starting from down
        const downSeq = [...up].reverse()
        const downSlice = downSeq.slice(0, -1)
        const upSlice = up.slice(0, -1)
        this.pattern = [...downSlice, ...upSlice]
        break
      }
      case 'random': {
        const copy = [...this.heldNotes]
        // Fisher-Yates shuffle
        for (let i = copy.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          const temp = copy[i]!
          copy[i] = copy[j]!
          copy[j] = temp
        }
        this.pattern = copy
        break
      }
      case 'order': {
        this.pattern = [...this.heldNotes]
        break
      }
      case 'chord': {
        this.pattern = [...this.heldNotes]
        break
      }
    }
  }

  private _tick(): void {
    if (this.pattern.length === 0) return

    for (const p of this.activeNotes) {
      this.noteOffFn?.(p, this.config.channel)
    }
    this.activeNotes.clear()

    const stepMs = this._computeStepMs()
    const gateMs = stepMs * this.config.gate

    if (this.config.mode === 'chord') {
      for (const pitch of this.pattern) {
        this.noteOnFn?.(pitch, 100, this.config.channel)
        this.activeNotes.add(pitch)
        setTimeout(() => {
          this.noteOffFn?.(pitch, this.config.channel)
          this.activeNotes.delete(pitch)
        }, gateMs)
      }
    } else {
      const pitch = this.pattern[this.stepIndex % this.pattern.length]!
      this.noteOnFn?.(pitch, 100, this.config.channel)
      this.activeNotes.add(pitch)
      setTimeout(() => {
        this.noteOffFn?.(pitch, this.config.channel)
        this.activeNotes.delete(pitch)
      }, gateMs)
    }

    this.onStepChange?.(this.stepIndex)
    this.stepIndex = (this.stepIndex + 1) % Math.max(1, this.pattern.length)
  }

  private _computeStepMs(): number {
    return (60000 / this.bpm) * ARP_RATE_BEATS[this.config.rate]
  }

  private _restart(): void {
    if (this.intervalId !== null) {
      this.stop()
      this.start()
    }
  }
}

let _arpInstance: ArpeggiatorEngine | null = null

export function getArpeggiatorEngine(): ArpeggiatorEngine {
  if (_arpInstance === null) {
    _arpInstance = new ArpeggiatorEngine()
  }
  return _arpInstance
}
