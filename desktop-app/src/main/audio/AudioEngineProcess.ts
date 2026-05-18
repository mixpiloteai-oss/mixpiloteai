/**
 * AudioEngineProcess — manages the native Rust audio engine child process
 *
 * Spawns `native/audio-engine/target/release/audio-engine` (or dev binary)
 * and communicates via newline-delimited JSON over stdin/stdout.
 *
 * Architecture:
 *   ┌──────────────┐   JSON/stdin   ┌─────────────────────┐
 *   │  Main Process│ ─────────────► │  audio-engine (Rust) │
 *   │  (Node.js)   │ ◄───────────── │  ASIO/WASAPI/CoreAudio│
 *   └──────────────┘   JSON/stdout  └─────────────────────┘
 *
 * The renderer communicates with the main process via IPC (preload API).
 * The main process forwards commands to the native engine and
 * routes events back to the renderer window.
 */

import { ChildProcess, spawn } from 'node:child_process'
import { createInterface }      from 'node:readline'
import { join }                 from 'node:path'
import { existsSync }           from 'node:fs'
import { EventEmitter }         from 'node:events'
import { app }                  from 'electron'

// ─── Protocol types (mirrors Rust protocol.rs) ───────────────────────────────

export interface EngineCommand {
  cmd:  string
  [key: string]: unknown
}

export interface EngineEvent {
  event: string
  [key: string]: unknown
}

export type EngineEventListener = (evt: EngineEvent) => void

// ─── AudioEngineProcess ───────────────────────────────────────────────────────

export class AudioEngineProcess extends EventEmitter {
  private _proc:     ChildProcess | null = null
  private _ready     = false
  private _cmdQueue: EngineCommand[]     = []   // commands buffered before ready
  private _restarts  = 0
  private readonly _maxRestarts = 5

  get ready(): boolean { return this._ready }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async start(driver = 'default', device = '', sampleRate = 44100, bufferSize = 512): Promise<void> {
    if (this._proc) return

    const binaryPath = this._findBinary()
    if (!binaryPath) {
      console.warn('[AudioEngineProcess] native binary not found — running in Web Audio only mode')
      this._ready = true
      this.emit('ready')
      return
    }

    const args = [
      '--driver',      driver,
      '--sample-rate', String(sampleRate),
      '--buffer-size', String(bufferSize),
    ]
    if (device) args.push('--device', device)

    console.log(`[AudioEngineProcess] spawning: ${binaryPath} ${args.join(' ')}`)

    this._proc = spawn(binaryPath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env:   { ...process.env, RUST_LOG: 'info' },
    })

    this._proc.on('exit',  (code, sig) => this._onExit(code, sig))
    this._proc.on('error', (err)       => this._onError(err))

    if (this._proc.stderr) {
      this._proc.stderr.on('data', (d: Buffer) => {
        const line = d.toString().trim()
        if (line) console.log(`[audio-engine] ${line}`)
      })
    }

    if (this._proc.stdout) {
      const rl = createInterface({ input: this._proc.stdout, crlfDelay: Infinity })
      rl.on('line', (line) => this._handleLine(line.trim()))
    }
  }

  stop(): void {
    if (!this._proc) return
    this.send({ cmd: 'shutdown' })
    setTimeout(() => {
      if (this._proc) { this._proc.kill('SIGTERM'); this._proc = null }
    }, 1000)
    this._ready = false
  }

  // ── Command sending ───────────────────────────────────────────────────────

  send(cmd: EngineCommand): void {
    if (!this._ready) { this._cmdQueue.push(cmd); return }
    this._write(cmd)
  }

  play():                                 void { this.send({ cmd: 'play' }) }
  stop():                                 void { this.send({ cmd: 'stop' }) }
  pause():                                void { this.send({ cmd: 'pause' }) }
  seek(bar: number, beat = 1):            void { this.send({ cmd: 'seek', bar, beat }) }
  setBpm(bpm: number):                    void { this.send({ cmd: 'set_bpm', bpm }) }
  setTimeSig(num: number, den: number):   void { this.send({ cmd: 'set_time_sig', numerator: num, denominator: den }) }
  setLoop(enabled: boolean, startBar: number, endBar: number): void {
    this.send({ cmd: 'set_loop', enabled, start_bar: startBar, end_bar: endBar })
  }
  setMasterGain(db: number):              void { this.send({ cmd: 'set_master_gain', db }) }
  setDriver(driver: string, device: string): void { this.send({ cmd: 'set_driver', driver, device }) }
  setBufferSize(frames: number):          void { this.send({ cmd: 'set_buffer_size', frames }) }
  setSampleRate(rate: number):            void { this.send({ cmd: 'set_sample_rate', rate }) }
  queryDevices():                         void { this.send({ cmd: 'query_devices' }) }
  getState():                             void { this.send({ cmd: 'get_state' }) }

  addTrack(id: string, type: string, name: string, color = '#7c3aed'): void {
    this.send({ cmd: 'add_track', id, type, name, color })
  }
  removeTrack(id: string): void { this.send({ cmd: 'remove_track', id }) }

  setTrackGain(id: string, db: number):      void { this.send({ cmd: 'set_track_gain', id, db }) }
  setTrackPan(id: string, pan: number):      void { this.send({ cmd: 'set_track_pan',  id, pan }) }
  muteTrack(id: string, muted: boolean):     void { this.send({ cmd: 'mute_track',     id, muted }) }
  soloTrack(id: string, soloed: boolean):    void { this.send({ cmd: 'solo_track',     id, soloed }) }
  armTrack(id: string, armed: boolean):      void { this.send({ cmd: 'arm_track',      id, armed }) }

  addSend(fromId: string, toId: string, gainDb = 0, preFader = false): void {
    this.send({ cmd: 'add_send', from_id: fromId, to_id: toId, gain_db: gainDb, pre_fader: preFader })
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private _write(cmd: EngineCommand): void {
    if (!this._proc?.stdin?.writable) return
    try {
      this._proc.stdin.write(JSON.stringify(cmd) + '\n')
    } catch (err) {
      console.error('[AudioEngineProcess] write error:', err)
    }
  }

  private _handleLine(line: string): void {
    if (!line || line[0] !== '{') return
    try {
      const evt = JSON.parse(line) as EngineEvent
      if (evt.event === 'ready') {
        this._ready = true
        // Flush buffered commands
        for (const cmd of this._cmdQueue) this._write(cmd)
        this._cmdQueue = []
        this.emit('ready')
      }
      this.emit('event', evt)
      this.emit(evt.event, evt)  // named event for direct subscription
    } catch (err) {
      console.warn('[AudioEngineProcess] parse error:', err, line)
    }
  }

  private _onExit(code: number | null, signal: string | null): void {
    this._proc  = null
    this._ready = false
    console.warn(`[AudioEngineProcess] exited — code=${code} signal=${signal}`)
    this.emit('exit', { code, signal })

    // Auto-restart unless shutdown intentionally
    if (code !== 0 && this._restarts < this._maxRestarts) {
      this._restarts++
      const delay = Math.min(1000 * this._restarts, 10000)
      console.log(`[AudioEngineProcess] restarting in ${delay}ms (attempt ${this._restarts})`)
      setTimeout(() => this.start(), delay)
    }
  }

  private _onError(err: Error): void {
    console.error('[AudioEngineProcess] spawn error:', err)
    this.emit('error', err)
  }

  private _findBinary(): string | null {
    const candidates = [
      // Production: packed with app
      join(app.getAppPath(), '..', 'audio-engine', process.platform === 'win32' ? 'audio-engine.exe' : 'audio-engine'),
      // Development: Cargo release build
      join(__dirname, '..', '..', '..', '..', '..', 'native', 'audio-engine', 'target', 'release',
        process.platform === 'win32' ? 'audio-engine.exe' : 'audio-engine'),
      // Development: Cargo debug build
      join(__dirname, '..', '..', '..', '..', '..', 'native', 'audio-engine', 'target', 'debug',
        process.platform === 'win32' ? 'audio-engine.exe' : 'audio-engine'),
    ]
    for (const p of candidates) {
      if (existsSync(p)) return p
    }
    return null
  }
}

// Singleton
let _instance: AudioEngineProcess | null = null
export function getAudioEngineProcess(): AudioEngineProcess {
  if (!_instance) _instance = new AudioEngineProcess()
  return _instance
}
