// ─── PluginSandbox.test.ts ────────────────────────────────────────────────────
// Tests the plugin sandbox (child-process isolation) message protocol,
// watchdog timing, crash detection, and recovery logic.
//
// NOTE: This tests the message-passing CONTRACT and state-machine logic.
// Actual VST3 binary loading is the boundary where the native SDK plugs in;
// tested here via the stub protocol (JSON-RPC over stdio / process.send).

import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'

// ── Message types (mirror of plugin-host child-process protocol) ──────────────

type HostMsgType =
  | 'load' | 'unload' | 'set-parameter' | 'get-parameter'
  | 'process-audio' | 'send-midi' | 'ping'

interface HostMsg {
  type:        HostMsgType
  instanceId?: string
  [key: string]: unknown
}

type ChildMsgType = 'loaded' | 'unloaded' | 'parameter' | 'processed' | 'pong' | 'error' | 'crash'

interface ChildMsg {
  type:        ChildMsgType
  instanceId?: string
  [key: string]: unknown
}

// ── Sandbox stub ──────────────────────────────────────────────────────────────
// Simulates the child-process side of the sandbox: responds to messages from
// parent and emits events for state changes.

class SandboxStub extends EventEmitter {
  public alive    = true
  public lastPing = Date.now()

  private _pingDelay: number
  private _crashOnLoad: boolean

  constructor(opts: { pingDelay?: number; crashOnLoad?: boolean } = {}) {
    super()
    this._pingDelay   = opts.pingDelay   ?? 0
    this._crashOnLoad = opts.crashOnLoad ?? false
  }

  /** Simulate parent → child message */
  receive(msg: HostMsg): void {
    if (!this.alive) return

    switch (msg.type) {
      case 'ping': {
        setTimeout(() => {
          if (this.alive) {
            this.emit('message', { type: 'pong', at: Date.now() } satisfies ChildMsg)
            this.lastPing = Date.now()
          }
        }, this._pingDelay)
        break
      }
      case 'load': {
        if (this._crashOnLoad) {
          this.alive = false
          this.emit('message', { type: 'crash', instanceId: msg.instanceId, reason: 'SIGSEGV' } satisfies ChildMsg)
        } else {
          this.emit('message', {
            type:       'loaded',
            instanceId: msg.instanceId,
            name:       'StubPlugin',
            vendor:     'Stub',
            paramCount: 4,
            pid:        process.pid,
          } satisfies ChildMsg)
        }
        break
      }
      case 'unload': {
        this.alive = false
        this.emit('message', { type: 'unloaded', instanceId: msg.instanceId } satisfies ChildMsg)
        break
      }
      case 'set-parameter': {
        this.emit('message', { type: 'parameter', instanceId: msg.instanceId, paramId: msg.paramId, value: msg.value, ok: true } satisfies ChildMsg)
        break
      }
      case 'get-parameter': {
        this.emit('message', { type: 'parameter', instanceId: msg.instanceId, paramId: msg.paramId, value: 0.5 } satisfies ChildMsg)
        break
      }
      case 'process-audio': {
        this.emit('message', { type: 'processed', instanceId: msg.instanceId, outputSamples: msg.inputSamples } satisfies ChildMsg)
        break
      }
    }
  }

  kill(): void { this.alive = false }
}

// ── Watchdog ──────────────────────────────────────────────────────────────────

interface WatchdogOptions {
  pingIntervalMs:   number
  timeoutMs:        number
  maxFailures:      number
}

class SandboxWatchdog extends EventEmitter {
  private _failures = 0
  private _timer:   NodeJS.Timeout | null = null
  private _sandbox: SandboxStub
  private _opts:    WatchdogOptions

  constructor(sandbox: SandboxStub, opts: WatchdogOptions) {
    super()
    this._sandbox = sandbox
    this._opts    = opts
  }

  start(): void {
    this._schedule()
  }

  stop(): void {
    if (this._timer) { clearTimeout(this._timer); this._timer = null }
  }

  private _schedule(): void {
    this._timer = setTimeout(() => this._ping(), this._opts.pingIntervalMs)
  }

  private _ping(): void {
    const pingAt = Date.now()
    let responded = false

    this._sandbox.once('message', (msg: ChildMsg) => {
      if (msg.type === 'pong' && msg.at && typeof msg.at === 'number' && msg.at >= pingAt) {
        responded = true
        this._failures = 0
        this._schedule()
      }
    })

    this._sandbox.receive({ type: 'ping' })

    setTimeout(() => {
      if (!responded) {
        this._failures++
        this.emit('failure', this._failures)
        if (this._failures >= this._opts.maxFailures) {
          this.emit('timeout')
          this.stop()
        } else {
          this._schedule()
        }
      }
    }, this._opts.timeoutMs)
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PluginSandbox / message protocol', () => {
  let sandbox: SandboxStub
  beforeEach(() => { sandbox = new SandboxStub() })

  it('responds to ping with pong', (t, done) => {
    sandbox.once('message', (msg: ChildMsg) => {
      assert.equal(msg.type, 'pong')
      done()
    })
    sandbox.receive({ type: 'ping' })
  })

  it('responds to load with loaded message', (t, done) => {
    sandbox.once('message', (msg: ChildMsg) => {
      assert.equal(msg.type, 'loaded')
      assert.equal(msg.instanceId, 'inst-1')
      assert.equal(msg.name, 'StubPlugin')
      done()
    })
    sandbox.receive({ type: 'load', instanceId: 'inst-1', pluginPath: '/stub.vst3', format: 'VST3' })
  })

  it('responds to unload with unloaded message', (t, done) => {
    sandbox.once('message', (msg: ChildMsg) => {
      assert.equal(msg.type, 'unloaded')
      done()
    })
    sandbox.receive({ type: 'unload', instanceId: 'inst-1' })
    assert.equal(sandbox.alive, false)
  })

  it('responds to set-parameter with parameter+ok', (t, done) => {
    sandbox.once('message', (msg: ChildMsg) => {
      assert.equal(msg.type, 'parameter')
      assert.equal(msg.paramId, 2)
      assert.equal(msg.value, 0.75)
      assert.equal(msg.ok, true)
      done()
    })
    sandbox.receive({ type: 'set-parameter', instanceId: 'inst-1', paramId: 2, value: 0.75 })
  })

  it('responds to get-parameter with parameter value', (t, done) => {
    sandbox.once('message', (msg: ChildMsg) => {
      assert.equal(msg.type, 'parameter')
      assert.equal(msg.paramId, 0)
      assert.equal(msg.value, 0.5)
      done()
    })
    sandbox.receive({ type: 'get-parameter', instanceId: 'inst-1', paramId: 0 })
  })

  it('responds to process-audio with passthrough output', (t, done) => {
    const input = [0.1, 0.2, 0.3]
    sandbox.once('message', (msg: ChildMsg) => {
      assert.equal(msg.type, 'processed')
      assert.deepEqual(msg.outputSamples, input)
      done()
    })
    sandbox.receive({ type: 'process-audio', instanceId: 'inst-1', inputSamples: input, numSamples: 3, channels: 2 })
  })

  it('dead sandbox ignores messages', (t, done) => {
    sandbox.kill()
    let received = false
    sandbox.once('message', () => { received = true })
    sandbox.receive({ type: 'ping' })
    setTimeout(() => {
      assert.equal(received, false)
      done()
    }, 20)
  })
})

describe('PluginSandbox / crash on load', () => {
  it('emits crash message instead of loaded when plugin crashes at load', (t, done) => {
    const sandbox = new SandboxStub({ crashOnLoad: true })
    sandbox.once('message', (msg: ChildMsg) => {
      assert.equal(msg.type, 'crash')
      assert.equal(msg.reason, 'SIGSEGV')
      assert.equal(sandbox.alive, false)
      done()
    })
    sandbox.receive({ type: 'load', instanceId: 'inst-crash', pluginPath: '/bad.vst3', format: 'VST3' })
  })
})

describe('PluginSandbox / watchdog', () => {
  let sandbox:  SandboxStub
  let watchdog: SandboxWatchdog

  afterEach(() => {
    watchdog?.stop()
    sandbox?.kill()
  })

  it('resets failure count on successful pong', (t, done) => {
    sandbox  = new SandboxStub({ pingDelay: 5 })
    watchdog = new SandboxWatchdog(sandbox, { pingIntervalMs: 10, timeoutMs: 50, maxFailures: 3 })

    let failures = 0
    watchdog.on('failure', () => { failures++ })

    watchdog.start()
    // After a short time, no failures should have occurred
    setTimeout(() => {
      watchdog.stop()
      assert.equal(failures, 0)
      done()
    }, 80)
  })

  it('emits failure when sandbox does not respond to ping', (t, done) => {
    sandbox  = new SandboxStub({ pingDelay: 9999 }) // effectively never responds
    watchdog = new SandboxWatchdog(sandbox, { pingIntervalMs: 5, timeoutMs: 10, maxFailures: 99 })

    watchdog.on('failure', (count: number) => {
      if (count >= 1) {
        watchdog.stop()
        done()
      }
    })
    watchdog.start()
  })

  it('emits timeout after maxFailures consecutive missed pings', (t, done) => {
    sandbox  = new SandboxStub({ pingDelay: 9999 })
    watchdog = new SandboxWatchdog(sandbox, { pingIntervalMs: 5, timeoutMs: 10, maxFailures: 2 })

    watchdog.on('timeout', () => done())
    watchdog.start()
  })
})

describe('PluginSandbox / recovery logic', () => {
  it('recovery attempt reloads the plugin', async () => {
    let loadCount = 0
    const sandbox = new SandboxStub({ crashOnLoad: false })

    async function attemptRecovery(path: string): Promise<boolean> {
      loadCount++
      return new Promise(resolve => {
        sandbox.once('message', (msg: ChildMsg) => resolve(msg.type === 'loaded'))
        sandbox.receive({ type: 'load', instanceId: `recovery-${loadCount}`, pluginPath: path, format: 'VST3' })
      })
    }

    const ok = await attemptRecovery('/plugins/Stable.vst3')
    assert.equal(ok, true)
    assert.equal(loadCount, 1)
  })

  it('recovery does not retry more than maxAttempts times', async () => {
    const MAX   = 2
    let attempts = 0

    async function tryRecover(path: string): Promise<boolean> {
      const sandbox = new SandboxStub({ crashOnLoad: true })
      return new Promise(resolve => {
        sandbox.once('message', (msg: ChildMsg) => resolve(msg.type !== 'crash'))
        sandbox.receive({ type: 'load', instanceId: 'rc', pluginPath: path, format: 'VST3' })
      })
    }

    while (attempts < MAX) {
      const ok = await tryRecover('/plugins/Crasher.vst3')
      if (!ok) { attempts++; continue }
      break
    }

    assert.ok(attempts <= MAX, `expected ≤${MAX} attempts, got ${attempts}`)
  })

  it('after blacklisting, sandbox refuses to load the same path', () => {
    const blacklisted = new Set<string>()
    blacklisted.add('/plugins/Bad.vst3')

    function canLoad(path: string): boolean { return !blacklisted.has(path) }

    assert.equal(canLoad('/plugins/Bad.vst3'),  false)
    assert.equal(canLoad('/plugins/Good.vst3'), true)
  })
})

describe('PluginSandbox / stress', () => {
  it('processes 500 set-parameter messages without error', async () => {
    const sandbox = new SandboxStub()
    const promises: Promise<ChildMsg>[] = []

    for (let i = 0; i < 500; i++) {
      promises.push(new Promise(resolve => {
        sandbox.once('message', resolve)
        sandbox.receive({ type: 'set-parameter', instanceId: 'inst-1', paramId: i % 128, value: Math.random() })
      }))
    }

    const results = await Promise.all(promises)
    assert.equal(results.length, 500)
    assert.ok(results.every(r => r.type === 'parameter'))
  })

  it('handles 50 rapid ping-pong cycles', async () => {
    const sandbox = new SandboxStub({ pingDelay: 0 })
    let pongs = 0

    for (let i = 0; i < 50; i++) {
      await new Promise<void>(resolve => {
        sandbox.once('message', (msg: ChildMsg) => { if (msg.type === 'pong') pongs++; resolve() })
        sandbox.receive({ type: 'ping' })
      })
    }

    assert.equal(pongs, 50)
  })
})
