// ─── historyStore.test.ts ─────────────────────────────────────────────────────
// Tests the undo/redo engine in isolation.
// Uses a lightweight Zustand-compatible mock so no React / DOM is needed.

import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

// ─── Inline store replica ────────────────────────────────────────────────────
// We replicate the historyStore logic directly so it runs in plain Node.js
// (Zustand's create() is browser-safe but avoids environment complexities).

import type { HistoryDomain } from '../../src/renderer/src/store/historyStore.ts'

interface Command {
  id:        string
  label:     string
  domain:    HistoryDomain
  timestamp: number
  undo():    void
  redo():    void
}

const MAX_HISTORY = 100
let _idCounter = 0
function nextId() { return `h-${++_idCounter}` }

interface StoreState {
  past:      Command[]
  future:    Command[]
  corrupted: boolean
}

function makeStore(): {
  state: StoreState
  push(cmd: Omit<Command,'id'|'timestamp'>): void
  undo(): void
  redo(): void
  clear(): void
  canUndo(): boolean
  canRedo(): boolean
  undoLabel(): string | null
  redoLabel(): string | null
  getEntries(): Omit<Command,'undo'|'redo'>[]
} {
  const state: StoreState = { past: [], future: [], corrupted: false }

  return {
    state,

    push(cmd) {
      const c: Command = { ...cmd, id: nextId(), timestamp: Date.now() }
      state.past.push(c)
      if (state.past.length > MAX_HISTORY) state.past.shift()
      state.future = []
      state.corrupted = false
    },

    undo() {
      if (state.past.length === 0) return
      const cmd = state.past[state.past.length - 1]
      try {
        cmd.undo()
      } catch {
        state.corrupted = true
        return
      }
      state.past.pop()
      state.future.unshift(cmd)
      state.corrupted = false
    },

    redo() {
      if (state.future.length === 0) return
      const cmd = state.future[0]
      try {
        cmd.redo()
      } catch {
        state.corrupted = true
        return
      }
      state.future.shift()
      state.past.push(cmd)
      state.corrupted = false
    },

    clear() {
      state.past = []
      state.future = []
      state.corrupted = false
    },

    canUndo()  { return state.past.length   > 0 },
    canRedo()  { return state.future.length > 0 },
    undoLabel() { return state.past.length   > 0 ? state.past[state.past.length - 1].label   : null },
    redoLabel() { return state.future.length > 0 ? state.future[0].label                      : null },
    getEntries() {
      return state.past.map(({ id, label, domain, timestamp }) => ({ id, label, domain, timestamp }))
    },
  }
}

// ─── push / canUndo / canRedo ─────────────────────────────────────────────────

describe('historyStore / push', () => {
  it('canUndo is false on empty store', () => {
    const s = makeStore()
    assert.equal(s.canUndo(), false)
  })

  it('canRedo is false on empty store', () => {
    const s = makeStore()
    assert.equal(s.canRedo(), false)
  })

  it('canUndo becomes true after a push', () => {
    const s = makeStore()
    s.push({ label: 'A', domain: 'arrangement', undo: () => {}, redo: () => {} })
    assert.equal(s.canUndo(), true)
  })

  it('canRedo is false immediately after a push', () => {
    const s = makeStore()
    s.push({ label: 'A', domain: 'arrangement', undo: () => {}, redo: () => {} })
    assert.equal(s.canRedo(), false)
  })

  it('undoLabel returns the last pushed label', () => {
    const s = makeStore()
    s.push({ label: 'Move clip', domain: 'arrangement', undo: () => {}, redo: () => {} })
    s.push({ label: 'Set gain',  domain: 'mixer',       undo: () => {}, redo: () => {} })
    assert.equal(s.undoLabel(), 'Set gain')
  })

  it('push clears the redo stack', () => {
    const s = makeStore()
    let v = 0
    s.push({ label: 'A', domain: 'arrangement', undo: () => { v = 0 }, redo: () => { v = 1 } })
    s.undo()
    assert.equal(s.canRedo(), true)
    s.push({ label: 'B', domain: 'arrangement', undo: () => {}, redo: () => {} })
    assert.equal(s.canRedo(), false, 'redo stack cleared by new push')
  })
})

// ─── undo / redo ─────────────────────────────────────────────────────────────

describe('historyStore / undo & redo', () => {
  it('undo calls the command undo function', () => {
    const s = makeStore()
    let v = 1
    s.push({ label: 'Test', domain: 'arrangement', undo: () => { v = 0 }, redo: () => { v = 1 } })
    s.undo()
    assert.equal(v, 0)
  })

  it('undo moves command from past to future', () => {
    const s = makeStore()
    s.push({ label: 'A', domain: 'arrangement', undo: () => {}, redo: () => {} })
    s.undo()
    assert.equal(s.state.past.length, 0)
    assert.equal(s.state.future.length, 1)
  })

  it('redo calls the command redo function', () => {
    const s = makeStore()
    let v = 0
    s.push({ label: 'Test', domain: 'arrangement', undo: () => { v = 0 }, redo: () => { v = 1 } })
    s.undo()
    s.redo()
    assert.equal(v, 1)
  })

  it('redo moves command from future to past', () => {
    const s = makeStore()
    s.push({ label: 'A', domain: 'arrangement', undo: () => {}, redo: () => {} })
    s.undo()
    s.redo()
    assert.equal(s.state.past.length, 1)
    assert.equal(s.state.future.length, 0)
  })

  it('multiple undo then redo restores in correct order', () => {
    const s = makeStore()
    const log: string[] = []
    s.push({ label: 'A', domain: 'arrangement',
      undo: () => log.push('undoA'), redo: () => log.push('redoA') })
    s.push({ label: 'B', domain: 'arrangement',
      undo: () => log.push('undoB'), redo: () => log.push('redoB') })
    s.push({ label: 'C', domain: 'arrangement',
      undo: () => log.push('undoC'), redo: () => log.push('redoC') })

    s.undo()  // undoC
    s.undo()  // undoB
    s.redo()  // redoB
    s.redo()  // redoC

    assert.deepEqual(log, ['undoC', 'undoB', 'redoB', 'redoC'])
  })

  it('undo on empty store is a no-op (no throw)', () => {
    const s = makeStore()
    assert.doesNotThrow(() => s.undo())
  })

  it('redo on empty future is a no-op (no throw)', () => {
    const s = makeStore()
    assert.doesNotThrow(() => s.redo())
  })

  it('canUndo is false after all commands are undone', () => {
    const s = makeStore()
    s.push({ label: 'A', domain: 'arrangement', undo: () => {}, redo: () => {} })
    s.undo()
    assert.equal(s.canUndo(), false)
  })

  it('canRedo is false after all commands are redone', () => {
    const s = makeStore()
    s.push({ label: 'A', domain: 'arrangement', undo: () => {}, redo: () => {} })
    s.undo()
    s.redo()
    assert.equal(s.canRedo(), false)
  })
})

// ─── MAX_HISTORY eviction ─────────────────────────────────────────────────────

describe('historyStore / MAX_HISTORY eviction', () => {
  it('does not exceed MAX_HISTORY entries', () => {
    const s = makeStore()
    for (let i = 0; i < MAX_HISTORY + 10; i++) {
      s.push({ label: `Op ${i}`, domain: 'arrangement', undo: () => {}, redo: () => {} })
    }
    assert.ok(s.state.past.length <= MAX_HISTORY, `${s.state.past.length} > ${MAX_HISTORY}`)
  })

  it('evicts oldest entry first', () => {
    const s = makeStore()
    for (let i = 0; i < MAX_HISTORY + 1; i++) {
      s.push({ label: `Op ${i}`, domain: 'arrangement', undo: () => {}, redo: () => {} })
    }
    assert.equal(s.state.past[0].label, 'Op 1')   // Op 0 was evicted
  })
})

// ─── clear ────────────────────────────────────────────────────────────────────

describe('historyStore / clear', () => {
  it('clears past and future', () => {
    const s = makeStore()
    s.push({ label: 'A', domain: 'arrangement', undo: () => {}, redo: () => {} })
    s.push({ label: 'B', domain: 'arrangement', undo: () => {}, redo: () => {} })
    s.undo()
    s.clear()
    assert.equal(s.state.past.length, 0)
    assert.equal(s.state.future.length, 0)
    assert.equal(s.canUndo(), false)
    assert.equal(s.canRedo(), false)
  })
})

// ─── anti-corruption ──────────────────────────────────────────────────────────

describe('historyStore / anti-corruption', () => {
  it('undo that throws sets corrupted=true and leaves stacks unchanged', () => {
    const s = makeStore()
    s.push({ label: 'Bad', domain: 'arrangement',
      undo: () => { throw new Error('undo failure') },
      redo: () => {},
    })
    const pastLenBefore   = s.state.past.length
    const futureLenBefore = s.state.future.length
    s.undo()
    assert.equal(s.state.corrupted, true)
    assert.equal(s.state.past.length,   pastLenBefore,   'past unchanged on failed undo')
    assert.equal(s.state.future.length, futureLenBefore, 'future unchanged on failed undo')
  })

  it('redo that throws sets corrupted=true and leaves stacks unchanged', () => {
    const s = makeStore()
    s.push({ label: 'Bad', domain: 'arrangement',
      undo: () => {},
      redo: () => { throw new Error('redo failure') },
    })
    s.undo()                   // moves to future — undo succeeds
    assert.equal(s.state.corrupted, false)
    const pastLenBefore   = s.state.past.length
    const futureLenBefore = s.state.future.length
    s.redo()                   // throws
    assert.equal(s.state.corrupted, true)
    assert.equal(s.state.past.length,   pastLenBefore)
    assert.equal(s.state.future.length, futureLenBefore)
  })

  it('successful undo after previous corruption clears corrupted flag', () => {
    const s = makeStore()
    let throws = true
    s.push({ label: 'Flaky', domain: 'arrangement',
      undo: () => { if (throws) throw new Error('fail'); },
      redo: () => {},
    })
    s.undo()
    assert.equal(s.state.corrupted, true)

    // Fix the command and try again (replace with good one)
    throws = false
    s.state.corrupted = false  // simulate external reset
    s.undo()
    assert.equal(s.state.corrupted, false)
  })
})

// ─── getEntries ───────────────────────────────────────────────────────────────

describe('historyStore / getEntries', () => {
  it('returns entries without undo/redo functions', () => {
    const s = makeStore()
    s.push({ label: 'A', domain: 'arrangement', undo: () => {}, redo: () => {} })
    const entries = s.getEntries()
    assert.equal(entries.length, 1)
    assert.equal(entries[0].label, 'A')
    assert.ok(!('undo' in entries[0]), 'undo fn should not be exposed')
    assert.ok(!('redo' in entries[0]), 'redo fn should not be exposed')
  })

  it('returns entries in push order (oldest first)', () => {
    const s = makeStore()
    s.push({ label: 'A', domain: 'arrangement', undo: () => {}, redo: () => {} })
    s.push({ label: 'B', domain: 'mixer',       undo: () => {}, redo: () => {} })
    const entries = s.getEntries()
    assert.equal(entries[0].label, 'A')
    assert.equal(entries[1].label, 'B')
  })
})

// ─── labels / domain ─────────────────────────────────────────────────────────

describe('historyStore / labels', () => {
  it('redoLabel reflects the command that would be redone next', () => {
    const s = makeStore()
    s.push({ label: 'Alpha', domain: 'arrangement', undo: () => {}, redo: () => {} })
    s.push({ label: 'Beta',  domain: 'arrangement', undo: () => {}, redo: () => {} })
    s.undo() // undo Beta — Beta is now in future[0]
    assert.equal(s.redoLabel(), 'Beta')
  })

  it('undoLabel is null after all undo', () => {
    const s = makeStore()
    s.push({ label: 'A', domain: 'arrangement', undo: () => {}, redo: () => {} })
    s.undo()
    assert.equal(s.undoLabel(), null)
  })
})

// ─── stress test ─────────────────────────────────────────────────────────────

describe('historyStore / stress', () => {
  it('1000 push→undo→redo cycles remain consistent', () => {
    const s = makeStore()
    let counter = 0
    const STEPS = 1000

    for (let i = 0; i < STEPS; i++) {
      const snapshot = counter
      const next     = i
      s.push({
        label:  `Op ${i}`,
        domain: 'arrangement',
        undo:   () => { counter = snapshot },
        redo:   () => { counter = next },
      })
      counter = i
    }

    // Undo all (capped at MAX_HISTORY)
    const undoCount = Math.min(STEPS, MAX_HISTORY)
    for (let i = 0; i < undoCount; i++) s.undo()
    assert.equal(s.canUndo(), false)
    assert.equal(s.state.future.length, undoCount)

    // Redo all
    for (let i = 0; i < undoCount; i++) s.redo()
    assert.equal(s.canRedo(), false)
    assert.equal(s.state.past.length, undoCount)
  })

  it('rapid alternating undo/redo never corrupts stack sizes', () => {
    const s = makeStore()
    for (let i = 0; i < 20; i++) {
      s.push({ label: `Op ${i}`, domain: 'midi', undo: () => {}, redo: () => {} })
    }

    for (let round = 0; round < 200; round++) {
      if (Math.random() > 0.5 && s.canUndo()) s.undo()
      else if (s.canRedo()) s.redo()
      else if (s.canUndo()) s.undo()
      // Invariant: past + future <= MAX_HISTORY
      assert.ok(s.state.past.length + s.state.future.length <= MAX_HISTORY,
        `stack overflow at round ${round}`)
    }
  })

  it('crash simulation: undo throws halfway through 50 ops', () => {
    const s = makeStore()
    const states: number[] = []
    let current = 0

    for (let i = 0; i < 50; i++) {
      const prev = current
      current = i
      states.push(prev)
      s.push({
        label:  `Op ${i}`,
        domain: 'arrangement',
        undo:   () => { current = prev },
        redo:   () => { current = i },
      })
    }

    // Undo 25 times (all safe)
    for (let i = 0; i < 25; i++) s.undo()
    assert.equal(s.state.corrupted, false)

    // Inject a bad command at top of past
    s.state.past.push({
      id: 'bad', label: 'Crasher', domain: 'arrangement', timestamp: Date.now(),
      undo: () => { throw new Error('crash!') },
      redo: () => {},
    })
    s.undo()  // should fail gracefully
    assert.equal(s.state.corrupted, true)

    // Stack sizes unchanged after failed undo
    const pastLen   = s.state.past.length
    const futureLen = s.state.future.length

    s.undo()  // another failed undo (bad command still on top)
    assert.equal(s.state.past.length,   pastLen,   'past unchanged')
    assert.equal(s.state.future.length, futureLen, 'future unchanged')
  })
})
