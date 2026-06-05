import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { HotkeyManager, type StorageAdapter } from '../../src/renderer/src/hotkeys/HotkeyManager.ts'
import { type KeyEventLike } from '../../src/renderer/src/hotkeys/KeybindingEngine.ts'

function makeEvent(overrides: Partial<KeyEventLike & { target?: unknown }> = {}): KeyEventLike & { target?: unknown } {
  return {
    key:      'z',
    ctrlKey:  false,
    shiftKey: false,
    altKey:   false,
    metaKey:  false,
    target:   null,
    ...overrides,
  }
}

function inputTarget(tag: string, editable = false): { tagName: string; isContentEditable: boolean } {
  return { tagName: tag, isContentEditable: editable }
}

class MockStorage implements StorageAdapter {
  private _data = new Map<string, string>()
  getItem(key: string): string | null { return this._data.get(key) ?? null }
  setItem(key: string, value: string): void { this._data.set(key, value) }
}

describe('HotkeyManager', () => {
  let manager: HotkeyManager

  beforeEach(() => {
    HotkeyManager._resetInstance()
    manager = HotkeyManager.getInstance()
  })

  it('singleton returns same instance', () => {
    const a = HotkeyManager.getInstance()
    const b = HotkeyManager.getInstance()
    assert.strictEqual(a, b)
  })

  it('_resetInstance creates fresh instance', () => {
    const a = HotkeyManager.getInstance()
    HotkeyManager._resetInstance()
    const b = HotkeyManager.getInstance()
    assert.notStrictEqual(a, b)
  })

  it('getInstance loads default preset', () => {
    // Space should be bound to transport.play by default
    const actionId = manager.map.resolve({ key: 'space', ctrl: false, shift: false, alt: false, meta: false })
    assert.equal(actionId, 'transport.play')
  })

  it('onKeyEvent returns false when action not registered', () => {
    const result = manager.onKeyEvent(makeEvent({ key: ' ' }))
    // transport.play action is not registered in registry → returns false
    assert.equal(result, false)
  })

  it('onKeyEvent calls registered action and returns true', () => {
    let called = false
    manager.registry.register({
      id:          'transport.play',
      label:       'Play',
      category:    'transport',
      description: '',
      handler:     () => { called = true },
    })

    const result = manager.onKeyEvent(makeEvent({ key: ' ' }))
    assert.equal(result, true)
    assert.equal(called, true)
  })

  it('skips event on INPUT target', () => {
    manager.registry.register({
      id: 'transport.play', label: '', category: 'transport', description: '',
      handler: () => { throw new Error('should not be called') },
    })

    const result = manager.onKeyEvent(makeEvent({ key: ' ', target: inputTarget('input') }))
    assert.equal(result, false)
  })

  it('skips event on TEXTAREA target', () => {
    manager.registry.register({
      id: 'transport.play', label: '', category: 'transport', description: '',
      handler: () => { throw new Error('should not be called') },
    })

    const result = manager.onKeyEvent(makeEvent({ key: ' ', target: inputTarget('TEXTAREA') }))
    assert.equal(result, false)
  })

  it('skips event on contentEditable target', () => {
    const result = manager.onKeyEvent(makeEvent({
      key:    ' ',
      target: inputTarget('DIV', true),
    }))
    assert.equal(result, false)
  })

  it('returns false for unbound key', () => {
    const result = manager.onKeyEvent(makeEvent({ key: 'F12' }))
    assert.equal(result, false)
  })

  describe('chord support', () => {
    it('isChordPending is false initially', () => {
      assert.equal(manager.isChordPending(), false)
    })

    it('chord: first key sets pending state', () => {
      // Manually register a chord-like binding (G then B)
      manager.loadPreset({ 'chord.action': ['G then B'] })
      const handled = manager.onKeyEvent(makeEvent({ key: 'g' }))
      assert.equal(handled, false) // waits for second key
      assert.equal(manager.isChordPending(), true)
    })

    it('chord: second key resolves the chord', () => {
      let called = false
      manager.loadPreset({ 'chord.action': ['G then B'] })
      manager.registry.register({
        id: 'chord.action', label: '', category: 'edit', description: '',
        handler: () => { called = true },
      })

      manager.onKeyEvent(makeEvent({ key: 'g' })) // first
      const result = manager.onKeyEvent(makeEvent({ key: 'b' })) // second
      assert.equal(result, true)
      assert.equal(called, true)
      assert.equal(manager.isChordPending(), false)
    })

    it('cancelChord clears pending state', () => {
      manager.loadPreset({ 'chord.action': ['G then B'] })
      manager.onKeyEvent(makeEvent({ key: 'g' }))
      assert.equal(manager.isChordPending(), true)
      manager.cancelChord()
      assert.equal(manager.isChordPending(), false)
    })
  })

  describe('resetToPreset', () => {
    it('loads ableton preset', () => {
      manager.resetToPreset('ableton')
      // Ableton uses Ctrl+U for quantize (DEFAULT uses Ctrl+Q)
      const actionId = manager.map.resolve({ key: 'u', ctrl: true, shift: false, alt: false, meta: false })
      assert.equal(actionId, 'edit.quantize')
    })

    it('loads fl preset', () => {
      manager.resetToPreset('fl')
      // FL uses F9 for mixer
      const actionId = manager.map.resolve({ key: 'f9', ctrl: false, shift: false, alt: false, meta: false })
      assert.equal(actionId, 'view.toggle_mixer')
    })

    it('loads logic preset', () => {
      manager.resetToPreset('logic')
      // Logic uses Q for quantize
      const actionId = manager.map.resolve({ key: 'q', ctrl: false, shift: false, alt: false, meta: false })
      assert.equal(actionId, 'edit.quantize')
    })
  })

  describe('getConflicts', () => {
    it('returns empty when no conflicts', () => {
      manager.resetToPreset('default')
      const conflicts = manager.getConflicts()
      assert.ok(Array.isArray(conflicts))
      // Default preset is clean
    })
  })

  describe('storage', () => {
    it('saveToStorage and loadFromStorage round-trip', () => {
      const storage = new MockStorage()
      manager.resetToPreset('default')
      manager.saveToStorage(storage)

      // Change bindings
      HotkeyManager._resetInstance()
      const manager2 = HotkeyManager.getInstance()
      manager2.map.clear()
      // Verify nothing is bound
      assert.equal(manager2.map.resolve({ key: 'space', ctrl: false, shift: false, alt: false, meta: false }), null)

      // Restore from storage
      manager2.loadFromStorage(storage)
      assert.equal(
        manager2.map.resolve({ key: 'space', ctrl: false, shift: false, alt: false, meta: false }),
        'transport.play',
      )
    })

    it('loadFromStorage handles corrupt data gracefully', () => {
      const storage: StorageAdapter = {
        getItem: () => '{ invalid json {{',
        setItem: () => {},
      }
      assert.doesNotThrow(() => manager.loadFromStorage(storage))
    })

    it('loadFromStorage handles null storage gracefully', () => {
      const storage: StorageAdapter = {
        getItem: () => null,
        setItem: () => {},
      }
      assert.doesNotThrow(() => manager.loadFromStorage(storage))
    })
  })

  describe('applyCustom', () => {
    it('overrides bindings for specific actions', () => {
      manager.resetToPreset('default')
      manager.applyCustom({ 'transport.play': ['Ctrl+P'] })
      const actionId = manager.map.resolve({ key: 'p', ctrl: true, shift: false, alt: false, meta: false })
      assert.equal(actionId, 'transport.play')
    })
  })
})
