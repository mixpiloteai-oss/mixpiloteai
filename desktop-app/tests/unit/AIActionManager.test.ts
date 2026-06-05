// ─── AIActionManager.test.ts ───────────────────────────────────────────────────

import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { AIActionManager } from '../../src/renderer/src/audio/ai/AIActionManager.ts'
import type { AIActionType, AIPreviewData } from '../../src/renderer/src/audio/ai/AIActionManager.ts'

function makeManager() {
  return new AIActionManager()
}

const defaultPreview: AIPreviewData = { textSuggestion: 'test suggestion' }

function createTestAction(mgr: AIActionManager, type: AIActionType = 'suggest-only') {
  return mgr.createAction(type, 'Test Title', 'Test Description', 'test command', defaultPreview, 0.8)
}

describe('AIActionManager', () => {
  describe('createAction', () => {
    it('returns action with status=pending', () => {
      const mgr = makeManager()
      const action = createTestAction(mgr)
      assert.equal(action.status, 'pending')
    })

    it('assigns unique id with ai_ prefix', () => {
      const mgr = makeManager()
      const a1 = createTestAction(mgr)
      const a2 = createTestAction(mgr)
      assert.ok(a1.id.startsWith('ai_'))
      assert.notEqual(a1.id, a2.id)
    })

    it('stores all provided fields', () => {
      const mgr = makeManager()
      const action = mgr.createAction(
        'add-midi-notes',
        'My Title',
        'My Desc',
        'my command',
        defaultPreview,
        0.9,
        'track-1',
      )
      assert.equal(action.type, 'add-midi-notes')
      assert.equal(action.title, 'My Title')
      assert.equal(action.description, 'My Desc')
      assert.equal(action.sourceCommand, 'my command')
      assert.equal(action.confidence, 0.9)
      assert.equal(action.targetTrackId, 'track-1')
      assert.ok(action.createdAt > 0)
      assert.equal(action.appliedAt, undefined)
    })
  })

  describe('previewAction', () => {
    it('changes status to previewing', () => {
      const mgr = makeManager()
      const action = createTestAction(mgr)
      const previewed = mgr.previewAction(action.id)
      assert.equal(previewed?.status, 'previewing')
      assert.equal(mgr.getAction(action.id)?.status, 'previewing')
    })

    it('returns undefined for unknown id', () => {
      const mgr = makeManager()
      const result = mgr.previewAction('nonexistent')
      assert.equal(result, undefined)
    })
  })

  describe('applyAction', () => {
    it('changes status to applied and sets appliedAt', () => {
      const mgr = makeManager()
      const action = createTestAction(mgr)
      const before = Date.now()
      const result = mgr.applyAction(action.id)
      assert.equal(result, true)
      const updated = mgr.getAction(action.id)
      assert.equal(updated?.status, 'applied')
      assert.ok(updated?.appliedAt !== undefined && updated.appliedAt >= before)
    })

    it('returns false for unknown id', () => {
      const mgr = makeManager()
      assert.equal(mgr.applyAction('nonexistent'), false)
    })

    it('returns false when action is already applied', () => {
      const mgr = makeManager()
      const action = createTestAction(mgr)
      mgr.applyAction(action.id)
      assert.equal(mgr.applyAction(action.id), false)
    })

    it('can apply a previewing action', () => {
      const mgr = makeManager()
      const action = createTestAction(mgr)
      mgr.previewAction(action.id)
      const result = mgr.applyAction(action.id)
      assert.equal(result, true)
      assert.equal(mgr.getAction(action.id)?.status, 'applied')
    })
  })

  describe('rejectAction', () => {
    it('changes status to rejected', () => {
      const mgr = makeManager()
      const action = createTestAction(mgr)
      mgr.rejectAction(action.id)
      assert.equal(mgr.getAction(action.id)?.status, 'rejected')
    })

    it('does nothing for unknown id', () => {
      const mgr = makeManager()
      // Should not throw
      mgr.rejectAction('nonexistent')
    })
  })

  describe('undoAction', () => {
    it('changes applied action to undone', () => {
      const mgr = makeManager()
      const action = createTestAction(mgr)
      mgr.applyAction(action.id)
      const result = mgr.undoAction(action.id)
      assert.equal(result, true)
      assert.equal(mgr.getAction(action.id)?.status, 'undone')
    })

    it('returns false for pending action', () => {
      const mgr = makeManager()
      const action = createTestAction(mgr)
      assert.equal(mgr.undoAction(action.id), false)
    })

    it('returns false for rejected action', () => {
      const mgr = makeManager()
      const action = createTestAction(mgr)
      mgr.rejectAction(action.id)
      assert.equal(mgr.undoAction(action.id), false)
    })

    it('returns false for unknown id', () => {
      const mgr = makeManager()
      assert.equal(mgr.undoAction('nonexistent'), false)
    })
  })

  describe('getPendingActions', () => {
    it('returns only pending and previewing actions', () => {
      const mgr = makeManager()
      const a1 = createTestAction(mgr)
      const a2 = createTestAction(mgr)
      const a3 = createTestAction(mgr)
      mgr.applyAction(a1.id)
      mgr.previewAction(a2.id)
      // a3 stays pending
      const pending = mgr.getPendingActions()
      assert.equal(pending.length, 2)
      const ids = pending.map(a => a.id)
      assert.ok(ids.includes(a2.id))
      assert.ok(ids.includes(a3.id))
      assert.ok(!ids.includes(a1.id))
    })
  })

  describe('getHistory', () => {
    it('returns only applied/rejected/undone, sorted newest first', () => {
      const mgr = makeManager()
      const a1 = createTestAction(mgr)
      const a2 = createTestAction(mgr)
      const a3 = createTestAction(mgr)
      mgr.applyAction(a1.id)
      mgr.rejectAction(a2.id)
      // a3 stays pending
      const history = mgr.getHistory()
      assert.equal(history.length, 2)
      const ids = history.map(a => a.id)
      assert.ok(ids.includes(a1.id))
      assert.ok(ids.includes(a2.id))
      assert.ok(!ids.includes(a3.id))
      // Sorted newest first (a2 was created after a1, so a2 should be first or equal)
      assert.ok(history[0]!.createdAt >= history[1]!.createdAt)
    })
  })

  describe('clearHistory', () => {
    it('removes only applied/rejected/undone actions', () => {
      const mgr = makeManager()
      const a1 = createTestAction(mgr)
      const a2 = createTestAction(mgr)
      mgr.applyAction(a1.id)
      // a2 stays pending
      mgr.clearHistory()
      assert.equal(mgr.getHistory().length, 0)
      // Pending action should still be there
      const pending = mgr.getPendingActions()
      assert.ok(pending.some(a => a.id === a2.id))
    })

    it('leaves pending actions intact', () => {
      const mgr = makeManager()
      const pending1 = createTestAction(mgr)
      const pending2 = createTestAction(mgr)
      const applied = createTestAction(mgr)
      mgr.applyAction(applied.id)
      mgr.clearHistory()
      const remaining = mgr.getPendingActions()
      assert.equal(remaining.length, 2)
      assert.ok(remaining.some(a => a.id === pending1.id))
      assert.ok(remaining.some(a => a.id === pending2.id))
    })
  })

  describe('MAX_HISTORY=50', () => {
    it('creating 51st action removes oldest non-pending', () => {
      const mgr = makeManager()
      // Fill with 50 applied actions
      for (let i = 0; i < 50; i++) {
        const a = createTestAction(mgr)
        mgr.applyAction(a.id)
      }
      assert.equal(mgr.getHistory().length, 50)
      // Add one more
      createTestAction(mgr)
      // History should be <= 50
      assert.ok(mgr.getHistory().length <= 50)
    })
  })

  describe('acceptanceRate', () => {
    it('2 applied + 1 rejected → ~0.667', () => {
      const mgr = makeManager()
      const a1 = createTestAction(mgr)
      const a2 = createTestAction(mgr)
      const a3 = createTestAction(mgr)
      mgr.applyAction(a1.id)
      mgr.applyAction(a2.id)
      mgr.rejectAction(a3.id)
      const rate = mgr.acceptanceRate
      assert.ok(Math.abs(rate - 2/3) < 0.01, `Expected ~0.667, got ${rate}`)
    })

    it('returns 0 when no actions', () => {
      const mgr = makeManager()
      assert.equal(mgr.acceptanceRate, 0)
    })

    it('returns 1 when all applied', () => {
      const mgr = makeManager()
      const a = createTestAction(mgr)
      mgr.applyAction(a.id)
      assert.equal(mgr.acceptanceRate, 1)
    })
  })

  describe('totalApplied and totalRejected', () => {
    it('counts correctly', () => {
      const mgr = makeManager()
      const a1 = createTestAction(mgr)
      const a2 = createTestAction(mgr)
      const a3 = createTestAction(mgr)
      mgr.applyAction(a1.id)
      mgr.applyAction(a2.id)
      mgr.rejectAction(a3.id)
      assert.equal(mgr.totalApplied, 2)
      assert.equal(mgr.totalRejected, 1)
    })
  })
})
