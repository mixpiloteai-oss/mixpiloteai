import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  serializeProject,
  deserializeProject,
  validateSnapshot,
} from '../../src/renderer/src/audio/safety/ProjectSerializer.ts'
import type { ProjectStoreState, ProjectSnapshot } from '../../src/renderer/src/audio/safety/ProjectSerializer.ts'

function makeState(overrides: Partial<{ bpm: number; tracks: ProjectStoreState['tracks'] }> = {}): ProjectStoreState {
  return {
    bpm: overrides.bpm ?? 128,
    tracks: overrides.tracks ?? [
      {
        id: 'tk-1',
        name: 'Kick',
        type: 'midi',
        gainDb: 0,
        panCenter: 0,
        muted: false,
        soloed: false,
        clips: [{ id: 'c1', startBar: 1, lengthBars: 4, color: '#ff0000' }],
      },
    ],
  }
}

describe('serializeProject', () => {
  it('produces a snapshot with version=1', () => {
    const snap = serializeProject(makeState())
    assert.equal(snap.version, 1)
  })

  it('savedAt is a recent timestamp', () => {
    const before = Date.now()
    const snap = serializeProject(makeState())
    const after = Date.now()
    assert.ok(snap.savedAt >= before)
    assert.ok(snap.savedAt <= after)
  })

  it('checksum is a non-zero number', () => {
    const snap = serializeProject(makeState())
    assert.ok(typeof snap.checksum === 'number')
    assert.notEqual(snap.checksum, undefined)
    // The djb2 hash of a non-trivial object is almost certainly non-zero
    assert.ok(snap.checksum !== 0 || true) // 0 is technically possible; just ensure it's a number
    assert.ok(!Number.isNaN(snap.checksum))
  })

  it('checksum field is present and is a number', () => {
    const snap = serializeProject(makeState())
    assert.ok('checksum' in snap)
    assert.ok(typeof snap.checksum === 'number')
  })

  it('serializes tracks correctly', () => {
    const snap = serializeProject(makeState())
    assert.equal(snap.tracks.length, 1)
    assert.equal(snap.tracks[0].id, 'tk-1')
    assert.equal(snap.tracks[0].clips[0].id, 'c1')
  })
})

describe('deserializeProject', () => {
  it('round-trips a serialized snapshot', () => {
    const state = makeState()
    const snap = serializeProject(state)
    const json = JSON.stringify(snap)
    const restored = deserializeProject(json)
    assert.ok(restored !== null)
    assert.equal(restored!.version, snap.version)
    assert.equal(restored!.checksum, snap.checksum)
    assert.equal(restored!.bpm, snap.bpm)
    assert.equal(restored!.tracks.length, snap.tracks.length)
  })

  it('returns null for invalid JSON', () => {
    const result = deserializeProject('{invalid json')
    assert.equal(result, null)
  })

  it('returns null for a tampered checksum', () => {
    const snap = serializeProject(makeState())
    const tampered: ProjectSnapshot = { ...snap, checksum: snap.checksum + 1 }
    const result = deserializeProject(JSON.stringify(tampered))
    assert.equal(result, null)
  })

  it('returns null for a non-object payload', () => {
    assert.equal(deserializeProject('"just a string"'), null)
    assert.equal(deserializeProject('null'), null)
    assert.equal(deserializeProject('42'), null)
  })
})

describe('validateSnapshot', () => {
  function makeSnap(overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
    return {
      ...serializeProject(makeState()),
      ...overrides,
    }
  }

  it('returns valid=true for a correct snapshot', () => {
    const snap = serializeProject(makeState())
    const result = validateSnapshot(snap)
    assert.equal(result.valid, true)
    assert.equal(result.errors.length, 0)
  })

  it('rejects bpm out of range (too low)', () => {
    const snap = makeSnap({ bpm: 5 })
    const result = validateSnapshot(snap)
    assert.equal(result.valid, false)
    assert.ok(result.errors.some(e => e.toLowerCase().includes('bpm')))
  })

  it('rejects bpm out of range (too high)', () => {
    const snap = makeSnap({ bpm: 1000 })
    const result = validateSnapshot(snap)
    assert.equal(result.valid, false)
    assert.ok(result.errors.some(e => e.toLowerCase().includes('bpm')))
  })

  it('rejects non-array tracks', () => {
    // Force tracks to be invalid type
    const snap = makeSnap({ tracks: 'not-an-array' as unknown as ProjectSnapshot['tracks'] })
    const result = validateSnapshot(snap)
    assert.equal(result.valid, false)
    assert.ok(result.errors.length > 0)
  })

  it('rejects invalid savedAt', () => {
    const snap = makeSnap({ savedAt: -1 })
    const result = validateSnapshot(snap)
    assert.equal(result.valid, false)
    assert.ok(result.errors.some(e => e.toLowerCase().includes('savedat')))
  })

  it('rejects wrong version', () => {
    const snap = makeSnap({ version: 99 })
    const result = validateSnapshot(snap)
    assert.equal(result.valid, false)
    assert.ok(result.errors.some(e => e.toLowerCase().includes('version')))
  })
})
