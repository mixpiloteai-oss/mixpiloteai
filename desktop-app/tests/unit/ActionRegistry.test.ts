import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { ActionRegistry, type ActionDef } from '../../src/renderer/src/hotkeys/ActionRegistry.ts'

function makeAction(id: string, category: ActionDef['category'] = 'transport'): ActionDef {
  return {
    id,
    label:       `Label for ${id}`,
    category,
    description: `Description for ${id}`,
    handler:     () => {},
  }
}

describe('ActionRegistry', () => {
  let reg: ActionRegistry

  beforeEach(() => {
    reg = new ActionRegistry()
  })

  it('registers and retrieves an action', () => {
    reg.register(makeAction('transport.play'))
    assert.ok(reg.has('transport.play'))
    assert.equal(reg.getAll().length, 1)
  })

  it('unregisters an action', () => {
    reg.register(makeAction('transport.play'))
    reg.unregister('transport.play')
    assert.equal(reg.has('transport.play'), false)
    assert.equal(reg.getAll().length, 0)
  })

  it('execute returns true and calls handler', () => {
    let called = false
    reg.register({ ...makeAction('test.action'), handler: () => { called = true } })
    const result = reg.execute('test.action')
    assert.equal(result, true)
    assert.equal(called, true)
  })

  it('execute returns false for unknown action', () => {
    const result = reg.execute('nonexistent')
    assert.equal(result, false)
  })

  it('getByCategory filters correctly', () => {
    reg.register(makeAction('transport.play', 'transport'))
    reg.register(makeAction('edit.undo', 'edit'))
    reg.register(makeAction('transport.stop', 'transport'))

    const transport = reg.getByCategory('transport')
    assert.equal(transport.length, 2)
    assert.ok(transport.every(a => a.category === 'transport'))
  })

  it('getByCategory returns empty array for unknown category', () => {
    const results = reg.getByCategory('mix')
    assert.equal(results.length, 0)
  })

  it('clear removes all actions', () => {
    reg.register(makeAction('a'))
    reg.register(makeAction('b'))
    reg.clear()
    assert.equal(reg.getAll().length, 0)
  })

  it('registering same id replaces previous', () => {
    let firstCalled = false
    let secondCalled = false
    reg.register({ ...makeAction('same.id'), handler: () => { firstCalled = true } })
    reg.register({ ...makeAction('same.id'), handler: () => { secondCalled = true } })
    reg.execute('same.id')
    assert.equal(firstCalled, false)
    assert.equal(secondCalled, true)
  })

  it('getAll returns defensive copy', () => {
    reg.register(makeAction('a'))
    const arr1 = reg.getAll()
    arr1.push(makeAction('fake'))
    const arr2 = reg.getAll()
    assert.equal(arr2.length, 1)
  })
})
