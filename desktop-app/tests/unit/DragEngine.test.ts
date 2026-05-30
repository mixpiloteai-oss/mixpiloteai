import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  begin,
  update,
  end,
  snapToGrid,
  magnetToClipEdges,
  DRAG_IDLE,
  type DragState,
} from '../../src/renderer/src/tools/DragEngine.ts'

describe('DRAG_IDLE', () => {
  it('has active=false and type=none', () => {
    assert.equal(DRAG_IDLE.active, false)
    assert.equal(DRAG_IDLE.type, 'none')
    assert.equal(DRAG_IDLE.deltaX, 0)
    assert.equal(DRAG_IDLE.deltaY, 0)
  })
})

describe('begin', () => {
  it('creates active drag state', () => {
    const s = begin('move-clip', 100, 200, { clipId: 'c1' })
    assert.equal(s.active, true)
    assert.equal(s.type, 'move-clip')
    assert.equal(s.startX, 100)
    assert.equal(s.startY, 200)
    assert.equal(s.lastX, 100)
    assert.equal(s.lastY, 200)
    assert.equal(s.deltaX, 0)
    assert.equal(s.deltaY, 0)
    assert.deepEqual(s.payload, { clipId: 'c1' })
  })

  it('defaults payload to null', () => {
    const s = begin('select-rect', 0, 0)
    assert.equal(s.payload, null)
  })

  it('does not mutate DRAG_IDLE', () => {
    begin('pan-timeline', 50, 50)
    assert.equal(DRAG_IDLE.active, false)
  })
})

describe('update', () => {
  it('computes deltas correctly', () => {
    const s0 = begin('move-clip', 100, 200)
    const s1 = update(s0, 150, 250)
    assert.equal(s1.deltaX, 50)
    assert.equal(s1.deltaY, 50)
    assert.equal(s1.lastX, 150)
    assert.equal(s1.lastY, 250)
    assert.equal(s1.startX, 100)
    assert.equal(s1.startY, 200)
  })

  it('handles negative deltas', () => {
    const s0 = begin('move-clip', 100, 200)
    const s1 = update(s0, 50, 100)
    assert.equal(s1.deltaX, -50)
    assert.equal(s1.deltaY, -100)
  })

  it('returns same state when inactive', () => {
    const result = update(DRAG_IDLE, 100, 100)
    assert.strictEqual(result, DRAG_IDLE)
  })

  it('does not mutate original state', () => {
    const s0 = begin('move-clip', 0, 0)
    const _s1 = update(s0, 50, 50)
    assert.equal(s0.deltaX, 0)
    assert.equal(s0.deltaY, 0)
    assert.equal(s0.lastX, 0)
    assert.equal(s0.lastY, 0)
  })

  it('cumulative deltas from startX', () => {
    const s0 = begin('move-clip', 100, 100)
    const s1 = update(s0, 110, 100)
    const s2 = update(s1, 130, 100)
    assert.equal(s2.deltaX, 30)
    assert.equal(s2.startX, 100) // still from original start
  })
})

describe('end', () => {
  it('returns DRAG_IDLE', () => {
    const s0 = begin('resize-clip-end', 0, 0)
    const s1 = end(s0)
    assert.equal(s1.active, false)
    assert.equal(s1.type, 'none')
  })
})

describe('snapToGrid', () => {
  it('snaps to nearest grid line', () => {
    assert.equal(snapToGrid(1.4, 1), 1)
    assert.equal(snapToGrid(1.6, 1), 2)
    assert.equal(snapToGrid(0.5, 1), 1)
  })

  it('snaps to 0.25 grid', () => {
    assert.equal(snapToGrid(0.3, 0.25), 0.25)
    assert.equal(snapToGrid(0.13, 0.25), 0.25)
    assert.ok(Math.abs(snapToGrid(0.12, 0.25) - 0) < 0.001)
  })

  it('returns value unchanged for gridSize=0', () => {
    assert.equal(snapToGrid(1.7, 0), 1.7)
  })

  it('already on grid stays same', () => {
    assert.equal(snapToGrid(4, 2), 4)
  })
})

describe('magnetToClipEdges', () => {
  const edges = [{ bar: 1 }, { bar: 2 }, { bar: 4 }]

  it('snaps to nearest edge within threshold', () => {
    assert.equal(magnetToClipEdges(1.05, edges, 0.1), 1)
    assert.equal(magnetToClipEdges(1.95, edges, 0.1), 2)
  })

  it('returns original bar if outside threshold', () => {
    assert.equal(magnetToClipEdges(1.5, edges, 0.1), 1.5)
  })

  it('snaps to closest of two nearby edges', () => {
    // 1.9 is closer to 2 than to 1
    assert.equal(magnetToClipEdges(1.9, edges, 0.2), 2)
  })

  it('returns original bar with empty clip list', () => {
    assert.equal(magnetToClipEdges(2.5, [], 0.5), 2.5)
  })
})
