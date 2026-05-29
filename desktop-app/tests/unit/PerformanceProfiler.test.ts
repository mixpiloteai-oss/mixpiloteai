import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { PerformanceProfiler } from '../../src/renderer/src/perf/PerformanceProfiler.ts'

describe('PerformanceProfiler', () => {
  it('mark + measure returns non-negative duration', () => {
    const p = new PerformanceProfiler()
    p.mark('foo')
    const ms = p.measure('foo')
    assert.ok(ms !== null)
    assert.ok(ms! >= 0)
  })

  it('measure unknown label returns null', () => {
    const p = new PerformanceProfiler()
    assert.equal(p.measure('nonexistent'), null)
  })

  it('startSpan returns duration >= 0', () => {
    const p  = new PerformanceProfiler()
    const end = p.startSpan('bar')
    const dur = end()
    assert.ok(dur >= 0)
  })

  it('getMarks() returns all marks in insertion order', () => {
    const p = new PerformanceProfiler()
    p.mark('a')
    p.mark('b')
    const marks = p.getMarks()
    assert.equal(marks.length, 2)
    assert.equal(marks[0].label, 'a')
    assert.equal(marks[1].label, 'b')
  })

  it('clear() empties all marks', () => {
    const p = new PerformanceProfiler()
    p.mark('x')
    p.clear()
    assert.equal(p.getMarks().length, 0)
    assert.equal(p.measure('x'), null)
  })

  it('ring buffer: with maxMarks=3, adding 4 marks keeps only 3', () => {
    const p = new PerformanceProfiler({ maxMarks: 3 })
    p.mark('a')
    p.mark('b')
    p.mark('c')
    p.mark('d')
    const marks = p.getMarks()
    assert.equal(marks.length, 3)
    assert.equal(marks[0].label, 'b')
    assert.equal(marks[2].label, 'd')
  })
})
