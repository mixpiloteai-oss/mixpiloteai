import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { KeybindingMap } from '../../src/renderer/src/hotkeys/KeybindingMap.ts'
import { parseKeyCombo, type KeyCombo } from '../../src/renderer/src/hotkeys/KeybindingEngine.ts'

function combo(str: string): KeyCombo {
  const c = parseKeyCombo(str)
  if (!c) throw new Error(`Invalid combo: ${str}`)
  return c
}

describe('KeybindingMap', () => {
  let map: KeybindingMap

  beforeEach(() => {
    map = new KeybindingMap()
  })

  it('binds and resolves a single action', () => {
    map.bind('transport.play', combo('Space'))
    assert.equal(map.resolve(combo('Space')), 'transport.play')
  })

  it('returns null for unbound combo', () => {
    assert.equal(map.resolve(combo('Space')), null)
  })

  it('last-bind-wins when two actions use same combo', () => {
    map.bind('action.a', combo('Space'))
    map.bind('action.b', combo('Space'))
    assert.equal(map.resolve(combo('Space')), 'action.b')
  })

  it('one action can have multiple combos', () => {
    map.bind('edit.undo', combo('Ctrl+Z'))
    map.bind('edit.undo', combo('Cmd+Z'))
    const bindings = map.getBindingsFor('edit.undo')
    assert.equal(bindings.length, 2)
  })

  it('unbind removes a single combo', () => {
    map.bind('transport.play', combo('Space'))
    map.unbind(combo('Space'))
    assert.equal(map.resolve(combo('Space')), null)
  })

  it('unbindAction removes all combos for action', () => {
    map.bind('edit.undo', combo('Ctrl+Z'))
    map.bind('edit.undo', combo('Cmd+Z'))
    map.unbindAction('edit.undo')
    assert.equal(map.resolve(combo('Ctrl+Z')), null)
    assert.equal(map.resolve(combo('Cmd+Z')), null)
    assert.equal(map.getBindingsFor('edit.undo').length, 0)
  })

  it('unbindAction is safe for unknown action', () => {
    assert.doesNotThrow(() => map.unbindAction('nonexistent'))
  })

  it('getBindingsFor returns empty for unbound action', () => {
    assert.deepEqual(map.getBindingsFor('unknown'), [])
  })

  it('clear removes all bindings', () => {
    map.bind('a', combo('Space'))
    map.bind('b', combo('Ctrl+Z'))
    map.clear()
    assert.equal(map.resolve(combo('Space')), null)
    assert.equal(map.resolve(combo('Ctrl+Z')), null)
    assert.equal(map.allBindings().length, 0)
  })

  it('allBindings returns all entries', () => {
    map.bind('a', combo('Space'))
    map.bind('b', combo('Ctrl+Z'))
    assert.equal(map.allBindings().length, 2)
  })

  describe('serialize / deserialize', () => {
    it('round-trips correctly', () => {
      map.bind('transport.play', combo('Space'))
      map.bind('edit.undo', combo('Ctrl+Z'))
      map.bind('edit.undo', combo('Cmd+Z'))

      const data = map.serialize()
      const map2 = new KeybindingMap()
      map2.deserialize(data)

      assert.equal(map2.resolve(combo('Space')), 'transport.play')
      assert.equal(map2.resolve(combo('Ctrl+Z')), 'edit.undo')
      assert.equal(map2.resolve(combo('Cmd+Z')), 'edit.undo')
    })

    it('deserialize clears previous state', () => {
      map.bind('old.action', combo('Delete'))
      const data = { 'new.action': ['Space'] }
      map.deserialize(data)
      assert.equal(map.resolve(combo('Delete')), null)
      assert.equal(map.resolve(combo('Space')), 'new.action')
    })
  })

  describe('clone', () => {
    it('clone is independent from original', () => {
      map.bind('transport.play', combo('Space'))
      const clone = map.clone()
      clone.bind('transport.play', combo('Ctrl+Z'))

      // Original still intact
      assert.equal(map.resolve(combo('Space')), 'transport.play')
      assert.equal(map.resolve(combo('Ctrl+Z')), null)
    })
  })
})
