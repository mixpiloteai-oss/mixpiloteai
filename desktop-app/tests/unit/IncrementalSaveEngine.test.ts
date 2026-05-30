import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  flattenObject,
  computeDiff,
  applyDiff,
  computeSavings,
} from '../../src/renderer/src/audio/save/IncrementalSaveEngine.ts'
import type { ProjectSaveData } from '../../src/renderer/src/audio/save/types.ts'

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeData(overrides: Partial<ProjectSaveData> = {}): ProjectSaveData {
  return {
    version:    1,
    savedAt:    1000000,
    appVersion: '1.0.0',
    project:    { name: 'Test Project' },
    mixer:      { channels: {}, buses: [], masterLimiter: false, monitoring: false },
    transport:  { bpm: 120, timeSignatureTop: 4, timeSignatureBottom: 4, looping: false, loopStartBar: 0, loopEndBar: 8 },
    pianoRoll:  { notes: [], snap: '1/8', zoomX: 1, zoomY: 1 },
    midi:       { arp: {}, seqTracks: [], drumPads: [] },
    ...overrides,
  }
}

// ─── flattenObject ────────────────────────────────────────────────────────────

describe('flattenObject', () => {
  it('flattens nested objects correctly', () => {
    const result = flattenObject({ a: { b: { c: 42 } } })
    assert.deepEqual(result, { 'a.b.c': 42 })
  })

  it('treats arrays as opaque leaves (does not recurse)', () => {
    const arr = [1, 2, 3]
    const result = flattenObject({ notes: arr })
    assert.deepEqual(result, { notes: arr })
    // The array itself should be the exact same reference (not recursed into)
    assert.equal(result['notes'], arr)
  })

  it('handles null values as leaves', () => {
    const result = flattenObject({ a: null, b: { c: null } })
    assert.deepEqual(result, { a: null, 'b.c': null })
  })

  it('handles empty prefix (top-level call)', () => {
    const result = flattenObject({ x: 1, y: 2 })
    assert.deepEqual(result, { x: 1, y: 2 })
  })

  it('handles mixed depth objects', () => {
    const result = flattenObject({ a: 1, b: { c: 2, d: { e: 3 } } })
    assert.deepEqual(result, { a: 1, 'b.c': 2, 'b.d.e': 3 })
  })
})

// ─── computeDiff ─────────────────────────────────────────────────────────────

describe('computeDiff', () => {
  it('returns empty changes for identical objects', () => {
    const data = makeData()
    const diff = computeDiff('base-id', data, data)
    assert.equal(diff.changes.length, 0)
    assert.equal(diff.stats.added, 0)
    assert.equal(diff.stats.changed, 0)
    assert.equal(diff.stats.deleted, 0)
  })

  it('detects added keys', () => {
    const prev = makeData({ project: { name: 'A' } })
    const curr = makeData({ project: { name: 'A', extra: 'new' } })
    const diff = computeDiff('base-id', prev, curr)
    assert.ok(diff.stats.added > 0, `expected added > 0, got ${diff.stats.added}`)
  })

  it('detects changed scalar values (including BPM change: transport.bpm)', () => {
    const prev = makeData({ transport: { bpm: 120 } })
    const curr = makeData({ transport: { bpm: 140 } })
    const diff = computeDiff('base-id', prev, curr)
    const bpmChange = diff.changes.find(c => c.path === 'transport.bpm')
    assert.ok(bpmChange !== undefined, 'expected transport.bpm change')
    assert.equal(bpmChange.op, 'set')
    assert.equal(bpmChange.value, 140)
    assert.ok(diff.stats.changed >= 1)
  })

  it('detects deleted keys', () => {
    const prev = makeData({ project: { name: 'A', toDelete: 'bye' } })
    const curr = makeData({ project: { name: 'A' } })
    const diff = computeDiff('base-id', prev, curr)
    assert.ok(diff.stats.deleted > 0, 'expected deleted > 0')
    const delChange = diff.changes.find(c => c.op === 'del')
    assert.ok(delChange !== undefined, 'expected a del operation')
  })

  it('stats counts are correct', () => {
    const prev = makeData({ project: { a: 1, b: 2, c: 3 } })
    const curr = makeData({ project: { a: 1, b: 99, d: 4 } })
    const diff = computeDiff('base-id', prev, curr)
    // b changed, c deleted, d added
    assert.ok(diff.stats.added >= 1, `added: ${diff.stats.added}`)
    assert.ok(diff.stats.changed >= 1, `changed: ${diff.stats.changed}`)
    assert.ok(diff.stats.deleted >= 1, `deleted: ${diff.stats.deleted}`)
  })

  it('sets baseSnapshotId and computedAt', () => {
    const data = makeData()
    const before = Date.now()
    const diff = computeDiff('my-base-id', data, data)
    const after = Date.now()
    assert.equal(diff.baseSnapshotId, 'my-base-id')
    assert.ok(diff.computedAt >= before)
    assert.ok(diff.computedAt <= after)
  })
})

// ─── applyDiff ───────────────────────────────────────────────────────────────

describe('applyDiff', () => {
  it('reconstructs original from base + diff (round-trip)', () => {
    const prev = makeData()
    const curr = makeData({ transport: { bpm: 140 } })
    const diff = computeDiff('base', prev, curr)
    const result = applyDiff(prev, diff)
    assert.equal(JSON.stringify(result), JSON.stringify(curr))
  })

  it('handles deletions (del op removes path)', () => {
    const prev = makeData({ project: { name: 'A', extra: 'remove-me' } })
    const curr = makeData({ project: { name: 'A' } })
    const diff = computeDiff('base', prev, curr)
    const result = applyDiff(prev, diff)
    const project = result.project as Record<string, unknown>
    assert.equal('extra' in project, false)
  })

  it('does not mutate base', () => {
    const base = makeData()
    const modified = makeData({ transport: { bpm: 200 } })
    const diff = computeDiff('base', base, modified)
    const baseCopy = JSON.parse(JSON.stringify(base)) as ProjectSaveData
    applyDiff(base, diff)
    // base should be unchanged
    assert.equal(JSON.stringify(base), JSON.stringify(baseCopy))
  })
})

// ─── computeSavings ───────────────────────────────────────────────────────────

describe('computeSavings', () => {
  it('returns 0 saving for empty diff (0 changes)', () => {
    const result = computeSavings(10000, 0)
    assert.equal(result.diffBytes, 0)
    assert.equal(result.savingsPct, 100)
  })

  it('returns >0 saving for non-trivial full size', () => {
    const result = computeSavings(10000, 5)
    assert.ok(result.savingsPct > 0, `savingsPct should be > 0, got ${result.savingsPct}`)
    assert.ok(result.savingsPct < 100, `savingsPct should be < 100, got ${result.savingsPct}`)
    assert.equal(result.diffBytes, 5 * 64)
  })

  it('handles zero fullSizeBytes gracefully', () => {
    const result = computeSavings(0, 5)
    assert.equal(result.savingsPct, 0)
  })
})
