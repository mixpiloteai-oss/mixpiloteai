import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { AdvancedLogger } from '../../src/renderer/src/debug/AdvancedLogger.ts'

describe('AdvancedLogger', () => {
  it('log() stores entries', () => {
    const l = new AdvancedLogger()
    l.log('info', 'hello')
    const entries = l.getEntries()
    assert.equal(entries.length, 1)
    assert.equal(entries[0].level, 'info')
    assert.equal(entries[0].message, 'hello')
    assert.ok(entries[0].timestamp > 0)
  })

  it('debug/info/warn/error shortcuts set correct level', () => {
    const l = new AdvancedLogger()
    l.debug('d'); l.info('i'); l.warn('w'); l.error('e')
    const levels = l.getEntries().map(e => e.level)
    assert.deepEqual(levels, ['debug', 'info', 'warn', 'error'])
  })

  it('getEntries({ level }) filters by level', () => {
    const l = new AdvancedLogger()
    l.info('a'); l.error('b'); l.info('c')
    assert.equal(l.getEntries({ level: 'info' }).length, 2)
    assert.equal(l.getEntries({ level: 'error' }).length, 1)
  })

  it('getEntries({ limit }) returns last N entries', () => {
    const l = new AdvancedLogger()
    l.info('1'); l.info('2'); l.info('3')
    const last1 = l.getEntries({ limit: 1 })
    assert.equal(last1.length, 1)
    assert.equal(last1[0].message, '3')
  })

  it('clear() empties entries', () => {
    const l = new AdvancedLogger()
    l.info('x')
    l.clear()
    assert.equal(l.getEntries().length, 0)
  })

  it('export() returns valid JSONL', () => {
    const l = new AdvancedLogger()
    l.info('line1'); l.warn('line2')
    const exported = l.export()
    const lines    = exported.split('\n').filter(Boolean)
    assert.equal(lines.length, 2)
    const parsed = JSON.parse(lines[0])
    assert.equal(parsed.level, 'info')
    assert.equal(parsed.message, 'line1')
  })

  it('ring buffer caps at maxEntries', () => {
    const l = new AdvancedLogger({ maxEntries: 3 })
    for (let i = 0; i < 5; i++) l.info(`msg${i}`)
    assert.equal(l.getEntries().length, 3)
    assert.equal(l.getEntries()[0].message, 'msg2')
  })

  it('onEntry callback fires on each log call', () => {
    const calls: string[] = []
    const l = new AdvancedLogger({ onEntry: e => calls.push(e.message) })
    l.info('alpha'); l.warn('beta')
    assert.deepEqual(calls, ['alpha', 'beta'])
  })
})
