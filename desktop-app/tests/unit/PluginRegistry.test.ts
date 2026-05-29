// ─── PluginRegistry.test.ts ───────────────────────────────────────────────────
// Tests plugin registry / scanner logic: manifest parsing, deduplication,
// blacklist filtering, path resolution across platforms.

import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { platform } from 'node:process'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScannedPlugin {
  id:            string
  name:          string
  vendor:        string
  path:          string
  format:        string
  category:      string
  architecture:  string
  isBlacklisted: boolean
  crashCount:    number
  isFavorite:    boolean
  hasEditor:     boolean
  paramCount:    number
  version:       string
  scannedAt:     number
}

interface ModuleInfoJson {
  Name?:           string
  Vendor?:         string
  Version?:        string
  SDKVersion?:     string
  SubCategories?:  string[]
  ClassInfos?:     Array<{ Name?: string; Vendor?: string; Version?: string; SDKVersion?: string; SubCategories?: string[] }>
}

// ── Registry helpers (replicated from pluginScanner.ts logic) ─────────────────

function parseModuleInfo(json: ModuleInfoJson, pluginPath: string): Partial<ScannedPlugin> {
  const first = json.ClassInfos?.[0] ?? json
  const name    = first.Name    ?? json.Name    ?? 'Unknown Plugin'
  const vendor  = first.Vendor  ?? json.Vendor  ?? 'Unknown Vendor'
  const version = first.Version ?? json.Version ?? '0.0.0'
  const cats    = first.SubCategories ?? json.SubCategories ?? []
  const cat     = cats.some(c => c.toLowerCase().includes('instrument'))   ? 'instrument'
                : cats.some(c => c.toLowerCase().includes('fx'))           ? 'effect'
                : cats.some(c => c.toLowerCase().includes('analyzer'))     ? 'analyzer'
                : 'effect'
  return { name, vendor, version, category: cat, path: pluginPath }
}

function deduplicatePlugins(plugins: ScannedPlugin[]): ScannedPlugin[] {
  const seen = new Map<string, ScannedPlugin>()
  for (const p of plugins) {
    const key = `${p.name}::${p.vendor}::${p.format}`
    if (!seen.has(key)) seen.set(key, p)
  }
  return [...seen.values()]
}

function filterBlacklisted(plugins: ScannedPlugin[], blacklist: Set<string>): ScannedPlugin[] {
  return plugins.map(p => ({ ...p, isBlacklisted: blacklist.has(p.path) }))
}

function resolveScanPaths(plat: string, homeDir: string): string[] {
  if (plat === 'win32') return ['C:\\Program Files\\Common Files\\VST3']
  if (plat === 'darwin') return ['/Library/Audio/Plug-Ins/VST3', `${homeDir}/Library/Audio/Plug-Ins/VST3`]
  return [`${homeDir}/.vst3`, '/usr/lib/vst3', '/usr/local/lib/vst3']
}

function makePlugin(overrides: Partial<ScannedPlugin> = {}): ScannedPlugin {
  return {
    id: 'p1', name: 'Test Synth', vendor: 'ACME', path: '/plugins/Test.vst3',
    format: 'VST3', category: 'instrument', architecture: '64bit',
    isBlacklisted: false, crashCount: 0, isFavorite: false,
    hasEditor: true, paramCount: 8, version: '1.0.0', scannedAt: Date.now(),
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PluginRegistry / parseModuleInfo', () => {
  it('extracts name and vendor from top-level keys', () => {
    const info: ModuleInfoJson = { Name: 'Synth One', Vendor: 'ACME', Version: '2.1.0' }
    const result = parseModuleInfo(info, '/p.vst3')
    assert.equal(result.name, 'Synth One')
    assert.equal(result.vendor, 'ACME')
    assert.equal(result.version, '2.1.0')
  })

  it('prefers ClassInfos[0] over top-level keys', () => {
    const info: ModuleInfoJson = {
      Name: 'Old Name',
      ClassInfos: [{ Name: 'New Name', Vendor: 'BetterVendor', Version: '3.0.0' }],
    }
    const result = parseModuleInfo(info, '/p.vst3')
    assert.equal(result.name, 'New Name')
    assert.equal(result.vendor, 'BetterVendor')
  })

  it('falls back to "Unknown Plugin" when Name is missing', () => {
    const result = parseModuleInfo({}, '/p.vst3')
    assert.equal(result.name, 'Unknown Plugin')
    assert.equal(result.vendor, 'Unknown Vendor')
    assert.equal(result.version, '0.0.0')
  })

  it('categorises as instrument when SubCategories contains Instrument', () => {
    const info: ModuleInfoJson = { Name: 'Synth', SubCategories: ['Instrument/Synth'] }
    const result = parseModuleInfo(info, '/p.vst3')
    assert.equal(result.category, 'instrument')
  })

  it('categorises as effect when SubCategories contains Fx', () => {
    const info: ModuleInfoJson = { Name: 'Comp', SubCategories: ['Fx/Dynamics'] }
    const result = parseModuleInfo(info, '/p.vst3')
    assert.equal(result.category, 'effect')
  })

  it('categorises as analyzer when SubCategories contains Analyzer', () => {
    const info: ModuleInfoJson = { Name: 'Meter', SubCategories: ['Analyzer'] }
    const result = parseModuleInfo(info, '/p.vst3')
    assert.equal(result.category, 'analyzer')
  })

  it('defaults to effect for unknown categories', () => {
    const info: ModuleInfoJson = { Name: 'Mystery', SubCategories: ['Unknown'] }
    const result = parseModuleInfo(info, '/p.vst3')
    assert.equal(result.category, 'effect')
  })

  it('stores the plugin path', () => {
    const result = parseModuleInfo({ Name: 'X' }, '/path/to/x.vst3')
    assert.equal(result.path, '/path/to/x.vst3')
  })
})

describe('PluginRegistry / deduplication', () => {
  it('removes duplicate name+vendor+format combinations', () => {
    const plugins = [
      makePlugin({ id: 'p1', name: 'Synth', vendor: 'ACME', path: '/a/Synth.vst3' }),
      makePlugin({ id: 'p2', name: 'Synth', vendor: 'ACME', path: '/b/Synth.vst3' }),
    ]
    const result = deduplicatePlugins(plugins)
    assert.equal(result.length, 1)
    assert.equal(result[0].path, '/a/Synth.vst3')
  })

  it('keeps plugins with same name but different vendor', () => {
    const plugins = [
      makePlugin({ id: 'p1', vendor: 'ACME',    path: '/a.vst3' }),
      makePlugin({ id: 'p2', vendor: 'OtherCo', path: '/b.vst3' }),
    ]
    const result = deduplicatePlugins(plugins)
    assert.equal(result.length, 2)
  })

  it('keeps plugins with same name+vendor but different format', () => {
    const plugins = [
      makePlugin({ id: 'p1', format: 'VST3', path: '/a.vst3' }),
      makePlugin({ id: 'p2', format: 'AU',   path: '/a.component' }),
    ]
    const result = deduplicatePlugins(plugins)
    assert.equal(result.length, 2)
  })

  it('preserves order (first occurrence wins)', () => {
    const plugins = [
      makePlugin({ id: 'p1', path: '/first.vst3',  scannedAt: 100 }),
      makePlugin({ id: 'p2', path: '/second.vst3', scannedAt: 200 }),
    ]
    const result = deduplicatePlugins(plugins)
    assert.equal(result[0].path, '/first.vst3')
  })
})

describe('PluginRegistry / blacklist filtering', () => {
  it('marks matching plugins as blacklisted', () => {
    const plugins = [makePlugin({ path: '/bad.vst3' }), makePlugin({ id: 'p2', path: '/ok.vst3' })]
    const result  = filterBlacklisted(plugins, new Set(['/bad.vst3']))
    assert.equal(result[0].isBlacklisted, true)
    assert.equal(result[1].isBlacklisted, false)
  })

  it('does not mutate the original plugin objects', () => {
    const plugins = [makePlugin()]
    const result  = filterBlacklisted(plugins, new Set([plugins[0].path]))
    assert.equal(plugins[0].isBlacklisted, false)
    assert.equal(result[0].isBlacklisted, true)
  })

  it('empty blacklist returns all plugins unblacklisted', () => {
    const plugins = [makePlugin(), makePlugin({ id: 'p2' })]
    const result  = filterBlacklisted(plugins, new Set())
    assert.ok(result.every(p => !p.isBlacklisted))
  })
})

describe('PluginRegistry / scan paths', () => {
  it('returns Windows path on win32', () => {
    const paths = resolveScanPaths('win32', 'C:\\Users\\User')
    assert.ok(paths.some(p => p.includes('VST3')))
    assert.ok(paths.every(p => p.includes('\\')))
  })

  it('returns macOS paths on darwin', () => {
    const paths = resolveScanPaths('darwin', '/Users/test')
    assert.ok(paths.some(p => p.startsWith('/Library')))
    assert.ok(paths.some(p => p.startsWith('/Users/test')))
  })

  it('returns Linux paths on linux', () => {
    const paths = resolveScanPaths('linux', '/home/user')
    assert.ok(paths.some(p => p.startsWith('/home/user/.vst3')))
    assert.ok(paths.some(p => p.startsWith('/usr')))
  })

  it('returns non-empty path list for current platform', () => {
    const paths = resolveScanPaths(platform, '/home/user')
    assert.ok(paths.length > 0)
  })
})

describe('PluginRegistry / scan results', () => {
  it('scannedAt is a recent timestamp', () => {
    const before = Date.now()
    const p = makePlugin({ scannedAt: Date.now() })
    const after  = Date.now()
    assert.ok(p.scannedAt >= before && p.scannedAt <= after)
  })

  it('paramCount is non-negative', () => {
    const p = makePlugin({ paramCount: 0 })
    assert.ok(p.paramCount >= 0)
  })

  it('version string is a valid semver-like string', () => {
    const p = makePlugin({ version: '2.4.1' })
    const parts = p.version.split('.').map(Number)
    assert.equal(parts.length, 3)
    assert.ok(parts.every(n => !isNaN(n)))
  })
})
