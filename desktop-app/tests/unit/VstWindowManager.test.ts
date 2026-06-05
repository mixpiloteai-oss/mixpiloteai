// ─── VstWindowManager.test.ts ────────────────────────────────────────────────
// Tests the data management parts of VstWindowManager only.
// BrowserWindow is not available in Node.js tests — we test the non-Electron parts.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { VstWindowManager } from '../../src/main/vst/VstWindowManager.ts'
import type { PluginWindowInfo } from '../../src/main/vst/VstWindowManager.ts'

// ── PluginWindowInfo shape ─────────────────────────────────────────────────────

describe('PluginWindowInfo shape', () => {
  it('has all required fields', () => {
    const info: PluginWindowInfo = {
      instanceId: 'inst_001',
      windowId: 42,
      width: 800,
      height: 600,
      pinned: false,
      pluginName: 'Test Synth',
    }

    assert.strictEqual(typeof info.instanceId, 'string')
    assert.strictEqual(typeof info.windowId, 'number')
    assert.strictEqual(typeof info.width, 'number')
    assert.strictEqual(typeof info.height, 'number')
    assert.strictEqual(typeof info.pinned, 'boolean')
    assert.strictEqual(typeof info.pluginName, 'string')
  })
})

// ── VstWindowManager data management ─────────────────────────────────────────

describe('VstWindowManager.isWindowOpen', () => {
  it('returns false for unknown instanceId', () => {
    const manager = new VstWindowManager()
    assert.strictEqual(manager.isWindowOpen('unknown-inst'), false)
  })

  it('returns false initially for any instanceId', () => {
    const manager = new VstWindowManager()
    assert.strictEqual(manager.isWindowOpen('inst_001'), false)
    assert.strictEqual(manager.isWindowOpen('inst_002'), false)
    assert.strictEqual(manager.isWindowOpen(''), false)
  })
})

describe('VstWindowManager.getAllOpenWindows', () => {
  it('returns empty array initially', () => {
    const manager = new VstWindowManager()
    const windows = manager.getAllOpenWindows()
    assert.ok(Array.isArray(windows))
    assert.strictEqual(windows.length, 0)
  })
})

describe('VstWindowManager.closePluginWindow', () => {
  it('is safe to call on unknown instanceId', () => {
    const manager = new VstWindowManager()
    assert.doesNotThrow(() => manager.closePluginWindow('nonexistent'))
  })

  it('is safe to call closeAllWindows when empty', () => {
    const manager = new VstWindowManager()
    assert.doesNotThrow(() => manager.closeAllWindows())
  })
})

describe('VstWindowManager.openPluginWindow (requires Electron)', () => {
  it('throws when BrowserWindow is not available (not in Electron context)', async () => {
    const manager = new VstWindowManager()
    // In a Node.js test environment, electron module is not available
    // so require('electron') inside openPluginWindow should throw
    await assert.rejects(
      () => manager.openPluginWindow('inst_001', 'Test Plugin'),
      (err: Error) => {
        // Any error is expected — the point is it throws, not that it silently fails
        assert.ok(err instanceof Error)
        return true
      }
    )
  })
})

describe('VstWindowManager.setMainWindow', () => {
  it('accepts a window reference without throwing', () => {
    const manager = new VstWindowManager()
    // Provide a minimal mock
    const mockWin = {
      id: 1,
      isDestroyed: () => false,
      loadFile: async () => {},
      setTitle: () => {},
      setAlwaysOnTop: () => {},
      setSize: () => {},
      getSize: () => [800, 600] as [number, number],
      close: () => {},
      on: () => {},
    }
    assert.doesNotThrow(() => manager.setMainWindow(mockWin as Parameters<typeof manager.setMainWindow>[0]))
  })
})

describe('VstWindowManager.resizePluginWindow', () => {
  it('is safe to call on unknown instanceId', () => {
    const manager = new VstWindowManager()
    assert.doesNotThrow(() => manager.resizePluginWindow('nonexistent', 1000, 800))
  })
})

describe('VstWindowManager.pinPluginWindow', () => {
  it('is safe to call on unknown instanceId', () => {
    const manager = new VstWindowManager()
    assert.doesNotThrow(() => manager.pinPluginWindow('nonexistent', true))
  })
})
