import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  nextTool,
  getModifierTool,
  effectiveTool,
  TOOL_ORDER,
  TOOL_CURSORS,
  TOOL_LABELS,
  type ActiveTool,
} from '../../src/renderer/src/tools/ToolState.ts'

describe('TOOL_ORDER', () => {
  it('has 5 tools', () => {
    assert.equal(TOOL_ORDER.length, 5)
  })

  it('starts with pointer', () => {
    assert.equal(TOOL_ORDER[0], 'pointer')
  })

  it('includes all expected tools', () => {
    const expected: ActiveTool[] = ['pointer', 'pencil', 'eraser', 'split', 'zoom']
    for (const t of expected) {
      assert.ok(TOOL_ORDER.includes(t), `Missing tool: ${t}`)
    }
  })
})

describe('TOOL_CURSORS', () => {
  it('has entry for every tool', () => {
    for (const t of TOOL_ORDER) {
      assert.ok(TOOL_CURSORS[t], `Missing cursor for: ${t}`)
    }
  })

  it('pointer cursor is default', () => {
    assert.equal(TOOL_CURSORS['pointer'], 'default')
  })
})

describe('TOOL_LABELS', () => {
  it('has entry for every tool', () => {
    for (const t of TOOL_ORDER) {
      assert.ok(TOOL_LABELS[t], `Missing label for: ${t}`)
    }
  })
})

describe('nextTool', () => {
  it('advances forward', () => {
    assert.equal(nextTool('pointer', 1), 'pencil')
    assert.equal(nextTool('pencil', 1), 'eraser')
    assert.equal(nextTool('eraser', 1), 'split')
    assert.equal(nextTool('split', 1), 'zoom')
  })

  it('wraps at end (forward)', () => {
    assert.equal(nextTool('zoom', 1), 'pointer')
  })

  it('goes backward', () => {
    assert.equal(nextTool('pencil', -1), 'pointer')
    assert.equal(nextTool('eraser', -1), 'pencil')
  })

  it('wraps at start (backward)', () => {
    assert.equal(nextTool('pointer', -1), 'zoom')
  })

  it('cycles full loop forward', () => {
    let current: ActiveTool = 'pointer'
    for (let i = 0; i < TOOL_ORDER.length; i++) {
      current = nextTool(current, 1)
    }
    assert.equal(current, 'pointer')
  })

  it('cycles full loop backward', () => {
    let current: ActiveTool = 'pointer'
    for (let i = 0; i < TOOL_ORDER.length; i++) {
      current = nextTool(current, -1)
    }
    assert.equal(current, 'pointer')
  })
})

describe('getModifierTool', () => {
  it('returns eraser when alt=true', () => {
    assert.equal(getModifierTool('pointer', { alt: true, ctrl: false }), 'eraser')
  })

  it('returns split when ctrl=true', () => {
    assert.equal(getModifierTool('pointer', { alt: false, ctrl: true }), 'split')
  })

  it('returns null with no modifiers', () => {
    assert.equal(getModifierTool('pointer', { alt: false, ctrl: false }), null)
  })

  it('alt takes priority over ctrl', () => {
    assert.equal(getModifierTool('pointer', { alt: true, ctrl: true }), 'eraser')
  })

  it('works regardless of base tool', () => {
    assert.equal(getModifierTool('zoom', { alt: true, ctrl: false }), 'eraser')
    assert.equal(getModifierTool('pencil', { alt: false, ctrl: true }), 'split')
  })
})

describe('effectiveTool', () => {
  it('returns modifier tool when active', () => {
    assert.equal(effectiveTool('pointer', { alt: true, ctrl: false }), 'eraser')
  })

  it('returns base tool when no modifier', () => {
    assert.equal(effectiveTool('pencil', { alt: false, ctrl: false }), 'pencil')
    assert.equal(effectiveTool('zoom', { alt: false, ctrl: false }), 'zoom')
  })
})
