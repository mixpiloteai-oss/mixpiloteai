// ─── VstSandboxManager.test.ts ────────────────────────────────────────────────
// Tests VstSandboxManager using an injectable mock ChildProcess factory
// so we don't need real child processes in unit tests.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import type { ChildProcess } from 'node:child_process'
import { VstSandboxManager } from '../../src/main/vst/VstSandbox.ts'

// ── Mock ChildProcess ─────────────────────────────────────────────────────────

class MockChildProcess extends EventEmitter {
  pid: number
  killed = false
  stderr: EventEmitter

  private _sendCallback: null | ((msg: unknown) => void) = null

  constructor(pid: number) {
    super()
    this.pid = pid
    this.stderr = new EventEmitter()
  }

  send(msg: unknown, cb?: (err: Error | null) => void): boolean {
    if (cb) cb(null)
    if (this._sendCallback) {
      this._sendCallback(msg)
    }
    return true
  }

  kill(_signal?: string): boolean {
    this.killed = true
    return true
  }

  onSend(cb: (msg: unknown) => void): void {
    this._sendCallback = cb
  }

  // Simulate sending a message back to the parent
  simulateMessage(msg: unknown): void {
    this.emit('message', msg)
  }

  // Simulate worker exit
  simulateExit(code: number | null = 1, signal: string | null = null): void {
    this.emit('exit', code, signal)
  }
}

let pidCounter = 10000
function mockSpawnFn(_path: string): ChildProcess {
  return new MockChildProcess(++pidCounter) as unknown as ChildProcess
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('VstSandboxManager.spawnWorker', () => {
  it('creates a WorkerHandle with instanceId and pluginId', () => {
    const manager = new VstSandboxManager(mockSpawnFn, '/fake/worker.js')
    const handle = manager.spawnWorker('inst_001', 'synth-pro')

    assert.strictEqual(handle.instanceId, 'inst_001')
    assert.strictEqual(handle.pluginId, 'synth-pro')
    assert.ok(handle.process !== null)
    assert.ok(handle.pendingRequests instanceof Map)
  })

  it('initial status is spawning', () => {
    const manager = new VstSandboxManager(mockSpawnFn, '/fake/worker.js')
    const handle = manager.spawnWorker('inst_002', 'reverb-fx')
    assert.strictEqual(handle.status, 'spawning')
  })

  it('getWorker returns the handle by instanceId', () => {
    const manager = new VstSandboxManager(mockSpawnFn, '/fake/worker.js')
    manager.spawnWorker('inst_003', 'delay-fx')
    const retrieved = manager.getWorker('inst_003')
    assert.ok(retrieved !== undefined)
    assert.strictEqual(retrieved.instanceId, 'inst_003')
  })

  it('getWorker returns undefined for unknown instanceId', () => {
    const manager = new VstSandboxManager(mockSpawnFn, '/fake/worker.js')
    const result = manager.getWorker('nonexistent')
    assert.strictEqual(result, undefined)
  })
})

describe('VstSandboxManager.terminateWorker', () => {
  it('terminateWorker changes status to terminated', () => {
    const manager = new VstSandboxManager(mockSpawnFn, '/fake/worker.js')
    const handle = manager.spawnWorker('inst_term', 'synth')
    manager.terminateWorker('inst_term')
    // After termination the worker is removed from the map
    const retrieved = manager.getWorker('inst_term')
    assert.strictEqual(retrieved, undefined, 'Worker should be removed after termination')
    // Status was set to terminated on the handle reference
    assert.strictEqual(handle.status, 'terminated')
  })

  it('terminateWorker is safe to call on unknown instanceId', () => {
    const manager = new VstSandboxManager(mockSpawnFn, '/fake/worker.js')
    assert.doesNotThrow(() => manager.terminateWorker('does-not-exist'))
  })

  it('terminateWorker rejects pending requests', async () => {
    const manager = new VstSandboxManager(mockSpawnFn, '/fake/worker.js')
    manager.spawnWorker('inst_reject', 'synth')

    // Start a request but don't resolve it
    const requestPromise = manager.sendRequest(
      'inst_reject',
      'GetParameter',
      { instanceId: 'inst_reject', paramId: 0 },
      5000,
    )

    // Terminate the worker synchronously — this should reject the promise
    manager.terminateWorker('inst_reject')

    await assert.rejects(requestPromise, (err: Error) => {
      assert.ok(
        err.message.includes('terminated') || err.message.includes('inst_reject'),
        `Got: ${err.message}`
      )
      return true
    })
  })
})

describe('VstSandboxManager.sendRequest timeout', () => {
  it('times out when worker does not respond within timeoutMs', async () => {
    const manager = new VstSandboxManager(mockSpawnFn, '/fake/worker.js')
    manager.spawnWorker('inst_timeout', 'synth')

    await assert.rejects(
      manager.sendRequest('inst_timeout', 'GetParameter', { instanceId: 'inst_timeout' }, 50),
      (err: Error) => {
        assert.ok(
          err.message.includes('timed out') || err.message.includes('terminated'),
          `Got: ${err.message}`
        )
        return true
      }
    )
  })

  it('sends correct requestId structure in message', async () => {
    const manager = new VstSandboxManager(mockSpawnFn, '/fake/worker.js')
    const handle = manager.spawnWorker('inst_msg', 'synth')
    const mockProc = handle.process as unknown as MockChildProcess

    // Set up the mock to auto-respond
    mockProc.onSend((msg: unknown) => {
      const m = msg as Record<string, unknown>
      // Verify message structure
      assert.ok(typeof m['requestId'] === 'string', 'requestId should be a string')
      assert.ok(
        (m['requestId'] as string).startsWith('req_'),
        `requestId should start with req_, got: ${m['requestId']}`
      )
      assert.strictEqual(m['type'], 'Ping')

      // Respond back
      setImmediate(() => {
        mockProc.simulateMessage({
          type: 'response',
          requestId: m['requestId'],
          payload: { pong: true },
        })
      })
    })

    const result = await manager.sendRequest('inst_msg', 'Ping', {}, 1000)
    const r = result as Record<string, unknown>
    assert.strictEqual(r['pong'], true)
  })
})

describe('VstSandboxManager MAX_WORKERS enforcement', () => {
  it('throws when trying to spawn more than MAX_WORKERS workers', () => {
    const manager = new VstSandboxManager(mockSpawnFn, '/fake/worker.js')
    const max = VstSandboxManager.MAX_WORKERS

    for (let i = 0; i < max; i++) {
      manager.spawnWorker(`inst_max_${i}`, 'synth')
    }

    assert.throws(
      () => manager.spawnWorker('inst_overflow', 'synth'),
      (err: Error) => {
        assert.ok(
          err.message.includes(`${max}`) || err.message.includes('Maximum'),
          `Error should mention limit. Got: ${err.message}`
        )
        return true
      }
    )
  })

  it('MAX_WORKERS is 16', () => {
    assert.strictEqual(VstSandboxManager.MAX_WORKERS, 16)
  })
})

describe('VstSandboxManager worker crash handling', () => {
  it('marks worker as crashed on exit event', () => {
    const manager = new VstSandboxManager(mockSpawnFn, '/fake/worker.js')
    const handle = manager.spawnWorker('inst_crash', 'synth')
    const mockProc = handle.process as unknown as MockChildProcess

    mockProc.simulateExit(1, null)

    assert.strictEqual(handle.status, 'crashed')
  })

  it('marks worker as crashed on crash message', () => {
    const manager = new VstSandboxManager(mockSpawnFn, '/fake/worker.js')
    const handle = manager.spawnWorker('inst_crash_msg', 'synth')
    const mockProc = handle.process as unknown as MockChildProcess

    mockProc.simulateMessage({ type: 'crash', error: 'SIGSEGV' })

    assert.strictEqual(handle.status, 'crashed')
  })

  it('rejects pending requests when worker crashes', async () => {
    const manager = new VstSandboxManager(mockSpawnFn, '/fake/worker.js')
    const handle = manager.spawnWorker('inst_crash_req', 'synth')
    const mockProc = handle.process as unknown as MockChildProcess

    const p = manager.sendRequest('inst_crash_req', 'GetParameter', {}, 5000)

    // Simulate crash after request sent
    setImmediate(() => mockProc.simulateExit(1))

    await assert.rejects(p, (err: Error) => {
      assert.ok(err.message.length > 0)
      return true
    })
  })
})

describe('VstSandboxManager.createProcess (legacy API)', () => {
  it('createProcess returns a SandboxProcess with correct fields', () => {
    const manager = new VstSandboxManager(mockSpawnFn, '/fake/worker.js')
    const proc = manager.createProcess('synth-plugin', 'inst_legacy')
    assert.strictEqual(proc.pluginId, 'synth-plugin')
    assert.strictEqual(proc.instanceId, 'inst_legacy')
    assert.ok(proc.pid > 0)
  })

  it('getProcess returns the SandboxProcess by instanceId', () => {
    const manager = new VstSandboxManager(mockSpawnFn, '/fake/worker.js')
    manager.createProcess('eq-plugin', 'inst_gp')
    const proc = manager.getProcess('inst_gp')
    assert.ok(proc !== undefined)
    assert.strictEqual(proc.pluginId, 'eq-plugin')
  })

  it('terminateProcess removes the process', () => {
    const manager = new VstSandboxManager(mockSpawnFn, '/fake/worker.js')
    manager.createProcess('comp-plugin', 'inst_term_legacy')
    manager.terminateProcess('inst_term_legacy')
    const proc = manager.getProcess('inst_term_legacy')
    assert.strictEqual(proc, undefined)
  })

  it('getAllProcesses returns all active processes', () => {
    const manager = new VstSandboxManager(mockSpawnFn, '/fake/worker.js')
    manager.createProcess('p1', 'inst_b1')
    manager.createProcess('p2', 'inst_b2')
    const all = manager.getAllProcesses()
    assert.strictEqual(all.length, 2)
  })
})
