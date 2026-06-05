// ─── ProjectLifecycle.integration.test.ts ─────────────────────────────────────
// Integration tests for full project save/load/restore lifecycle.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  serializeProject,
  deserializeProject,
  validateSnapshot,
} from '../../src/renderer/src/audio/safety/ProjectSerializer'
import type { ProjectSnapshot, ProjectStoreState } from '../../src/renderer/src/audio/safety/ProjectSerializer'
import { computeChecksum, checksumObject } from '../../src/renderer/src/audio/safety/ProjectChecksum'
import { AutoSaveEngine } from '../../src/renderer/src/audio/safety/AutoSaveEngine'

function makeState(bpm: number = 140, tracks: ProjectStoreState['tracks'] = []): ProjectStoreState {
  return {
    bpm,
    tracks,
    masterVolume: 0,
    id: 'proj-test',
    name: 'Test Project',
  }
}

function makeValidSnapshot(): ProjectSnapshot {
  return serializeProject(makeState(120, []))
}

describe('ProjectLifecycle.integration', () => {
  it('serializeProject → deserializeProject round-trip preserves bpm', () => {
    const state = makeState(140)
    const snapshot = serializeProject(state)
    const json = JSON.stringify(snapshot)
    const restored = deserializeProject(json)

    assert.ok(restored !== null, 'Should deserialize successfully')
    assert.equal(restored!.bpm, 140, `Expected bpm=140, got ${restored!.bpm}`)
  })

  it('deserializeProject detects tampered checksum', () => {
    const state = makeState(140)
    const snapshot = serializeProject(state)
    let json = JSON.stringify(snapshot)

    // Mutate one character in the JSON (not the checksum field itself)
    json = json.replace('"bpm":140', '"bpm":141')

    const result = deserializeProject(json)
    assert.equal(result, null, 'Should return null for tampered data')
  })

  it('validateSnapshot rejects bpm=0', () => {
    const snapshot = makeValidSnapshot()
    const invalid = { ...snapshot, bpm: 0 }
    const result = validateSnapshot(invalid)
    assert.equal(result.valid, false, 'Should be invalid with bpm=0')
    assert.ok(result.errors.some(e => e.toLowerCase().includes('bpm')),
      'Errors should mention bpm')
  })

  it('validateSnapshot rejects missing tracks array', () => {
    const snapshot = makeValidSnapshot()
    // Cast to bypass TypeScript checking for the purpose of this test
    const invalid = { ...snapshot, tracks: undefined as unknown as ProjectSnapshot['tracks'] }
    const result = validateSnapshot(invalid)
    assert.equal(result.valid, false, 'Should be invalid without tracks')
    assert.ok(result.errors.some(e => e.toLowerCase().includes('tracks')),
      'Errors should mention tracks')
  })

  it('checksumObject is deterministic', () => {
    const obj = { bpm: 128, tracks: [{ id: 'a' }] }
    const c1 = checksumObject(obj)
    const c2 = checksumObject(obj)
    const c3 = checksumObject(obj)
    assert.equal(c1, c2, 'checksumObject should be deterministic')
    assert.equal(c2, c3, 'checksumObject should be deterministic')
  })

  it('checksumObject differs for different objects', () => {
    const c1 = checksumObject({ a: 1 })
    const c2 = checksumObject({ a: 2 })
    assert.notEqual(c1, c2, 'Different objects should produce different checksums')
  })

  it('AutoSaveEngine forceSave calls saveFn', async () => {
    const engine = new AutoSaveEngine({ intervalMs: 60000 })
    let saveCalled = false

    const mockSaveFn = async (_json: string, _meta: { projectId: string; projectName: string }): Promise<void> => {
      saveCalled = true
    }

    const state = makeState(128)
    await engine.forceSave(() => state, mockSaveFn)

    assert.ok(saveCalled, 'saveFn should have been called')
  })

  it('AutoSaveEngine: saveCount increments per forceSave', async () => {
    const engine = new AutoSaveEngine({ intervalMs: 60000 })
    const mockSaveFn = async (): Promise<void> => {}

    const state = makeState(128)
    assert.equal(engine.saveCount, 0, 'Initial saveCount should be 0')

    await engine.forceSave(() => state, mockSaveFn)
    await engine.forceSave(() => state, mockSaveFn)
    await engine.forceSave(() => state, mockSaveFn)

    assert.equal(engine.saveCount, 3, `Expected saveCount=3, got ${engine.saveCount}`)
  })

  it('AutoSaveEngine: onSaved fires per save', async () => {
    const engine = new AutoSaveEngine({ intervalMs: 60000 })
    let firedCount = 0

    engine.onSaved(() => { firedCount++ })

    const mockSaveFn = async (): Promise<void> => {}
    const state = makeState(128)

    await engine.forceSave(() => state, mockSaveFn)
    await engine.forceSave(() => state, mockSaveFn)

    assert.equal(firedCount, 2, `Expected onSaved to fire 2 times, fired ${firedCount}`)
  })

  it('AutoSaveEngine: change detection skips saveFn when state unchanged', async () => {
    const engine = new AutoSaveEngine({ intervalMs: 100 })
    let saveCallCount = 0

    const mockSaveFn = async (): Promise<void> => { saveCallCount++ }
    const state = makeState(128)

    // Start the engine with the current state as baseline
    engine.start(() => state, mockSaveFn)

    // Wait a bit — checksum has not changed so save should not fire
    await new Promise<void>(res => setTimeout(res, 250))

    engine.stop()

    // The checksum was set on start and hasn't changed, so saveFn should not have been called
    assert.equal(saveCallCount, 0, `saveFn should not be called when state unchanged, called ${saveCallCount} times`)
  })
})
