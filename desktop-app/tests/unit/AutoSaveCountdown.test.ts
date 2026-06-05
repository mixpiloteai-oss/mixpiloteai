import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeSavings,
  computeDiff,
  applyDiff,
} from '../../src/renderer/src/audio/save/IncrementalSaveEngine.ts'
import type { ProjectSaveData } from '../../src/renderer/src/audio/save/types.ts'

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeProjectData(overrides: Partial<ProjectSaveData> = {}): ProjectSaveData {
  return {
    version:    1,
    savedAt:    Date.now(),
    appVersion: '1.0.0',
    project:    null,
    mixer:      null,
    transport:  { bpm: 120, timeSignatureTop: 4, timeSignatureBottom: 4, looping: false, loopStartBar: 0, loopEndBar: 8 },
    pianoRoll:  null,
    midi:       null,
    ...overrides,
  }
}

// ─── computeSavings tests ────────────────────────────────────────────────────

describe('AutoSaveCountdown / computeSavings', () => {
  it('savingsPct > 0 and < 100 for 10000 bytes and 5 changes', () => {
    const { savingsPct, diffBytes } = computeSavings(10000, 5)
    assert.ok(savingsPct > 0,   `savingsPct should be > 0, got ${savingsPct}`)
    assert.ok(savingsPct < 100, `savingsPct should be < 100, got ${savingsPct}`)
    assert.equal(diffBytes, 5 * 64)
  })

  it('savingsPct = 100 for 0 changes (diff is empty)', () => {
    const { savingsPct } = computeSavings(10000, 0)
    assert.equal(savingsPct, 100)
  })

  it('savingsPct is clamped to 0 when diff is larger than full size', () => {
    // 1 byte full size, 1000 changes → diff would be huge
    const { savingsPct } = computeSavings(1, 1000)
    assert.equal(savingsPct, 0)
  })
})

// ─── Round-trip: computeDiff → applyDiff ────────────────────────────────────

describe('AutoSaveCountdown / diff round-trip', () => {
  it('produces data equal to curr after round-trip (deep equality via JSON)', () => {
    const prev = makeProjectData()
    const curr = makeProjectData({ transport: { bpm: 140 } })

    const diff   = computeDiff('base-id', prev, curr)
    const result = applyDiff(prev, diff)

    assert.equal(JSON.stringify(result), JSON.stringify(curr))
  })

  it('round-trip with no changes returns identical data', () => {
    const data = makeProjectData()
    const diff = computeDiff('base-id', data, data)
    const result = applyDiff(data, diff)
    assert.equal(JSON.stringify(result), JSON.stringify(data))
  })
})

// ─── Large project simulation ────────────────────────────────────────────────

describe('AutoSaveCountdown / large project simulation', () => {
  it('50 tracks with 8 clips each — change 1 BPM → diff has exactly 1 change', () => {
    // Build a large "project" with 50 tracks × 8 clips
    type Clip  = { id: string; start: number; length: number }
    type Track = { id: string; name: string; clips: Clip[] }

    const tracks: Track[] = Array.from({ length: 50 }, (_, ti) => ({
      id:    `track-${ti}`,
      name:  `Track ${ti}`,
      clips: Array.from({ length: 8 }, (__, ci) => ({
        id:     `clip-${ti}-${ci}`,
        start:  ci * 4,
        length: 4,
      })),
    }))

    const prev: ProjectSaveData = {
      version:    1,
      savedAt:    Date.now(),
      appVersion: '1.0.0',
      project:    { tracks },
      mixer:      null,
      transport:  { bpm: 120, timeSignatureTop: 4, timeSignatureBottom: 4, looping: false, loopStartBar: 0, loopEndBar: 8 },
      pianoRoll:  null,
      midi:       null,
    }

    // Only change BPM
    const curr: ProjectSaveData = {
      ...prev,
      transport: { bpm: 140, timeSignatureTop: 4, timeSignatureBottom: 4, looping: false, loopStartBar: 0, loopEndBar: 8 },
    }

    const diff = computeDiff('large-base', prev, curr)

    // Should detect exactly 1 change: transport.bpm
    assert.equal(diff.changes.length, 1, `expected 1 change, got ${diff.changes.length}`)
    assert.equal(diff.changes[0]?.path, 'transport.bpm')
    assert.equal(diff.changes[0]?.value, 140)

    // Round-trip should reconstruct curr
    const result = applyDiff(prev, diff)
    assert.equal(JSON.stringify(result), JSON.stringify(curr))
  })
})
