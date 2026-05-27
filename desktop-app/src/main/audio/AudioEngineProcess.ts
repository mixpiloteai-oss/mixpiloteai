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
 *
 * Binary packaging:
 *   Production builds package the binary via electron-builder extraResources:
 *     from: native/audio-engine/target/release/audio-engine[.exe]
 *     to:   {resources}/audio-engine/audio-engine[.exe]
 *
 *   If the binary is not found, the process starts in "Web Audio fallback"
 *   mode — the renderer uses the Web Audio API instead.  This is NEVER
 *   silent: a warning is logged and the status is queryable via IPC.
 */

import { ChildProcess, spawn }  from 'node:child_process'
import { createInterface }       from 'node:readline'
import { EventEmitter }          from 'node:events'
import { app }                   from 'electron'
import {
  getEngineBinaryCandidates,
  findEngineBinary,
} from './enginePaths'

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

// ─── Engine status (queryable via IPC: audio-engine-status) ──────────────────

export interface EngineStatus {
  /** Operating mode: 'native' = Rust binary running; 'web-audio-fallback' = binary not found */
  mode:         'native' | 'web-audio-fallback'
  /** Whether the native binary was found on disk */
  binaryFound:  boolean
  /** Full path to the binary that was found (null if not found) */
  binaryPath:   string | null
  /** All candidate paths that were checked during startup */
  checkedPaths: string[]
  /** node process.platform value */
  platform:     string
  /** Whether the child process is currently running */
  isRunning:    boolean
  /** How many times the engine has been restarted in this session */
  restarts:     number
}

// ─── AudioEngineProcess ───────────────────────────────────────────────────────

export class AudioEngineProcess extends EventEmitter {
  private _proc:        ChildProcess | null = null
  private _ready        = false
  private _cmdQueue:    EngineCommand[]     = []   // commands buffered before ready
  private _restarts     = 0
  private _stopping     = false              // true when stop() was called intentionally
  private readonly _maxRestarts   = 5
  private readonly _maxQueueSize  = 64       // prevent unbounded queue growth

  // Status tracked from last start() call — set before/after binary search
  private _status: EngineStatus = {
    mode:         'web-audio-fallback',
    binaryFound:  false,
    binaryPath:   null,
    checkedPaths: [],
    platform:     process.platform,
    isRunning:    false,
    restarts:     0,
  }

  get ready(): boolean { return this._ready }

  /** Returns the current engine status snapshot. */
  getStatus(): EngineStatus {
    return {
      ...this._status,
      isRunning: this._proc !== null && !this._proc.killed,
      restarts:  this._restarts,
    }
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async start(driver = 'default', device = '', sampleRate = 44100, bufferSize = 512): Promise<void> {
    if (this._proc) {
      console.warn('[AudioEngineProcess] start called but process already running')
      return
    }
    this._stopping = false   // fresh start, clear intentional-stop flag

    const { path: binaryPath, checkedPaths } = this._findBinary()
    if (!binaryPath) {
      this._status = {
        mode:         'web-audio-fallback',
        binaryFound:  false,
        binaryPath:   null,
        checkedPaths,
        platform:     process.platform,
        isRunning:    false,
        restarts:     this._restarts,
      }
      console.warn(
        '[AudioEngineProcess] ⚠️  Native audio engine binary NOT FOUND.\n' +
        '  Falling back to Web Audio API — reduced performance, no ASIO/WASAPI/CoreAudio.\n' +
        '  Searched paths:\n' +
        checkedPaths.map(p => `    • ${p}`).join('\n') + '\n' +
        '  To fix: run `cargo build --release` in native/audio-engine/' +
        '  and restart the app, or rebuild with a release build.'
      )
      this._ready = true
      this.emit('ready')
      this.emit('engine-mode', this._status)
      return
    }

    this._status = {
      mode:         'native',
      binaryFound:  true,
      binaryPath,
      checkedPaths,
      platform:     process.platform,
      isRunning:    false,  // will flip to true once 'ready' event arrives
      restarts:     this._restarts,
    }
    console.log(`[AudioEngineProcess] ✓ Native audio engine binary found: ${binaryPath}`)
    this.emit('engine-mode', this._status)

    const args = [
      '--driver',      driver,
      '--sample-rate', String(sampleRate),
      '--buffer-size', String(bufferSize),
    ]
    if (device) args.push('--device', device)

    console.log(`[AudioEngineProcess] spawning: ${binaryPath} ${args.join(' ')}`)

    try {
      this._proc = spawn(binaryPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env:   { ...process.env, RUST_LOG: 'info' },
      })

      // Timeout guard: if process doesn't send 'ready' within 10s, consider it dead
      const readyTimeout = setTimeout(() => {
        if (!this._ready && this._proc) {
          console.error('[AudioEngineProcess] ready timeout — killing stalled process')
          this._proc.kill('SIGKILL')
          this._proc = null
          this._ready = false
        }
      }, 10_000)

      this._proc.on('exit',  (code, sig) => {
        clearTimeout(readyTimeout)
        this._onExit(code, sig)
      })
      this._proc.on('error', (err) => {
        clearTimeout(readyTimeout)
        this._onError(err)
      })

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
    } catch (err) {
      console.error('[AudioEngineProcess] spawn error:', err)
      this._proc = null
      this._ready = false
      throw err
    }
  }

  stop(): void {
    if (!this._proc) {
      this._ready   = false
      this._stopping = false
      return
    }

    this._ready    = false
    this._stopping = true   // flag intentional stop so auto-restart knows to skip

    try {
      this.send({ cmd: 'shutdown' })
    } catch { /* already dead */ }

    // Forcefully kill if not exited within timeout
    const killTimeout = setTimeout(() => {
      if (this._proc) {
        console.warn('[AudioEngineProcess] kill timeout, forcing SIGKILL')
        try { this._proc.kill('SIGKILL') } catch { /* already dead */ }
        this._proc = null
      }
    }, 2_000)

    // Cleanup on exit
    this._proc?.once('exit', () => {
      clearTimeout(killTimeout)
      this._proc = null
    })
  }

  // ── Command sending ───────────────────────────────────────────────────────

  send(cmd: EngineCommand): void {
    if (!this._ready) {
      // Buffer commands only if we expect to be ready soon, and queue isn't full
      if (this._restarts < this._maxRestarts && this._cmdQueue.length < this._maxQueueSize) {
        this._cmdQueue.push(cmd)
      } else if (this._cmdQueue.length >= this._maxQueueSize) {
        console.warn(`[AudioEngineProcess] command queue full (${this._maxQueueSize}), dropping: ${cmd.cmd}`)
      }
      return
    }
    this._write(cmd)
  }

  play():                                 void { this.send({ cmd: 'play' }) }
  stopPlayback():                         void { this.send({ cmd: 'stop' }) }
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
    if (!this._proc?.stdin?.writable) {
      console.warn('[AudioEngineProcess] stdin not writable, dropping command:', cmd.cmd)
      return
    }
    try {
      const json = JSON.stringify(cmd)
      this._proc.stdin.write(json + '\n')
    } catch (err) {
      console.error('[AudioEngineProcess] write failed:', err, 'cmd:', cmd.cmd)
      // Don't crash on write errors — process may be dying
    }
  }

  private _handleLine(line: string): void {
    if (!line || !line.startsWith('{')) return

    try {
      const evt = JSON.parse(line) as EngineEvent
      if (!evt.event) return

      if (evt.event === 'ready') {
        this._ready = true
        this._restarts = 0  // Reset restart counter on successful startup
        this._status = { ...this._status, isRunning: true, restarts: 0 }
        // Flush buffered commands
        const cmds = this._cmdQueue.slice()
        this._cmdQueue = []
        for (const cmd of cmds) {
          try {
            this._write(cmd)
          } catch (e) {
            console.error('[AudioEngineProcess] failed to flush queued command:', e)
          }
        }
        this.emit('ready')
      }

      this.emit('event', evt)
      this.emit(evt.event, evt)  // named event for direct subscription
    } catch (err) {
      console.warn('[AudioEngineProcess] parse error:', err instanceof Error ? err.message : String(err))
      // Malformed line, but don't crash — continue parsing
    }
  }

  private _onExit(code: number | null, signal: string | null): void {
    const pid = this._proc?.pid
    console.log(`[AudioEngineProcess] exited — pid=${pid ?? '?'} code=${code} signal=${signal}`)

    this._proc  = null
    this._ready = false
    this.emit('exit', { code, signal })

    // Do not auto-restart if:
    //   - stop() was called intentionally (_stopping flag)
    //   - clean exit (code 0)
    //   - max restarts exceeded
    if (this._stopping) {
      console.log('[AudioEngineProcess] intentional stop — no restart')
      this._stopping  = false
      this._cmdQueue  = []   // discard stale queued commands
      return
    }

    if (code === 0) {
      console.log('[AudioEngineProcess] clean exit (code 0) — no restart')
      this._cmdQueue = []
      return
    }

    if (this._restarts >= this._maxRestarts) {
      console.error(`[AudioEngineProcess] max restart attempts (${this._maxRestarts}) reached — staying down`)
      this._cmdQueue = []
      this.emit('max-restarts-exceeded')
      return
    }

    this._restarts++
    const delay = Math.min(1000 * Math.pow(1.5, this._restarts - 1), 10_000)
    console.log(`[AudioEngineProcess] restarting in ${Math.round(delay)}ms (attempt ${this._restarts}/${this._maxRestarts})`)
    setTimeout(() => {
      this.start().catch(e => {
        console.error('[AudioEngineProcess] restart failed:', e)
        this.emit('error', e)
      })
    }, delay)
  }

  private _onError(err: Error): void {
    console.error('[AudioEngineProcess] spawn error:', err.message)
    this.emit('error', err)
    // Don't auto-restart on spawn error — caller should handle
  }

  private _findBinary(): ReturnType<typeof findEngineBinary> {
    const candidates = getEngineBinaryCandidates(app.getAppPath(), __dirname, process.platform)
    const result     = findEngineBinary(candidates)

    // Verbose logging so users/support can diagnose packaging issues
    for (const p of result.checkedPaths) {
      if (p === result.path) {
        console.log(`[AudioEngineProcess] ✓ ${p}`)
      } else {
        console.log(`[AudioEngineProcess] ✗ ${p}`)
      }
    }

    return result
  }
}

// Singleton
let _instance: AudioEngineProcess | null = null
export function getAudioEngineProcess(): AudioEngineProcess {
  if (!_instance) _instance = new AudioEngineProcess()
  return _instance
}
