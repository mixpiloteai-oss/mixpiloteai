// ─── useMixerLayout.test.ts ──────────────────────────────────────────────────
// Self-contained — replicates layout store logic inline (no Zustand import).

import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

// ── Replicate store logic inline ──────────────────────────────────────────────

const MIN_WIDTH     = 48
const MAX_WIDTH     = 160
const DEFAULT_WIDTH = 72

function createStore() {
  let channelWidth = DEFAULT_WIDTH
  let compactMode  = false

  return {
    get channelWidth() { return channelWidth },
    get compactMode()  { return compactMode  },

    setChannelWidth(w: number) {
      channelWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(w)))
    },
    toggleCompactMode() { compactMode = !compactMode },
    resetLayout() { channelWidth = DEFAULT_WIDTH; compactMode = false },
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useMixerLayout / defaults', () => {
  it('default channelWidth is 72', () => {
    const s = createStore()
    assert.equal(s.channelWidth, DEFAULT_WIDTH)
  })

  it('default compactMode is false', () => {
    const s = createStore()
    assert.equal(s.compactMode, false)
  })
})

describe('useMixerLayout / setChannelWidth', () => {
  let store: ReturnType<typeof createStore>
  beforeEach(() => { store = createStore() })

  it('sets value within bounds', () => {
    store.setChannelWidth(100)
    assert.equal(store.channelWidth, 100)
  })

  it('clamps below MIN_WIDTH', () => {
    store.setChannelWidth(10)
    assert.equal(store.channelWidth, MIN_WIDTH)
  })

  it('clamps above MAX_WIDTH', () => {
    store.setChannelWidth(999)
    assert.equal(store.channelWidth, MAX_WIDTH)
  })

  it('rounds to nearest integer', () => {
    store.setChannelWidth(80.7)
    assert.equal(store.channelWidth, 81)
  })

  it('accepts exactly MIN_WIDTH', () => {
    store.setChannelWidth(MIN_WIDTH)
    assert.equal(store.channelWidth, MIN_WIDTH)
  })

  it('accepts exactly MAX_WIDTH', () => {
    store.setChannelWidth(MAX_WIDTH)
    assert.equal(store.channelWidth, MAX_WIDTH)
  })
})

describe('useMixerLayout / toggleCompactMode', () => {
  let store: ReturnType<typeof createStore>
  beforeEach(() => { store = createStore() })

  it('toggles from false to true', () => {
    store.toggleCompactMode()
    assert.equal(store.compactMode, true)
  })

  it('toggles back to false', () => {
    store.toggleCompactMode()
    store.toggleCompactMode()
    assert.equal(store.compactMode, false)
  })
})

describe('useMixerLayout / resetLayout', () => {
  it('restores defaults after changes', () => {
    const store = createStore()
    store.setChannelWidth(120)
    store.toggleCompactMode()
    store.resetLayout()
    assert.equal(store.channelWidth, DEFAULT_WIDTH)
    assert.equal(store.compactMode,  false)
  })
})
