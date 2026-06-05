// ─── WorkflowActionQueue.test.ts ─────────────────────────────────────────────

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { WorkflowActionQueue } from '../../src/renderer/src/audio/workflow/WorkflowActionQueue.ts'

function makeActionData(label = 'action'): Parameters<WorkflowActionQueue['enqueue']>[0] {
  return {
    type:          'set_track_gain',
    description:   label,
    trackId:       'tk-1',
    payload:       { gainDb: -6 },
    previousValue: 0,
  }
}

describe('WorkflowActionQueue', () => {
  it('enqueue returns action with status pending', () => {
    const queue  = new WorkflowActionQueue()
    const action = queue.enqueue(makeActionData())
    assert.equal(action.status, 'pending')
  })

  it('confirm returns action and removes it from pending', () => {
    const queue    = new WorkflowActionQueue()
    const action   = queue.enqueue(makeActionData())
    const confirmed = queue.confirm(action.id)
    assert.ok(confirmed, 'confirm should return the action')
    assert.equal(confirmed.status, 'confirmed')
    assert.equal(queue.size(), 0, 'pending count should be 0 after confirm')
  })

  it('dismiss removes action from pending', () => {
    const queue  = new WorkflowActionQueue()
    const action = queue.enqueue(makeActionData())
    queue.dismiss(action.id)
    assert.equal(queue.size(), 0, 'pending count should be 0 after dismiss')
  })

  it('size() reflects pending count', () => {
    const queue = new WorkflowActionQueue()
    assert.equal(queue.size(), 0)
    queue.enqueue(makeActionData('a'))
    queue.enqueue(makeActionData('b'))
    assert.equal(queue.size(), 2)
  })

  it('enqueueing 11 items keeps only 10 pending (oldest dropped)', () => {
    const queue = new WorkflowActionQueue()
    for (let i = 0; i < 11; i++) {
      queue.enqueue(makeActionData(`action-${i}`))
    }
    assert.equal(queue.size(), 10, 'should keep at most 10 pending items')
  })
})
