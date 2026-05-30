import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseKeyCombo,
  serializeKeyCombo,
  matchesEvent,
  parseChord,
  CHORD_TIMEOUT_MS,
  type KeyEventLike,
} from '../../src/renderer/src/hotkeys/KeybindingEngine.ts'

describe('parseKeyCombo', () => {
  it('parses simple key', () => {
    const c = parseKeyCombo('Space')
    assert.ok(c)
    assert.equal(c.key, 'space')
    assert.equal(c.ctrl, false)
    assert.equal(c.shift, false)
    assert.equal(c.alt, false)
    assert.equal(c.meta, false)
  })

  it('parses Ctrl+Z', () => {
    const c = parseKeyCombo('Ctrl+Z')
    assert.ok(c)
    assert.equal(c.key, 'z')
    assert.equal(c.ctrl, true)
    assert.equal(c.shift, false)
  })

  it('parses Ctrl+Shift+Z', () => {
    const c = parseKeyCombo('Ctrl+Shift+Z')
    assert.ok(c)
    assert.equal(c.ctrl, true)
    assert.equal(c.shift, true)
    assert.equal(c.key, 'z')
  })

  it('parses Cmd alias → meta:true', () => {
    const c = parseKeyCombo('Cmd+S')
    assert.ok(c)
    assert.equal(c.meta, true)
    assert.equal(c.key, 's')
  })

  it('parses Meta alias → meta:true', () => {
    const c = parseKeyCombo('Meta+S')
    assert.ok(c)
    assert.equal(c.meta, true)
  })

  it('parses Alt+Left', () => {
    const c = parseKeyCombo('Alt+Left')
    assert.ok(c)
    assert.equal(c.alt, true)
    assert.equal(c.key, 'arrowleft')
  })

  it('parses Escape via alias', () => {
    const c = parseKeyCombo('Esc')
    assert.ok(c)
    assert.equal(c.key, 'escape')
  })

  it('parses Up arrow', () => {
    const c = parseKeyCombo('Up')
    assert.ok(c)
    assert.equal(c.key, 'arrowup')
  })

  it('parses Ctrl+= (plus)', () => {
    const c = parseKeyCombo('Ctrl+=')
    assert.ok(c)
    assert.equal(c.ctrl, true)
    assert.equal(c.key, '=')
  })

  it('returns null for empty string', () => {
    assert.equal(parseKeyCombo(''), null)
  })

  it('handles lowercase modifiers', () => {
    const c = parseKeyCombo('ctrl+a')
    assert.ok(c)
    assert.equal(c.ctrl, true)
    assert.equal(c.key, 'a')
  })
})

describe('serializeKeyCombo', () => {
  it('serializes simple key', () => {
    const s = serializeKeyCombo({ key: 'space', ctrl: false, shift: false, alt: false, meta: false })
    assert.equal(s, 'Space')
  })

  it('serializes Ctrl+Z', () => {
    const s = serializeKeyCombo({ key: 'z', ctrl: true, shift: false, alt: false, meta: false })
    assert.equal(s, 'Ctrl+Z')
  })

  it('serializes Ctrl+Shift+Z', () => {
    const s = serializeKeyCombo({ key: 'z', ctrl: true, shift: true, alt: false, meta: false })
    assert.equal(s, 'Ctrl+Shift+Z')
  })

  it('serializes Ctrl+Alt+Shift+Cmd+X', () => {
    const s = serializeKeyCombo({ key: 'x', ctrl: true, shift: true, alt: true, meta: true })
    assert.ok(s.includes('Ctrl'))
    assert.ok(s.includes('Shift'))
    assert.ok(s.includes('Alt'))
    assert.ok(s.includes('Cmd'))
    assert.ok(s.endsWith('X'))
  })

  it('round-trips correctly', () => {
    const original = 'Ctrl+Shift+Z'
    const c = parseKeyCombo(original)
    assert.ok(c)
    const back = serializeKeyCombo(c)
    assert.equal(back, original)
  })
})

describe('matchesEvent', () => {
  function makeEvent(overrides: Partial<KeyEventLike> = {}): KeyEventLike {
    return {
      key:      'z',
      ctrlKey:  false,
      shiftKey: false,
      altKey:   false,
      metaKey:  false,
      ...overrides,
    }
  }

  it('matches simple key', () => {
    const combo = parseKeyCombo('z')!
    const ev    = makeEvent({ key: 'z' })
    assert.equal(matchesEvent(combo, ev), true)
  })

  it('does not match wrong key', () => {
    const combo = parseKeyCombo('z')!
    const ev    = makeEvent({ key: 'x' })
    assert.equal(matchesEvent(combo, ev), false)
  })

  it('requires modifier to match', () => {
    const combo = parseKeyCombo('Ctrl+Z')!
    assert.equal(matchesEvent(combo, makeEvent({ key: 'z' })), false)
    assert.equal(matchesEvent(combo, makeEvent({ key: 'z', ctrlKey: true })), true)
  })

  it('extra modifier makes it not match', () => {
    const combo = parseKeyCombo('Ctrl+Z')!
    const ev    = makeEvent({ key: 'z', ctrlKey: true, shiftKey: true })
    assert.equal(matchesEvent(combo, ev), false)
  })

  it('matches Space', () => {
    const combo = parseKeyCombo('Space')!
    const ev    = makeEvent({ key: ' ' })
    assert.equal(matchesEvent(combo, ev), true)
  })
})

describe('parseChord', () => {
  it('parses "G then B"', () => {
    const result = parseChord('G then B')
    assert.ok(result)
    const [first, second] = result
    assert.equal(first.key, 'g')
    assert.equal(second.key, 'b')
  })

  it('is case-insensitive on "then"', () => {
    const result = parseChord('Ctrl+K THEN Ctrl+C')
    assert.ok(result)
    const [first, second] = result
    assert.equal(first.ctrl, true)
    assert.equal(first.key, 'k')
    assert.equal(second.ctrl, true)
    assert.equal(second.key, 'c')
  })

  it('returns null for non-chord string', () => {
    assert.equal(parseChord('Ctrl+Z'), null)
  })
})

describe('CHORD_TIMEOUT_MS', () => {
  it('is 1500', () => {
    assert.equal(CHORD_TIMEOUT_MS, 1500)
  })
})
