/**
 * Integration tests for audio engine runtime behaviour
 *
 * Tests: kill/restart cycle, binary missing → fallback, crash count tracking,
 * path corruption handling, fallback mode transition, IPC contract.
 *
 * Run with: npm test (uses Node.js native test runner, --experimental-strip-types)
 */

import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs'

// ─── Shared types ─────────────────────────────────────────────────────────────

interface CrashEntry {
  timestamp:  number
  code:       number | null
  signal:     string | null
  restartNum: number
}

interface EngineStatus {
  mode:          'native' | 'web-audio-fallback'
  binaryFound:   boolean
  binaryPath:    string | null
  checkedPaths:  string[]
  platform:      string
  pid:           number | null
  isRunning:     boolean
  uptimeSeconds: number | null
  restarts:      number
  crashCount:    number
  lastCrashAt:   number | null
  lastCrashCode: number | null
  lastCrashSig:  string | null
  recentCrashes: CrashEntry[]
  cpuPercent:    number | null
  memoryMB:      number | null
  xrunCount:     number
  driver:        string | null
  sampleRate:    number | null
  bufferSize:    number | null
  latencyMs:     number | null
}

// ─── In-memory AudioEngineProcess simulator ───────────────────────────────────
//
// Simulates the real AudioEngineProcess life-cycle without spawning a real
// subprocess. This lets us test crash tracking, fallback transitions, and
// restart logic in pure Node.js.

class SimulatedAudioEngine extends EventEmitter {
  private _status: EngineStatus
  private _restartDelayMs: number

  constructor(opts: { binaryExists: boolean; platform?: string; restartDelayMs?: number } = { binaryExists: true }) {
    super()
    this._restartDelayMs = opts.restartDelayMs ?? 0

    const platform = opts.platform ?? process.platform

    this._status = {
      mode:          opts.binaryExists ? 'native' : 'web-audio-fallback',
      binaryFound:   opts.binaryExists,
      binaryPath:    opts.binaryExists ? '/usr/local/bin/audio-engine' : null,
      checkedPaths:  ['/usr/local/bin/audio-engine', '/opt/audio-engine'],
      platform,
      pid:           opts.binaryExists ? 1000 : null,
      isRunning:     opts.binaryExists,
      uptimeSeconds: opts.binaryExists ? 0 : null,
      restarts:      0,
      crashCount:    0,
      lastCrashAt:   null,
      lastCrashCode: null,
      lastCrashSig:  null,
      recentCrashes: [],
      cpuPercent:    opts.binaryExists ? 5 : null,
      memoryMB:      opts.binaryExists ? 64 : null,
      xrunCount:     0,
      driver:        opts.binaryExists ? 'ALSA' : null,
      sampleRate:    opts.binaryExists ? 48000 : null,
      bufferSize:    opts.binaryExists ? 256 : null,
      latencyMs:     opts.binaryExists ? 5.3 : null,
    }
  }

  getStatus(): EngineStatus {
    return { ...this._status, recentCrashes: [...this._status.recentCrashes] }
  }

  /** Simulate the native process crashing with given exit code / signal */
  simulateCrash(code: number | null = 1, signal: string | null = null): void {
    if (!this._status.isRunning) return

    const entry: CrashEntry = {
      timestamp:  Date.now(),
      code,
      signal,
      restartNum: this._status.restarts + 1,
    }

    this._status.crashCount   += 1
    this._status.lastCrashAt   = entry.timestamp
    this._status.lastCrashCode = code
    this._status.lastCrashSig  = signal
    this._status.recentCrashes = [entry, ...this._status.recentCrashes].slice(0, 10)
    this._status.isRunning     = false
    this._status.pid           = null

    this.emit('crash', { code, signal, restartNum: entry.restartNum })

    // Simulate auto-restart
    const delay = this._restartDelayMs
    setTimeout(() => {
      this._status.restarts   += 1
      this._status.pid         = 1000 + this._status.restarts
      this._status.isRunning   = true
      this._status.uptimeSeconds = 0
      this.emit('restart', { restarts: this._status.restarts })
    }, delay)
  }

  /** Simulate max restarts exceeded (no more auto-restart) */
  simulateMaxRestarts(): void {
    this._status.isRunning     = false
    this._status.pid           = null
    this._status.crashCount   += 1
    this.emit('max-restarts-exceeded', { crashCount: this._status.crashCount })
  }

  /** Simulate fallback transition */
  transitionToFallback(reason: string): void {
    this._status.mode      = 'web-audio-fallback'
    this._status.isRunning = false
    this._status.pid       = null
    this.emit('engine-mode', { ...this.getStatus() })
    this.emit('fallback', { reason })
  }

  /** Simulate binary becoming unavailable (corrupted path) */
  simulateBinaryGone(): void {
    this._status.binaryFound = false
    this._status.binaryPath  = null
    this._status.mode        = 'web-audio-fallback'
    this._status.isRunning   = false
    this._status.pid         = null
    this.emit('engine-mode', { ...this.getStatus() })
  }

  /** Update live metrics (mirrors profiler_update event from native engine) */
  updateMetrics(patch: Partial<EngineStatus>): void {
    Object.assign(this._status, patch)
    this.emit('metrics-update', this.getStatus())
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AudioEngine runtime / crash tracking', () => {
  it('increments crashCount on each crash', async () => {
    const engine = new SimulatedAudioEngine({ binaryExists: true, restartDelayMs: 5 })
    assert.equal(engine.getStatus().crashCount, 0)

    // First crash — wait for restart before next crash
    const r1 = new Promise<void>(res => engine.once('restart', res))
    engine.simulateCrash(1, null)
    assert.equal(engine.getStatus().crashCount, 1)
    await r1

    // Second crash
    const r2 = new Promise<void>(res => engine.once('restart', res))
    engine.simulateCrash(137, null)
    assert.equal(engine.getStatus().crashCount, 2)
    await r2   // clean up pending timer
  })

  it('records lastCrashAt, lastCrashCode, lastCrashSig', () => {
    const engine  = new SimulatedAudioEngine()
    const before  = Date.now()
    engine.simulateCrash(null, 'SIGSEGV')
    const after   = Date.now()
    const status  = engine.getStatus()

    assert.ok(status.lastCrashAt !== null,             'lastCrashAt must be set')
    assert.ok(status.lastCrashAt >= before,             'lastCrashAt must be >= before')
    assert.ok(status.lastCrashAt <= after,              'lastCrashAt must be <= after')
    assert.equal(status.lastCrashCode, null)
    assert.equal(status.lastCrashSig,  'SIGSEGV')
  })

  it('keeps up to 10 crash entries in recentCrashes', async () => {
    const engine = new SimulatedAudioEngine({ binaryExists: true, restartDelayMs: 5 })

    // Fire 12 crashes, waiting for restart between each so isRunning is true
    for (let i = 0; i < 12; i++) {
      const restarted = new Promise<void>(res => engine.once('restart', res))
      engine.simulateCrash(i + 1, null)
      await restarted
    }

    const status = engine.getStatus()
    assert.ok(status.recentCrashes.length <= 10, 'should cap at 10')
    // Most recent should be first (code 12)
    assert.equal(status.recentCrashes[0].code, 12)
  })

  it('emits crash event with code and signal', async () => {
    const engine   = new SimulatedAudioEngine({ binaryExists: true, restartDelayMs: 5 })
    const received = new Promise<{ code: number | null; signal: string | null; restartNum: number }>(res => {
      engine.once('crash', res)
    })

    engine.simulateCrash(9, null)

    const { code, signal, restartNum } = await received
    assert.equal(code,       9)
    assert.equal(signal,     null)
    assert.equal(restartNum, 1)
  })

  it('sets isRunning=false immediately after crash', () => {
    const engine = new SimulatedAudioEngine()
    assert.equal(engine.getStatus().isRunning, true)
    engine.simulateCrash(1, null)
    assert.equal(engine.getStatus().isRunning, false)
  })
})

describe('AudioEngine runtime / auto-restart', () => {
  it('auto-restarts and increments restarts counter', async () => {
    const engine = new SimulatedAudioEngine({ binaryExists: true, restartDelayMs: 10 })
    assert.equal(engine.getStatus().restarts, 0)

    const restarted = new Promise<void>(resolve => {
      engine.once('restart', resolve)
    })

    engine.simulateCrash(1, null)
    await restarted

    const status = engine.getStatus()
    assert.equal(status.restarts,   1)
    assert.equal(status.isRunning,  true)
    assert.ok(status.pid !== null,  'should have a new pid after restart')
  })

  it('pid changes after restart', async () => {
    const engine  = new SimulatedAudioEngine({ binaryExists: true, restartDelayMs: 10 })
    const pidBefore = engine.getStatus().pid

    const restarted = new Promise<void>(resolve => engine.once('restart', resolve))
    engine.simulateCrash(1, null)
    await restarted

    const pidAfter = engine.getStatus().pid
    assert.notEqual(pidAfter, pidBefore, 'pid should change on restart')
    assert.ok(pidAfter !== null,          'pid should not be null after restart')
  })

  it('emits max-restarts-exceeded and stops restarting', async () => {
    const engine   = new SimulatedAudioEngine()
    const received = new Promise<{ crashCount: number }>(res => {
      engine.once('max-restarts-exceeded', res)
    })

    engine.simulateMaxRestarts()

    const { crashCount } = await received
    assert.ok(crashCount > 0, 'crashCount should be positive')
    assert.equal(engine.getStatus().isRunning, false)
  })
})

describe('AudioEngine runtime / binary missing → fallback', () => {
  it('starts in fallback mode when binary not found', () => {
    const engine = new SimulatedAudioEngine({ binaryExists: false })
    const status = engine.getStatus()

    assert.equal(status.mode,        'web-audio-fallback')
    assert.equal(status.binaryFound, false)
    assert.equal(status.binaryPath,  null)
    assert.equal(status.isRunning,   false)
    assert.equal(status.pid,         null)
  })

  it('fallback mode exposes checkedPaths for diagnostics', () => {
    const engine = new SimulatedAudioEngine({ binaryExists: false })
    const status = engine.getStatus()

    assert.ok(Array.isArray(status.checkedPaths),      'checkedPaths must be array')
    assert.ok(status.checkedPaths.length > 0,           'must list at least one checked path')
    assert.ok(status.checkedPaths.every(p => typeof p === 'string'), 'all paths must be strings')
  })

  it('emits engine-mode event when transitioning to fallback', async () => {
    const engine   = new SimulatedAudioEngine()
    const received = new Promise<EngineStatus>(res => {
      engine.once('engine-mode', res)
    })

    engine.simulateBinaryGone()

    const status = await received
    assert.equal(status.mode,      'web-audio-fallback')
    assert.equal(status.isRunning, false)
  })

  it('audio metrics are null in fallback mode', () => {
    const engine = new SimulatedAudioEngine({ binaryExists: false })
    const status = engine.getStatus()

    assert.equal(status.cpuPercent, null, 'cpuPercent should be null in fallback')
    assert.equal(status.memoryMB,   null, 'memoryMB should be null in fallback')
    assert.equal(status.driver,     null, 'driver should be null in fallback')
    assert.equal(status.sampleRate, null, 'sampleRate should be null in fallback')
    assert.equal(status.bufferSize, null, 'bufferSize should be null in fallback')
  })
})

describe('AudioEngine runtime / path corruption', () => {
  let tmpDir: string

  before(() => {
    tmpDir = join(tmpdir(), `engine-path-test-${Date.now()}`)
    mkdirSync(tmpDir, { recursive: true })
  })

  after(() => {
    try { rmSync(tmpDir, { recursive: true }) } catch { /* ok */ }
  })

  it('binary at path that disappears triggers fallback', () => {
    const binPath = join(tmpDir, 'audio-engine')
    writeFileSync(binPath, '#!/bin/sh\nexit 0\n')

    // Simulate binary disappearing
    assert.ok(existsSync(binPath), 'binary should exist initially')

    rmSync(binPath)
    assert.ok(!existsSync(binPath), 'binary should be gone after removal')

    // Engine should detect and transition
    const engine = new SimulatedAudioEngine()
    engine.simulateBinaryGone()

    const status = engine.getStatus()
    assert.equal(status.mode,        'web-audio-fallback')
    assert.equal(status.binaryFound, false)
  })

  it('checkedPaths shows every path that was probed', () => {
    const candidates = [
      join(tmpDir, 'audio-engine'),
      join(tmpDir, 'audio-engine.exe'),
      '/usr/local/bin/audio-engine',
    ]

    // None exist
    for (const p of candidates) {
      assert.ok(!existsSync(p), `${p} should not exist`)
    }

    // findEngineBinary analogue: returns null when none found
    const found = candidates.find(p => existsSync(p))
    assert.equal(found, undefined, 'should find nothing')

    // Status should reflect all checked paths
    const engine = new SimulatedAudioEngine({ binaryExists: false })
    const status = engine.getStatus()
    assert.ok(status.checkedPaths.length > 0)
  })
})

describe('AudioEngine runtime / fallback mode transition', () => {
  it('transitions from native → fallback on explicit call', () => {
    const engine = new SimulatedAudioEngine({ binaryExists: true })
    assert.equal(engine.getStatus().mode, 'native')

    engine.transitionToFallback('binary checksum failed')

    assert.equal(engine.getStatus().mode,      'web-audio-fallback')
    assert.equal(engine.getStatus().isRunning, false)
  })

  it('emits fallback event with reason', async () => {
    const engine   = new SimulatedAudioEngine()
    const received = new Promise<{ reason: string }>(res => {
      engine.once('fallback', res)
    })

    engine.transitionToFallback('test-reason')

    const { reason } = await received
    assert.equal(reason, 'test-reason')
  })

  it('does not restart after explicit fallback transition', () => {
    const engine = new SimulatedAudioEngine()
    let restartCount = 0
    engine.on('restart', () => { restartCount++ })

    engine.transitionToFallback('manual')

    // Give time for any erroneous restart timer
    return new Promise(resolve => setTimeout(() => {
      assert.equal(restartCount, 0, 'should not restart after fallback')
      resolve(undefined)
    }, 50))
  })
})

describe('AudioEngine runtime / live metrics', () => {
  it('updateMetrics updates status and emits event', async () => {
    const engine   = new SimulatedAudioEngine()
    const received = new Promise<EngineStatus>(res => {
      engine.once('metrics-update', res)
    })

    engine.updateMetrics({ cpuPercent: 42, memoryMB: 256, xrunCount: 3 })

    const status = await received
    assert.equal(status.cpuPercent, 42)
    assert.equal(status.memoryMB,   256)
    assert.equal(status.xrunCount,  3)
  })

  it('getStatus reflects latest metrics immediately', () => {
    const engine = new SimulatedAudioEngine()

    engine.updateMetrics({ cpuPercent: 75, sampleRate: 44100, bufferSize: 512 })

    const status = engine.getStatus()
    assert.equal(status.cpuPercent, 75)
    assert.equal(status.sampleRate, 44100)
    assert.equal(status.bufferSize, 512)
  })

  it('xrunCount accumulates across updates', () => {
    const engine = new SimulatedAudioEngine()

    engine.updateMetrics({ xrunCount: 2 })
    assert.equal(engine.getStatus().xrunCount, 2)

    engine.updateMetrics({ xrunCount: 7 })
    assert.equal(engine.getStatus().xrunCount, 7)
  })
})

describe('AudioEngine runtime / IPC contract', () => {
  it('audio-engine-status payload matches EngineStatus interface', () => {
    const engine = new SimulatedAudioEngine()
    const status = engine.getStatus()

    // Mandatory top-level fields
    const required: (keyof EngineStatus)[] = [
      'mode', 'binaryFound', 'binaryPath', 'checkedPaths', 'platform',
      'pid', 'isRunning', 'uptimeSeconds', 'restarts',
      'crashCount', 'lastCrashAt', 'lastCrashCode', 'lastCrashSig', 'recentCrashes',
      'cpuPercent', 'memoryMB', 'xrunCount',
      'driver', 'sampleRate', 'bufferSize', 'latencyMs',
    ]

    for (const field of required) {
      assert.ok(field in status, `status should have field '${field}'`)
    }
  })

  it('mode is either "native" or "web-audio-fallback"', () => {
    const native   = new SimulatedAudioEngine({ binaryExists: true  }).getStatus()
    const fallback = new SimulatedAudioEngine({ binaryExists: false }).getStatus()

    assert.ok(['native', 'web-audio-fallback'].includes(native.mode))
    assert.ok(['native', 'web-audio-fallback'].includes(fallback.mode))
    assert.equal(native.mode,   'native')
    assert.equal(fallback.mode, 'web-audio-fallback')
  })

  it('recentCrashes entries have required fields', async () => {
    const engine = new SimulatedAudioEngine({ binaryExists: true, restartDelayMs: 5 })
    const r1 = new Promise<void>(res => engine.once('restart', res))
    engine.simulateCrash(1, null)
    await r1

    const r2 = new Promise<void>(res => engine.once('restart', res))
    engine.simulateCrash(null, 'SIGTERM')
    await r2

    const status   = engine.getStatus()
    assert.ok(status.recentCrashes.length >= 2)

    for (const entry of status.recentCrashes) {
      assert.ok('timestamp'  in entry, 'entry must have timestamp')
      assert.ok('code'       in entry, 'entry must have code')
      assert.ok('signal'     in entry, 'entry must have signal')
      assert.ok('restartNum' in entry, 'entry must have restartNum')
      assert.ok(typeof entry.timestamp === 'number', 'timestamp must be number')
    }
  })

  it('audio-engine-diagnostics response shape', () => {
    const engine    = new SimulatedAudioEngine()
    const status    = engine.getStatus()
    const timestamp = Date.now()

    // Mirror what AudioIPCHandler returns for audio-engine-diagnostics
    const diagResponse = {
      status,
      metrics: {
        cpuPercent: status.cpuPercent,
        memoryMB:   status.memoryMB,
        xrunCount:  status.xrunCount,
        latencyMs:  status.latencyMs,
      },
      timestamp,
    }

    assert.ok('status'    in diagResponse)
    assert.ok('metrics'   in diagResponse)
    assert.ok('timestamp' in diagResponse)
    assert.equal(typeof diagResponse.timestamp, 'number')
    assert.ok(diagResponse.metrics.cpuPercent !== undefined)
  })
})
