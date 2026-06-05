import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { AutoSaveEngine } from '../../src/renderer/src/audio/safety/AutoSaveEngine.ts'
import type { ProjectStoreState } from '../../src/renderer/src/audio/safety/ProjectSerializer.ts'

function makeState(bpm = 120): ProjectStoreState {
  return {
    bpm,
    tracks: [],
  }
}

// A no-op save function for tests (avoids real IPC)
async function mockSaveFn(_json: string, _meta: { projectId: string; projectName: string }): Promise<void> {
  // intentionally empty
}

describe('AutoSaveEngine', () => {
  let engine: AutoSaveEngine

  beforeEach(() => {
    engine = new AutoSaveEngine({ intervalMs: 100, enabled: true })
  })

  it('isRunning is false before start', () => {
    assert.equal(engine.isRunning, false)
  })

  it('isRunning is true after start, false after stop', () => {
    engine.start(() => makeState(), mockSaveFn)
    assert.equal(engine.isRunning, true)
    engine.stop()
    assert.equal(engine.isRunning, false)
  })

  it('forceSave returns SaveResult with success=true', async () => {
    const result = await engine.forceSave(() => makeState(), mockSaveFn)
    assert.equal(result.success, true)
    assert.ok(typeof result.timestamp === 'number')
    assert.ok(typeof result.snapshotId === 'string')
    assert.ok(result.snapshotId.length > 0)
  })

  it('onSaved subscriber is called after forceSave', async () => {
    let called = false
    engine.onSaved(() => { called = true })
    await engine.forceSave(() => makeState(), mockSaveFn)
    assert.equal(called, true)
  })

  it('onError is not called on successful forceSave', async () => {
    let errorCalled = false
    engine.onError(() => { errorCalled = true })
    await engine.forceSave(() => makeState(), mockSaveFn)
    assert.equal(errorCalled, false)
  })

  it('saveCount increments after each forceSave', async () => {
    assert.equal(engine.saveCount, 0)
    await engine.forceSave(() => makeState(), mockSaveFn)
    assert.equal(engine.saveCount, 1)
    await engine.forceSave(() => makeState(), mockSaveFn)
    assert.equal(engine.saveCount, 2)
  })

  it('forceSave works even when enabled=false (bypasses enabled flag)', async () => {
    engine.setEnabled(false)
    const result = await engine.forceSave(() => makeState(), mockSaveFn)
    assert.equal(result.success, true)
  })

  it('onSaved returns an unsubscribe function', async () => {
    let callCount = 0
    const unsub = engine.onSaved(() => { callCount++ })
    await engine.forceSave(() => makeState(), mockSaveFn)
    assert.equal(callCount, 1)
    unsub()
    await engine.forceSave(() => makeState(), mockSaveFn)
    // Still 1 — unsubscribed
    assert.equal(callCount, 1)
  })

  it('lastSaveTime is updated after forceSave', async () => {
    assert.equal(engine.lastSaveTime, 0)
    const before = Date.now()
    await engine.forceSave(() => makeState(), mockSaveFn)
    assert.ok(engine.lastSaveTime >= before)
  })

  it('stop is idempotent — calling stop twice does not throw', () => {
    engine.start(() => makeState(), mockSaveFn)
    engine.stop()
    assert.doesNotThrow(() => engine.stop())
    assert.equal(engine.isRunning, false)
  })
})
