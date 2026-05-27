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
 * Binary packaging:
 *   Production builds package the binary via electron-builder extraResources:
 *     from: native/audio-engine/target/release/audio-engine[.exe]
 *     to:   {resources}/audio-engine/audio-engine[.exe]
 *
 *   If the binary is not found, the process starts in "Web Audio fallback"
 *   mode — the renderer uses the Web Audio API instead.  This is NEVER
 *   silent: a warning is logged and status is queryable via IPC.
 */

import { ChildProcess, spawn }  from 'node:child_process'
import { createInterface }       from 'node:readline'
import { EventEmitter }          from 'node:events'
import { app }                   from 'electron'
import {
  getEngineBinaryCandidates,
  findEngineBinary,
} from './enginePaths'

// ─── Protocol types ───────────────────────────────────────────────────────────

export interface EngineCommand {
  cmd:  string
  [key: string]: unknown
}

export interface EngineEvent {
  event: string
  [key: string]: unknown
}

export type EngineEventListener = (evt: EngineEvent) => void

// ─── CrashEntry ───────────────────────────────────────────────────────────────

export interface CrashEntry {
  timestamp:  number
  code:       number | null
  signal:     string | null
  restartNum: number          // which restart attempt this was (0 = first crash)
}

// ─── EngineStatus ─────────────────────────────────────────────────────────────

export interface EngineStatus {
  // ── Mode ────────────────────────────────────────────────────────────────
  /** 'native' = Rust binary running; 'web-audio-fallback' = binary not found */
  mode:          'native' | 'web-audio-fallback'

  // ── Binary ──────────────────────────────────────────────────────────────
  binaryFound:   boolean
  binaryPath:    string | null
  checkedPaths:  string[]
  platform:      string

  // ── Process ─────────────────────────────────────────────────────────────
  pid:           number | null          // OS process ID when running
  isRunning:     boolean
  uptimeSeconds: number | null          // seconds since last successful start

  // ── Crash / restart tracking ─────────────────────────────────────────────
  restarts:      number                 // restarts in this session
  crashCount:    number                 // total non-intentional crashes this session
  lastCrashAt:   number | null          // epoch ms of last crash
  lastCrashCode: number | null
  lastCrashSig:  string | null
  recentCrashes: CrashEntry[]          // last 5 entries

  // ── Real-time metrics (from native engine events) ──────────────────────
  cpuPercent:    number | null          // from profiler_update event
  memoryMB:      number | null          // from profiler_update event
  xrunCount:     number                 // cumulative buffer underruns

  // ── Audio config ─────────────────────────────────────────────────────────
  driver:        string | null
  sampleRate:    number | null
  bufferSize:    number | null
  latencyMs:     number | null          // driver-reported round-trip latency
}

// ─── AudioEngineProcess ───────────────────────────────────────────────────────

export class AudioEngineProcess extends EventEmitter {
  private _proc:        ChildProcess | null = null
  private _ready        = false
  private _cmdQueue:    EngineCommand[]     = []
  private _restarts     = 0
  private _stopping     = false
  private readonly _maxRestarts   = 5
  private readonly _maxQueueSize  = 64

  // ── Crash / uptime tracking ──────────────────────────────────────────────
  private _crashCount   = 0
  private _lastCrashAt: number | null   = null
  private _lastCrashCode: number | null = null
  private _lastCrashSig: string | null  = null
  private _recentCrashes: CrashEntry[]  = []
  private _startedAt: number | null     = null

  // ── Real-time metrics ────────────────────────────────────────────────────
  private _cpuPercent: number | null  = null
  private _memoryMB:   number | null  = null
  private _xrunCount   = 0

  // ── Config ───────────────────────────────────────────────────────────────
  private _driver:     string | null = null
  private _sampleRate: number | null = null
  private _bufferSize: number | null = null
  private _latencyMs:  number | null = null

  // ── Base status (set at start(), updated on lifecycle events) ───────────
  private _baseStatus: Pick<EngineStatus, 'mode' | 'binaryFound' | 'binaryPath' | 'checkedPaths' | 'platform'> = {
    mode:         'web-audio-fallback',
    binaryFound:  false,
    binaryPath:   null,
    checkedPaths: [],
    platform:     process.platform,
  }

  // ─── Public getters ────────────────────────────────────────────────────

  get ready(): boolean { return this._ready }

  get pid(): number | null { return this._proc?.pid ?? null }

  get crashCount(): number { return this._crashCount }

  /** Full live snapshot of the engine status — safe to serialise and send over IPC. */
  getStatus(): EngineStatus {
    const now = Date.now()
    return {
      ...this._baseStatus,
      pid:           this._proc?.pid ?? null,
      isRunning:     this._proc !== null && !this._proc.killed,
      uptimeSeconds: this._startedAt !== null ? Math.floor((now - this._startedAt) / 1000) : null,
      restarts:      this._restarts,
      crashCount:    this._crashCount,
      lastCrashAt:   this._lastCrashAt,
      lastCrashCode: this._lastCrashCode,
      lastCrashSig:  this._lastCrashSig,
      recentCrashes: this._recentCrashes.slice(-5),
      cpuPercent:    this._cpuPercent,
      memoryMB:      this._memoryMB,
      xrunCount:     this._xrunCount,
      driver:        this._driver,
      sampleRate:    this._sampleRate,
      bufferSize:    this._bufferSize,
      latencyMs:     this._latencyMs,
    }
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────

  async start(
    driver     = 'default',
    device     = '',
    sampleRate = 44100,
    bufferSize = 512,
  ): Promise<void> {
    if (this._proc) {
      console.warn('[AudioEngineProcess] start() called while process is already running')
      return
    }
    this._stopping  = false
    this._driver    = driver
    this._sampleRate = sampleRate
    this._bufferSize = bufferSize

    const { path: binaryPath, checkedPaths } = this._findBinary()

    if (!binaryPath) {
      this._baseStatus = {
        mode:         'web-audio-fallback',
        binaryFound:  false,
        binaryPath:   null,
        checkedPaths,
        platform:     process.platform,
      }
      console.warn(
        '\n[AudioEngineProcess] ⚠️  NATIVE AUDIO ENGINE BINARY NOT FOUND\n' +
        '  ┌─────────────────────────────────────────────────────────────────┐\n' +
        '  │  Falling back to Web Audio API.                                  │\n' +
        '  │  ASIO / WASAPI / CoreAudio output is NOT available.              │\n' +
        '  │  Latency and performance will be degraded.                        │\n' +
        '  └─────────────────────────────────────────────────────────────────┘\n' +
        '  Searched paths:\n' +
        checkedPaths.map(p => `    ✗ ${p}`).join('\n') + '\n' +
        '  Fix: run `cargo build --release` in native/audio-engine/ and restart.\n'
      )
      this._ready = true
      this.emit('ready')
      this.emit('engine-mode', this.getStatus())
      return
    }

    this._baseStatus = {
      mode:         'native',
      binaryFound:  true,
      binaryPath,
      checkedPaths,
      platform:     process.platform,
    }
    console.log(`[AudioEngineProcess] ✓ Binary found: ${binaryPath}`)
    this.emit('engine-mode', this.getStatus())

    const args = [
      '--driver',      driver,
      '--sample-rate', String(sampleRate),
      '--buffer-size', String(bufferSize),
    ]
    if (device) args.push('--device', device)

    console.log(`[AudioEngineProcess] Spawning: ${binaryPath} ${args.join(' ')}`)

    try {
      this._proc = spawn(binaryPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env:   { ...process.env, RUST_LOG: 'info' },
      })

      // 10s guard: if process doesn't send 'ready', assume it's stuck
      const readyTimeout = setTimeout(() => {
        if (!this._ready && this._proc) {
          console.error('[AudioEngineProcess] ⏱️  Ready timeout (10s) — killing stalled process')
          this._proc.kill('SIGKILL')
          this._proc = null
          this._ready = false
        }
      }, 10_000)

      this._proc.on('exit',  (code, sig) => { clearTimeout(readyTimeout); this._onExit(code, sig) })
      this._proc.on('error', (err)       => { clearTimeout(readyTimeout); this._onError(err) })

      if (this._proc.stderr) {
        this._proc.stderr.on('data', (d: Buffer) => {
          const line = d.toString().trim()
          if (line) console.log(`[audio-engine stderr] ${line}`)
        })
      }

      if (this._proc.stdout) {
        const rl = createInterface({ input: this._proc.stdout, crlfDelay: Infinity })
        rl.on('line', (line) => this._handleLine(line.trim()))
      }
    } catch (err) {
      console.error('[AudioEngineProcess] Spawn failed:', err)
      this._proc  = null
      this._ready = false
      throw err
    }
  }

  stop(): void {
    if (!this._proc) {
      this._ready    = false
      this._stopping = false
      return
    }

    this._ready    = false
    this._stopping = true

    try { this.send({ cmd: 'shutdown' }) } catch { /* already dead */ }

    const killTimeout = setTimeout(() => {
      if (this._proc) {
        console.warn('[AudioEngineProcess] Shutdown timeout — forcing SIGKILL')
        try { this._proc.kill('SIGKILL') } catch { /* already dead */ }
        this._proc = null
      }
    }, 2_000)

    this._proc?.once('exit', () => {
      clearTimeout(killTimeout)
      this._proc      = null
      this._startedAt = null
    })
  }

  // ─── Command sending ────────────────────────────────────────────────────

  send(cmd: EngineCommand): void {
    if (!this._ready) {
      if (this._restarts < this._maxRestarts && this._cmdQueue.length < this._maxQueueSize) {
        this._cmdQueue.push(cmd)
      } else if (this._cmdQueue.length >= this._maxQueueSize) {
        console.warn(`[AudioEngineProcess] Queue full (${this._maxQueueSize}) — dropping: ${cmd.cmd}`)
      }
      return
    }
    this._write(cmd)
  }

  // Convenience wrappers ──────────────────────────────────────────────────
  play():                                 void { this.send({ cmd: 'play' }) }
  stopPlayback():                         void { this.send({ cmd: 'stop' }) }
  pause():                                void { this.send({ cmd: 'pause' }) }
  seek(bar: number, beat = 1):            void { this.send({ cmd: 'seek', bar, beat }) }
  setBpm(bpm: number):                    void { this.send({ cmd: 'set_bpm', bpm }) }
  setTimeSig(num: number, den: number):   void { this.send({ cmd: 'set_time_sig', numerator: num, denominator: den }) }
  setLoop(enabled: boolean, s: number, e: number): void {
    this.send({ cmd: 'set_loop', enabled, start_bar: s, end_bar: e })
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
  removeTrack(id: string):                                         void { this.send({ cmd: 'remove_track', id }) }
  setTrackGain(id: string, db: number):                            void { this.send({ cmd: 'set_track_gain', id, db }) }
  setTrackPan(id: string, pan: number):                            void { this.send({ cmd: 'set_track_pan', id, pan }) }
  muteTrack(id: string, muted: boolean):                           void { this.send({ cmd: 'mute_track', id, muted }) }
  soloTrack(id: string, soloed: boolean):                          void { this.send({ cmd: 'solo_track', id, soloed }) }
  armTrack(id: string, armed: boolean):                            void { this.send({ cmd: 'arm_track', id, armed }) }
  addSend(from: string, to: string, gainDb = 0, preFader = false): void {
    this.send({ cmd: 'add_send', from_id: from, to_id: to, gain_db: gainDb, pre_fader: preFader })
  }

  // ─── Internal ───────────────────────────────────────────────────────────

  private _write(cmd: EngineCommand): void {
    if (!this._proc?.stdin?.writable) {
      console.warn('[AudioEngineProcess] stdin not writable — dropping:', cmd.cmd)
      return
    }
    try {
      this._proc.stdin.write(JSON.stringify(cmd) + '\n')
    } catch (err) {
      console.error('[AudioEngineProcess] Write error:', err, '— cmd:', cmd.cmd)
    }
  }

  private _handleLine(line: string): void {
    if (!line || !line.startsWith('{')) return
    try {
      const evt = JSON.parse(line) as EngineEvent
      if (!evt.event) return

      switch (evt.event) {
        case 'ready':
          this._ready     = true
          this._restarts  = 0
          this._startedAt = Date.now()
          // Flush buffered commands
          {
            const cmds = this._cmdQueue.splice(0)
            for (const cmd of cmds) this._write(cmd)
          }
          this.emit('ready')
          break

        case 'profiler_update':
          // { event: 'profiler_update', cpu_load: 0.12, xrun_count: 0, frame_variance: 0.0 }
          if (typeof evt.cpu_load      === 'number') this._cpuPercent = Math.round(evt.cpu_load * 100)
          if (typeof evt.xrun_count    === 'number') this._xrunCount  = evt.xrun_count as number
          if (typeof evt.memory_mb     === 'number') this._memoryMB   = evt.memory_mb as number
          if (typeof evt.latency_ms    === 'number') this._latencyMs  = evt.latency_ms as number
          break

        case 'engine_state':
          // { event: 'engine_state', driver: 'wasapi', sample_rate: 48000, buffer_size: 256 }
          if (typeof evt.driver      === 'string') this._driver     = evt.driver as string
          if (typeof evt.sample_rate === 'number') this._sampleRate = evt.sample_rate as number
          if (typeof evt.buffer_size === 'number') this._bufferSize = evt.buffer_size as number
          if (typeof evt.latency_ms  === 'number') this._latencyMs  = evt.latency_ms as number
          break
      }

      this.emit('event', evt)
      this.emit(evt.event, evt)  // named event for direct subscription
    } catch (err) {
      console.warn('[AudioEngineProcess] JSON parse error:', err instanceof Error ? err.message : String(err))
    }
  }

  private _onExit(code: number | null, signal: string | null): void {
    const pid = this._proc?.pid
    console.log(`[AudioEngineProcess] Exit — pid=${pid ?? '?'} code=${code} signal=${signal ?? 'none'}`)

    this._proc      = null
    this._ready     = false
    this._startedAt = null
    this._cpuPercent = null   // metrics stale after exit
    this.emit('exit', { code, signal })

    if (this._stopping) {
      console.log('[AudioEngineProcess] Intentional stop — no restart')
      this._stopping = false
      this._cmdQueue = []
      return
    }

    if (code === 0) {
      console.log('[AudioEngineProcess] Clean exit (code 0) — no restart')
      this._cmdQueue = []
      return
    }

    // ── Crash ─────────────────────────────────────────────────────────────
    this._crashCount++
    this._lastCrashAt   = Date.now()
    this._lastCrashCode = code
    this._lastCrashSig  = signal
    this._recentCrashes.push({ timestamp: this._lastCrashAt, code, signal, restartNum: this._restarts })
    if (this._recentCrashes.length > 10) this._recentCrashes.shift()
    this.emit('crash', { code, signal, crashCount: this._crashCount })
    console.error(
      `[AudioEngineProcess] 💥 CRASH #${this._crashCount} — ` +
      `code=${code} signal=${signal ?? 'none'} restarts=${this._restarts}/${this._maxRestarts}`
    )

    if (this._restarts >= this._maxRestarts) {
      console.error('[AudioEngineProcess] Max restarts reached — engine staying down')
      this._cmdQueue = []
      this.emit('max-restarts-exceeded')
      return
    }

    this._restarts++
    const delay = Math.min(1000 * Math.pow(1.5, this._restarts - 1), 10_000)
    console.log(
      `[AudioEngineProcess] Restarting in ${Math.round(delay)}ms ` +
      `(attempt ${this._restarts}/${this._maxRestarts})`
    )
    setTimeout(() => {
      this.start(this._driver ?? 'default', '', this._sampleRate ?? 44100, this._bufferSize ?? 512)
        .catch(e => {
          console.error('[AudioEngineProcess] Restart failed:', e)
          this.emit('error', e)
        })
    }, delay)
  }

  private _onError(err: Error): void {
    console.error('[AudioEngineProcess] Spawn error:', err.message)
    this.emit('error', err)
    // Spawn errors are not auto-restarted — likely a permissions/missing-file issue
  }

  private _findBinary(): ReturnType<typeof findEngineBinary> {
    const candidates = getEngineBinaryCandidates(app.getAppPath(), __dirname, process.platform)
    const result     = findEngineBinary(candidates)
    for (const p of result.checkedPaths) {
      console.log(`[AudioEngineProcess] ${p === result.path ? '✓' : '✗'} ${p}`)
    }
    return result
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _instance: AudioEngineProcess | null = null
export function getAudioEngineProcess(): AudioEngineProcess {
  if (!_instance) _instance = new AudioEngineProcess()
  return _instance
}
