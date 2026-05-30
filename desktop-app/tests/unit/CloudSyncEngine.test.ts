// ─── CloudSyncEngine.test.ts ──────────────────────────────────────────────────
// node --experimental-strip-types --test

import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { CloudSyncEngine } from '../../src/renderer/src/services/CloudSyncEngine.ts'

// ── Mock fetch setup ──────────────────────────────────────────────────────────

type MockFetch = (url: string, opts?: RequestInit) => Promise<Response>

function makeOkResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: () => Promise.resolve(JSON.stringify(body)),
    json: () => Promise.resolve(body),
  } as unknown as Response
}

function makeErrorResponse(status: number): Response {
  return {
    ok: false,
    status,
    text: () => Promise.resolve(`Error ${status}`),
    json: () => Promise.resolve({ error: `Error ${status}` }),
  } as unknown as Response
}

describe('CloudSyncEngine', () => {
  let engine: CloudSyncEngine

  beforeEach(() => {
    engine = new CloudSyncEngine({ apiUrl: 'http://localhost:4000', maxRetries: 3 })
    engine.setAuthToken('test-token')
  })

  it('getState() returns initial state', () => {
    const state = engine.getState()
    assert.equal(state.status, 'idle')
    assert.equal(state.lastSyncAt, null)
    assert.equal(state.pendingOps.length, 0)
    assert.equal(state.conflict, null)
    assert.equal(state.error, null)
  })

  it('queueOp adds op to pendingOps', () => {
    engine.queueOp({
      type: 'push-version',
      url: 'http://localhost:4000/api/save/proj1/versions',
      method: 'POST',
      payload: { data: 'test' },
      timestamp: Date.now(),
    })
    const state = engine.getState()
    assert.equal(state.pendingOps.length, 1)
    assert.equal(state.pendingOps[0]!.type, 'push-version')
    assert.equal(state.pendingOps[0]!.retryCount, 0)
    assert.ok(state.pendingOps[0]!.id)
  })

  it('onStateChange subscriber is called when state changes', () => {
    let callCount = 0
    let lastState = engine.getState()

    const unsub = engine.onStateChange((s) => {
      callCount++
      lastState = s
    })

    engine.queueOp({
      type: 'push-version',
      url: 'http://localhost:4000/api/save/proj1/versions',
      method: 'POST',
      payload: {},
      timestamp: Date.now(),
    })

    assert.ok(callCount > 0)
    assert.equal(lastState.pendingOps.length, 1)
    unsub()
  })

  it('onStateChange returns unsubscribe function', () => {
    let callCount = 0
    const unsub = engine.onStateChange(() => { callCount++ })
    engine.queueOp({
      type: 'test',
      url: 'http://x',
      method: 'POST',
      payload: {},
      timestamp: Date.now(),
    })
    assert.equal(callCount, 1)
    unsub()
    engine.queueOp({
      type: 'test',
      url: 'http://x',
      method: 'POST',
      payload: {},
      timestamp: Date.now(),
    })
    assert.equal(callCount, 1) // no more calls after unsubscribe
  })

  it('pushOfflineQueue clears ops on successful fetch', async () => {
    // Queue an op
    engine.queueOp({
      type: 'push-version',
      url: 'http://localhost:4000/api/save/proj1/versions',
      method: 'POST',
      payload: { data: {} },
      timestamp: Date.now(),
    })
    assert.equal(engine.getState().pendingOps.length, 1)

    // Mock successful fetch
    const mockFetch: MockFetch = async (_url, _opts) => {
      return makeOkResponse({ success: true, data: { id: 'v1' } })
    }
    global.fetch = mockFetch as typeof global.fetch

    await engine.pushOfflineQueue()
    assert.equal(engine.getState().pendingOps.length, 0)
    assert.equal(engine.getState().status, 'idle')
  })

  it('pushOfflineQueue increments retryCount and drops ops after maxRetries', async () => {
    engine.queueOp({
      type: 'push-version',
      url: 'http://localhost:4000/api/save/proj1/versions',
      method: 'POST',
      payload: {},
      timestamp: Date.now(),
    })

    // Mock failing fetch
    const mockFetch: MockFetch = async (_url, _opts) => {
      return makeErrorResponse(500)
    }
    global.fetch = mockFetch as typeof global.fetch

    // Run 3 retries — each call increments retryCount and keeps op until limit
    await engine.pushOfflineQueue()
    assert.equal(engine.getState().pendingOps.length, 1)
    assert.equal(engine.getState().pendingOps[0]!.retryCount, 1)

    await engine.pushOfflineQueue()
    assert.equal(engine.getState().pendingOps.length, 1)
    assert.equal(engine.getState().pendingOps[0]!.retryCount, 2)

    await engine.pushOfflineQueue()
    // retryCount hits 3 which equals maxRetries(3), op is dropped
    assert.equal(engine.getState().pendingOps.length, 0)
  })

  it('state transitions: idle → syncing → idle on successful push', async () => {
    const states: string[] = []
    engine.onStateChange((s) => states.push(s.status))

    const mockFetch: MockFetch = async (_url, _opts) => {
      return makeOkResponse({ data: { id: 'v1' } })
    }
    global.fetch = mockFetch as typeof global.fetch

    await engine.pushProjectVersion('proj1', { tracks: [] }, 'test label')

    assert.ok(states.includes('syncing'), 'should have entered syncing state')
    assert.equal(states[states.length - 1], 'idle', 'should end in idle state')
  })
})
