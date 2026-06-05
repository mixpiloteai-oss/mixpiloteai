// ─── AIActionManagerIntegration.test.ts ───────────────────────────────────────

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { AIActionManager } from '../../src/renderer/src/audio/ai/AIActionManager.ts'
import type { AIPreviewData } from '../../src/renderer/src/audio/ai/AIActionManager.ts'

const defaultPreview: AIPreviewData = { textSuggestion: 'integration test' }

function createTestAction(mgr: AIActionManager) {
  return mgr.createAction(
    'suggest-only',
    'Integration Test',
    'Integration test action',
    'test cmd',
    defaultPreview,
    0.75,
  )
}

describe('AIActionManager Integration', () => {
  describe('full flow: create → preview → apply → undo', () => {
    it('cycles through all states correctly', () => {
      const mgr = new AIActionManager()

      const action = createTestAction(mgr)
      assert.equal(action.status, 'pending')

      mgr.previewAction(action.id)
      assert.equal(mgr.getAction(action.id)?.status, 'previewing')

      const applied = mgr.applyAction(action.id)
      assert.equal(applied, true)
      assert.equal(mgr.getAction(action.id)?.status, 'applied')

      const undone = mgr.undoAction(action.id)
      assert.equal(undone, true)
      assert.equal(mgr.getAction(action.id)?.status, 'undone')
    })

    it('undone action appears in history', () => {
      const mgr = new AIActionManager()
      const action = createTestAction(mgr)
      mgr.applyAction(action.id)
      mgr.undoAction(action.id)

      const history = mgr.getHistory()
      assert.ok(history.some(a => a.id === action.id && a.status === 'undone'))
    })
  })

  describe('full flow: create → reject', () => {
    it('rejected action not in getPendingActions', () => {
      const mgr = new AIActionManager()
      const action = createTestAction(mgr)

      mgr.rejectAction(action.id)

      const pending = mgr.getPendingActions()
      assert.ok(!pending.some(a => a.id === action.id), 'Rejected action should not be in pending')
    })

    it('rejected action appears in history', () => {
      const mgr = new AIActionManager()
      const action = createTestAction(mgr)
      mgr.rejectAction(action.id)

      const history = mgr.getHistory()
      assert.ok(history.some(a => a.id === action.id && a.status === 'rejected'))
    })
  })

  describe('clearHistory leaves pending intact', () => {
    it('pending actions survive clearHistory', () => {
      const mgr = new AIActionManager()
      const pending1 = createTestAction(mgr)
      const pending2 = createTestAction(mgr)
      const applied  = createTestAction(mgr)
      const rejected = createTestAction(mgr)

      mgr.applyAction(applied.id)
      mgr.rejectAction(rejected.id)

      assert.equal(mgr.getHistory().length, 2)
      assert.equal(mgr.getPendingActions().length, 2)

      mgr.clearHistory()

      assert.equal(mgr.getHistory().length, 0)
      const remaining = mgr.getPendingActions()
      assert.equal(remaining.length, 2)
      assert.ok(remaining.some(a => a.id === pending1.id))
      assert.ok(remaining.some(a => a.id === pending2.id))
    })
  })

  describe('totalApplied and totalRejected', () => {
    it('counts correct after multiple operations', () => {
      const mgr = new AIActionManager()
      const a1 = createTestAction(mgr)
      const a2 = createTestAction(mgr)
      const a3 = createTestAction(mgr)
      const a4 = createTestAction(mgr)

      mgr.applyAction(a1.id)
      mgr.applyAction(a2.id)
      mgr.rejectAction(a3.id)
      // a4 stays pending

      assert.equal(mgr.totalApplied, 2)
      assert.equal(mgr.totalRejected, 1)
    })

    it('undone actions not counted as applied', () => {
      const mgr = new AIActionManager()
      const a1 = createTestAction(mgr)
      const a2 = createTestAction(mgr)

      mgr.applyAction(a1.id)
      mgr.applyAction(a2.id)
      mgr.undoAction(a1.id)

      // Only a2 should be counted as applied
      assert.equal(mgr.totalApplied, 1)
    })
  })

  describe('multiple actions management', () => {
    it('can manage many concurrent pending actions', () => {
      const mgr = new AIActionManager()
      const actions = Array.from({ length: 10 }, () => createTestAction(mgr))

      assert.equal(mgr.getPendingActions().length, 10)

      // Apply even, reject odd
      for (let i = 0; i < actions.length; i++) {
        if (i % 2 === 0) mgr.applyAction(actions[i]!.id)
        else mgr.rejectAction(actions[i]!.id)
      }

      assert.equal(mgr.getPendingActions().length, 0)
      assert.equal(mgr.totalApplied, 5)
      assert.equal(mgr.totalRejected, 5)
      assert.ok(Math.abs(mgr.acceptanceRate - 0.5) < 0.001)
    })

    it('getAction returns correct action by id', () => {
      const mgr = new AIActionManager()
      const a1 = createTestAction(mgr)
      const a2 = createTestAction(mgr)

      assert.equal(mgr.getAction(a1.id)?.id, a1.id)
      assert.equal(mgr.getAction(a2.id)?.id, a2.id)
      assert.equal(mgr.getAction('nonexistent'), undefined)
    })
  })

  describe('history ordering', () => {
    it('getHistory returns newest first', () => {
      const mgr = new AIActionManager()
      const actions = []
      for (let i = 0; i < 5; i++) {
        actions.push(createTestAction(mgr))
      }
      for (const a of actions) {
        mgr.applyAction(a.id)
      }

      const history = mgr.getHistory()
      assert.equal(history.length, 5)
      // Verify sorted newest first
      for (let i = 0; i < history.length - 1; i++) {
        assert.ok(history[i]!.createdAt >= history[i + 1]!.createdAt,
          `History not sorted: [${i}].createdAt=${history[i]!.createdAt} < [${i+1}].createdAt=${history[i+1]!.createdAt}`)
      }
    })
  })
})
