// ─── WorkflowTipEngine.test.ts ────────────────────────────────────────────────

import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  getAllTips,
  getTipsByCategory,
  getContextualTips,
  resetSeenTips,
} from '../../src/renderer/src/audio/workflow/WorkflowTipEngine.ts'
import type { Project } from '../../src/renderer/src/types/project.ts'

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id:                       'test-proj',
    name:                     'Test',
    bpm:                      120,
    timeSignatureNumerator:   4,
    timeSignatureDenominator: 4,
    sampleRate:               44100,
    masterGainDb:             -6,
    loopStart:                1,
    loopEnd:                  17,
    totalBars:                16,
    tracks:                   [],
    ...overrides,
  }
}

describe('WorkflowTipEngine', () => {
  beforeEach(() => {
    resetSeenTips()
  })

  it('getAllTips returns at least 30 tips', () => {
    const tips = getAllTips()
    assert.ok(tips.length >= 30, `expected >= 30 tips, got ${tips.length}`)
  })

  it('getTipsByCategory shortcut returns only shortcut tips', () => {
    const tips = getTipsByCategory('shortcut')
    assert.ok(tips.length > 0, 'should have shortcut tips')
    for (const tip of tips) {
      assert.equal(tip.category, 'shortcut', `tip ${tip.id} should be shortcut category`)
    }
  })

  it('getContextualTips with null analysis and no clips returns beginner tips', () => {
    const project = makeProject({ tracks: [] })
    const tips    = getContextualTips(project, null, 5)
    assert.ok(tips.length > 0, 'should return some tips')
    // All returned tips should be beginner or at least contextually relevant
    const hasBeginnerTips = tips.some(t => t.category === 'beginner')
    assert.ok(hasBeginnerTips, 'should include beginner tips when project is empty')
  })

  it('resetSeenTips allows same tip to appear again', () => {
    const project = makeProject({ tracks: [] })
    const firstBatch  = getContextualTips(project, null, 3)
    assert.ok(firstBatch.length > 0)
    const firstIds = firstBatch.map(t => t.id)

    resetSeenTips()
    const secondBatch = getContextualTips(project, null, 3)
    const secondIds   = secondBatch.map(t => t.id)

    // After reset, should get same tips again
    const overlap = firstIds.filter(id => secondIds.includes(id))
    assert.ok(overlap.length > 0, 'after reset, previously seen tips should appear again')
  })

  it('maxTips is respected', () => {
    const project = makeProject({ tracks: [] })
    const tips    = getContextualTips(project, null, 3)
    assert.ok(tips.length <= 3, `should return at most 3 tips, got ${tips.length}`)
  })
})
