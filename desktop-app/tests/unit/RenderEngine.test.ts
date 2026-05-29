// ─── RenderEngine.test.ts ─────────────────────────────────────────────────────

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { renderStems } from '../../src/renderer/src/audio/editor/RenderEngine.ts'
import type { RenderRegion, RenderOptions } from '../../src/renderer/src/audio/editor/RenderEngine.ts'

const opts: RenderOptions = { sampleRate: 44100, bitDepth: 32, normalizeOutput: false }

describe('RenderEngine / renderStems', () => {
  it('empty track map returns empty stems and 0 totalSamples', () => {
    const result = renderStems(new Map(), opts)
    assert.equal(result.stems.size, 0)
    assert.equal(result.totalSamples, 0)
  })

  it('single region with gain=1 returns same samples', () => {
    const data: Float32Array[] = [new Float32Array([0.1, 0.2, 0.3])]
    const regions: RenderRegion[] = [{ buffer: data, gain: 1 }]
    const result = renderStems(new Map([['t1', regions]]), opts)
    const stem   = result.stems.get('t1')!
    assert.ok(stem !== undefined)
    for (let i = 0; i < 3; i++) assert.ok(Math.abs(stem[0][i] - data[0][i]) < 1e-6)
    assert.equal(result.totalSamples, 3)
  })

  it('two regions are summed', () => {
    const r1: RenderRegion = { buffer: [new Float32Array([0.1, 0.2, 0.3])], gain: 1 }
    const r2: RenderRegion = { buffer: [new Float32Array([0.1, 0.2, 0.3])], gain: 1 }
    const result = renderStems(new Map([['t1', [r1, r2]]]), opts)
    const stem   = result.stems.get('t1')![0]
    assert.ok(Math.abs(stem[0] - 0.2) < 1e-5)
    assert.ok(Math.abs(stem[1] - 0.4) < 1e-5)
  })

  it('gain is applied to region', () => {
    const r: RenderRegion = { buffer: [new Float32Array([0.5, 0.5])], gain: 0.5 }
    const result = renderStems(new Map([['t1', [r]]]), opts)
    const stem   = result.stems.get('t1')![0]
    assert.ok(Math.abs(stem[0] - 0.25) < 1e-6)
  })

  it('renderStems produces one stem entry per track', () => {
    const r: RenderRegion = { buffer: [new Float32Array([1])], gain: 1 }
    const result = renderStems(new Map([['t1', [r]], ['t2', [r]]]), opts)
    assert.equal(result.stems.size, 2)
    assert.ok(result.stems.has('t1'))
    assert.ok(result.stems.has('t2'))
  })

  it('normalizeOutput scales peak to 1.0', () => {
    const r: RenderRegion = { buffer: [new Float32Array([0.25, 0.5, -0.25])], gain: 1 }
    const normalOpts: RenderOptions = { ...opts, normalizeOutput: true }
    const result = renderStems(new Map([['t1', [r]]]), normalOpts)
    const stem   = result.stems.get('t1')![0]
    let peak     = 0
    for (const v of stem) peak = Math.max(peak, Math.abs(v))
    assert.ok(Math.abs(peak - 1.0) < 1e-6)
  })

  it('empty region list produces empty stem', () => {
    const result = renderStems(new Map([['t1', []]]), opts)
    const stem   = result.stems.get('t1')!
    assert.deepEqual(stem, [])
  })
})
