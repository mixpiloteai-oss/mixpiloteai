// ─── TakeManager.test.ts ──────────────────────────────────────────────────────

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TakeManager } from '../../src/renderer/src/audio/recording/TakeManager.ts'
import type { RecordingResult } from '../../src/renderer/src/audio/recording/TakeManager.ts'

function makeResult(overrides?: Partial<RecordingResult>): RecordingResult {
  return {
    filePath: '/tmp/test.wav',
    durationSamples: 44100,
    sampleRate: 44100,
    channelCount: 2,
    takeNumber: 1,
    ...overrides,
  }
}

describe('TakeManager / addTake increments takeNumber per track', () => {
  it('1st take → takeNumber=1, 2nd → takeNumber=2', () => {
    const tm = new TakeManager()
    const t1 = tm.addTake('tk-kick', makeResult())
    const t2 = tm.addTake('tk-kick', makeResult())
    assert.equal(t1.takeNumber, 1)
    assert.equal(t2.takeNumber, 2)
  })
})

describe('TakeManager / addTake sets new take as active', () => {
  it('active take is the most recently added', () => {
    const tm = new TakeManager()
    tm.addTake('tk-kick', makeResult())
    const t2 = tm.addTake('tk-kick', makeResult())
    const active = tm.getActiveTake('tk-kick')
    assert.ok(active !== null)
    assert.equal(active!.id, t2.id)
  })
})

describe('TakeManager / getTakes returns takes in insertion order', () => {
  it('three takes come back in order', () => {
    const tm = new TakeManager()
    const t1 = tm.addTake('tk-snare', makeResult())
    const t2 = tm.addTake('tk-snare', makeResult())
    const t3 = tm.addTake('tk-snare', makeResult())
    const takes = tm.getTakes('tk-snare')
    assert.equal(takes.length, 3)
    assert.equal(takes[0].id, t1.id)
    assert.equal(takes[1].id, t2.id)
    assert.equal(takes[2].id, t3.id)
  })
})

describe('TakeManager / getActiveTake returns null for unknown track', () => {
  it('unknown track → null', () => {
    const tm = new TakeManager()
    assert.equal(tm.getActiveTake('nonexistent'), null)
  })
})

describe('TakeManager / setActiveTake / getActiveTake round-trip', () => {
  it('sets and retrieves active take', () => {
    const tm = new TakeManager()
    const t1 = tm.addTake('tk-bass', makeResult())
    const t2 = tm.addTake('tk-bass', makeResult())
    // t2 is active by default; switch to t1
    tm.setActiveTake('tk-bass', t1.id)
    const active = tm.getActiveTake('tk-bass')
    assert.ok(active !== null)
    assert.equal(active!.id, t1.id)
  })
})

describe('TakeManager / deleteTake removes from list', () => {
  it('take is gone after delete', () => {
    const tm = new TakeManager()
    const t1 = tm.addTake('tk-vox', makeResult())
    const t2 = tm.addTake('tk-vox', makeResult())
    tm.deleteTake('tk-vox', t1.id)
    const takes = tm.getTakes('tk-vox')
    assert.equal(takes.length, 1)
    assert.equal(takes[0].id, t2.id)
  })
})

describe('TakeManager / deleting active take falls back to last remaining', () => {
  it('deleting the active take sets active to the previous take', () => {
    const tm = new TakeManager()
    const t1 = tm.addTake('tk-vox', makeResult())
    const t2 = tm.addTake('tk-vox', makeResult())
    const t3 = tm.addTake('tk-vox', makeResult())
    // t3 is active; delete t3
    tm.deleteTake('tk-vox', t3.id)
    const active = tm.getActiveTake('tk-vox')
    assert.ok(active !== null)
    // Should fall back to t2 (idx 1, before deleted idx 2 → newIdx = max(0, 2-1) = 1)
    assert.equal(active!.id, t2.id)
  })
})

describe('TakeManager / deleting all takes sets active to null', () => {
  it('single take deleted → active is null', () => {
    const tm = new TakeManager()
    const t1 = tm.addTake('tk-piano', makeResult())
    tm.deleteTake('tk-piano', t1.id)
    assert.equal(tm.getActiveTake('tk-piano'), null)
    assert.equal(tm.getTakeCount('tk-piano'), 0)
  })
})

describe('TakeManager / take IDs are unique', () => {
  it('two takes on different tracks with same takeNumber have different IDs', () => {
    const tm = new TakeManager()
    const t1 = tm.addTake('tk-a', makeResult())
    const t2 = tm.addTake('tk-b', makeResult())
    assert.equal(t1.takeNumber, 1)
    assert.equal(t2.takeNumber, 1)
    assert.notEqual(t1.id, t2.id)
  })
})

describe('TakeManager / getTakeCount', () => {
  it('returns 0 for unknown track', () => {
    const tm = new TakeManager()
    assert.equal(tm.getTakeCount('nonexistent'), 0)
  })
})

describe('TakeManager / renameTake', () => {
  it('changes label without affecting other fields', () => {
    const tm = new TakeManager()
    const t1 = tm.addTake('tk-gtr', makeResult())
    const originalPath = t1.filePath
    tm.renameTake('tk-gtr', t1.id, 'Best Take Ever')
    const takes = tm.getTakes('tk-gtr')
    assert.equal(takes[0].label, 'Best Take Ever')
    assert.equal(takes[0].filePath, originalPath)
    assert.equal(takes[0].takeNumber, 1)
  })
})

describe('TakeManager / clear removes all takes for a track', () => {
  it('after clear, getTakeCount returns 0 and getActiveTake returns null', () => {
    const tm = new TakeManager()
    tm.addTake('tk-drums', makeResult())
    tm.addTake('tk-drums', makeResult())
    tm.clear('tk-drums')
    assert.equal(tm.getTakeCount('tk-drums'), 0)
    assert.equal(tm.getActiveTake('tk-drums'), null)
    // getTakes should return empty array
    assert.deepEqual(tm.getTakes('tk-drums'), [])
  })
})
