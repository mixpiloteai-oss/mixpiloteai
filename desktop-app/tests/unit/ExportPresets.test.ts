import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

// Mock localStorage for the test environment (Node.js has no localStorage)
const localStorageMock = (() => {
  const store: Record<string, string> = {}
  return {
    getItem:    (key: string) => store[key] ?? null,
    setItem:    (key: string, val: string) => { store[key] = val },
    removeItem: (key: string) => { delete store[key] },
    clear:      () => { for (const k of Object.keys(store)) delete store[k] },
  }
})()

// Install mock before importing the module
;(globalThis as Record<string, unknown>)['localStorage'] = localStorageMock

import { ExportPresets } from '../../src/renderer/src/audio/export/ExportPresets.ts'

describe('ExportPresets', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  it('getAllPresets includes all 5 built-in presets', () => {
    const mgr     = new ExportPresets()
    const presets = mgr.getAllPresets()
    assert.ok(presets.length >= 5)
  })

  it('getBuiltInPresets returns exactly 5 presets', () => {
    const mgr = new ExportPresets()
    assert.strictEqual(mgr.getBuiltInPresets().length, 5)
  })

  it('all built-in presets have isBuiltIn=true', () => {
    const mgr = new ExportPresets()
    for (const p of mgr.getBuiltInPresets()) {
      assert.strictEqual(p.isBuiltIn, true)
    }
  })

  it('getPreset("streaming") returns the streaming preset', () => {
    const mgr    = new ExportPresets()
    const preset = mgr.getPreset('streaming')
    assert.ok(preset !== undefined)
    assert.strictEqual(preset!.id, 'streaming')
    assert.strictEqual(preset!.format, 'mp3')
  })

  it('getPreset("cd-quality") returns 16-bit 44100 WAV preset', () => {
    const mgr    = new ExportPresets()
    const preset = mgr.getPreset('cd-quality')
    assert.ok(preset !== undefined)
    assert.strictEqual(preset!.sampleRate, 44100)
    assert.strictEqual(preset!.bitDepth, 16)
    assert.strictEqual(preset!.format, 'wav')
  })

  it('saveUserPreset creates a preset with isBuiltIn=false', () => {
    const mgr   = new ExportPresets()
    const saved = mgr.saveUserPreset({
      name:             'My Preset',
      description:      'Test',
      format:           'wav',
      sampleRate:       44100,
      bitDepth:         24,
      ditherType:       'none',
      normalization:    false,
      applyMasterChain: false,
    })
    assert.strictEqual(saved.isBuiltIn, false)
    assert.strictEqual(saved.name, 'My Preset')
    assert.ok(saved.id.startsWith('user_'))
  })

  it('saveUserPreset appears in getUserPresets()', () => {
    const mgr = new ExportPresets()
    mgr.saveUserPreset({
      name:             'Custom',
      description:      '',
      format:           'flac',
      sampleRate:       48000,
      bitDepth:         24,
      ditherType:       'tpdf',
      normalization:    true,
      applyMasterChain: true,
    })
    assert.strictEqual(mgr.getUserPresets().length, 1)
  })

  it('deleteUserPreset removes user preset', () => {
    const mgr   = new ExportPresets()
    const saved = mgr.saveUserPreset({
      name:             'ToDelete',
      description:      '',
      format:           'wav',
      sampleRate:       44100,
      bitDepth:         16,
      ditherType:       'none',
      normalization:    false,
      applyMasterChain: false,
    })
    mgr.deleteUserPreset(saved.id)
    assert.strictEqual(mgr.getUserPresets().length, 0)
    assert.strictEqual(mgr.getPreset(saved.id), undefined)
  })

  it('deleteUserPreset does not affect built-in presets', () => {
    const mgr = new ExportPresets()
    mgr.deleteUserPreset('streaming')  // should silently do nothing to builtins
    assert.ok(mgr.getPreset('streaming') !== undefined)
  })

  it('applyPreset maps preset.format to ExportOptions.format correctly', () => {
    const mgr    = new ExportPresets()
    const preset = mgr.getPreset('mastered')!
    const opts   = mgr.applyPreset(preset)
    assert.strictEqual(opts.format, 'flac')
    assert.strictEqual(opts.bitDepth, 24)
    assert.strictEqual(opts.sampleRate, 44100)
  })

  it('applyPreset maps bitrate for mp3 preset', () => {
    const mgr    = new ExportPresets()
    const preset = mgr.getPreset('streaming')!
    const opts   = mgr.applyPreset(preset)
    assert.strictEqual(opts.bitrate, 320)
  })
})
