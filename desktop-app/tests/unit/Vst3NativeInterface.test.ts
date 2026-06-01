// ─── Vst3NativeInterface.test.ts ─────────────────────────────────────────────
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  NullVst3Adapter,
  loadVst3Adapter,
} from '../../src/main/vst/native/IVst3Adapter.ts'
import type { IVst3Adapter } from '../../src/main/vst/native/IVst3Adapter.ts'

// Helper: capture error from a synchronously-throwing function that has Promise return type
function captureError(fn: () => unknown): Error {
  try {
    fn()
    throw new Error('Expected a throw but nothing was thrown')
  } catch (err) {
    if (err instanceof Error) return err
    throw err
  }
}

describe('NullVst3Adapter', () => {
  it('throws on scanPlugin call with correct error message', () => {
    const adapter = new NullVst3Adapter()
    const err = captureError(() => adapter.scanPlugin('/fake/path.vst3'))
    assert.ok(err instanceof Error, 'should be an Error')
    assert.ok(
      err.message.includes('vst3-node') || err.message.includes('native addon'),
      `Error message should mention 'vst3-node' or 'native addon'. Got: ${err.message}`
    )
  })

  it('throws on createInstance call with correct error message', () => {
    const adapter = new NullVst3Adapter()
    const err = captureError(() => adapter.createInstance('/fake/path.vst3', 'AABB1122'))
    assert.ok(err instanceof Error)
    assert.ok(
      err.message.includes('vst3-node') || err.message.includes('native addon'),
      `Error message should mention 'vst3-node' or 'native addon'. Got: ${err.message}`
    )
  })

  it('throws on getState call', () => {
    const adapter = new NullVst3Adapter()
    const err = captureError(() => adapter.getState('inst_001'))
    assert.ok(err instanceof Error)
  })

  it('throws on processBlock call', () => {
    const adapter = new NullVst3Adapter()
    const err = captureError(() => adapter.processBlock('inst_001', [], [], []))
    assert.ok(err instanceof Error)
  })

  it('error message contains a reference to IVst3Adapter or vst3-node', () => {
    const adapter = new NullVst3Adapter()
    const err = captureError(() => adapter.scanPlugin('/some/path'))
    assert.ok(err instanceof Error)
    // The error should point to the interface file so developers know where to look
    assert.ok(
      err.message.includes('IVst3Adapter') || err.message.includes('vst3-node'),
      `Expected reference to IVst3Adapter or vst3-node in: ${err.message}`
    )
  })

  it('throws on every IVst3Adapter method', () => {
    const adapter = new NullVst3Adapter()

    const checks: Array<() => unknown> = [
      () => adapter.scanPlugin('/p'),
      () => adapter.getPluginCategories('/p'),
      () => adapter.createInstance('/p', 'cid'),
      () => adapter.destroyInstance('id'),
      () => adapter.setupProcessing('id', { sampleRate: 44100, maxBlockSize: 512, symbolicSampleSize: 0, processMode: 0 }),
      () => adapter.activateInstance('id', true),
      () => adapter.processBlock('id', [], [], []),
      () => adapter.getParameterCount('id'),
      () => adapter.getParameterInfo('id', 0),
      () => adapter.getParameterValue('id', 0),
      () => adapter.setParameterValue('id', 0, 0.5),
      () => adapter.getParameterStringByValue('id', 0, 0.5),
      () => adapter.getAllParameterValues('id'),
      () => adapter.getState('id'),
      () => adapter.setState('id', Buffer.alloc(0)),
      () => adapter.attachEditor('id', Buffer.alloc(8)),
      () => adapter.detachEditor('id'),
      () => adapter.resizeEditor('id', 800, 600),
      () => adapter.sendMidiEvent('id', { type: 'noteOn', channel: 0 }),
      () => adapter.getPresetCount('id'),
      () => adapter.getPresetName('id', 0),
      () => adapter.loadPreset('id', '/preset.vstpreset'),
      () => adapter.savePreset('id', '/preset.vstpreset'),
    ]

    for (const check of checks) {
      assert.throws(check, Error)
    }
  })
})

describe('loadVst3Adapter', () => {
  it('returns an object implementing IVst3Adapter (duck-type check)', () => {
    const adapter: IVst3Adapter = loadVst3Adapter()

    // Duck-type check — verify all required methods exist
    const requiredMethods: (keyof IVst3Adapter)[] = [
      'scanPlugin',
      'getPluginCategories',
      'createInstance',
      'destroyInstance',
      'setupProcessing',
      'activateInstance',
      'processBlock',
      'getParameterCount',
      'getParameterInfo',
      'getParameterValue',
      'setParameterValue',
      'getParameterStringByValue',
      'getAllParameterValues',
      'getState',
      'setState',
      'attachEditor',
      'detachEditor',
      'resizeEditor',
      'sendMidiEvent',
      'getPresetCount',
      'getPresetName',
      'loadPreset',
      'savePreset',
    ]

    for (const method of requiredMethods) {
      assert.ok(
        typeof adapter[method] === 'function',
        `adapter.${method} should be a function`
      )
    }
  })

  it('returns a NullVst3Adapter when no native addon is available', () => {
    const adapter = loadVst3Adapter()
    assert.ok(adapter instanceof NullVst3Adapter, 'Should fall back to NullVst3Adapter')
  })
})
