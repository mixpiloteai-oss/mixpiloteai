// ─── VstDatabase.test.ts ──────────────────────────────────────────────────────
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { VstDatabase } from '../../src/main/vst/VstDatabase.ts'
import type { ScannedPlugin, PluginCategory } from '../../src/main/vst/VstDatabase.ts'

function makePlugin(overrides: Partial<ScannedPlugin> = {}): ScannedPlugin {
  return {
    id: 'test_plugin_1',
    name: 'Test Synth',
    vendor: 'Acme Audio',
    version: '1.0.0',
    category: 'instrument' as PluginCategory,
    path: '/usr/lib/vst3/TestSynth.vst3',
    hasEditor: true,
    paramCount: 8,
    inputBusCount: 0,
    outputBusCount: 2,
    supportsMidi: true,
    supportsMultiOut: false,
    scanTimestamp: Date.now(),
    ...overrides,
  }
}

let dir: string
let db: VstDatabase

before(() => {
  dir = mkdtempSync(join(tmpdir(), 'vst-db-test-'))
  db = new VstDatabase(join(dir, 'vst-database.json'))
})

after(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('VstDatabase', () => {
  it('addPlugin + getPlugin returns correct entry', () => {
    const p = makePlugin()
    db.addPlugin(p)
    const got = db.getPlugin(p.id)
    assert.ok(got !== undefined)
    assert.equal(got.id, p.id)
    assert.equal(got.name, p.name)
    assert.equal(got.vendor, p.vendor)
  })

  it('removePlugin removes the entry', () => {
    const p = makePlugin({ id: 'plugin_to_remove', name: 'Remove Me' })
    db.addPlugin(p)
    assert.ok(db.getPlugin(p.id) !== undefined)
    db.removePlugin(p.id)
    assert.equal(db.getPlugin(p.id), undefined)
  })

  it('getByCategory filters correctly', () => {
    db.addPlugin(makePlugin({ id: 'inst_1', name: 'Instrument 1', category: 'instrument' }))
    db.addPlugin(makePlugin({ id: 'fx_1', name: 'Effect 1', category: 'effect' }))
    db.addPlugin(makePlugin({ id: 'fx_2', name: 'Effect 2', category: 'effect' }))

    const instruments = db.getByCategory('instrument')
    const effects = db.getByCategory('effect')

    assert.ok(instruments.every(p => p.category === 'instrument'))
    assert.ok(effects.every(p => p.category === 'effect'))
    assert.ok(effects.length >= 2)
  })

  it('search matches name substring (case-insensitive)', () => {
    db.addPlugin(makePlugin({ id: 'search_name', name: 'SuperReverb Pro', vendor: 'TestCo', category: 'effect' }))
    const results = db.search('superreverb')
    assert.ok(results.some(p => p.id === 'search_name'))
  })

  it('search matches vendor substring (case-insensitive)', () => {
    db.addPlugin(makePlugin({ id: 'search_vendor', name: 'CoolSynth', vendor: 'UniqueVendorXYZ', category: 'instrument' }))
    const results = db.search('uniquevendorxyz')
    assert.ok(results.some(p => p.id === 'search_vendor'))
  })

  it('search is case-insensitive', () => {
    db.addPlugin(makePlugin({ id: 'search_case', name: 'MixMaster', vendor: 'Fab', category: 'effect' }))
    const results1 = db.search('MIXMASTER')
    const results2 = db.search('mixmaster')
    assert.ok(results1.some(p => p.id === 'search_case'))
    assert.ok(results2.some(p => p.id === 'search_case'))
  })

  it('markFailed + getFailedPlugins works', () => {
    db.markFailed('broken_plugin', 'Segfault on load')
    const failed = db.getFailedPlugins()
    assert.equal(failed.get('broken_plugin'), 'Segfault on load')
  })

  it('getFailedPlugins returns a copy', () => {
    db.markFailed('plugin_a', 'Error A')
    const failed1 = db.getFailedPlugins()
    db.markFailed('plugin_b', 'Error B')
    const failed2 = db.getFailedPlugins()
    // First map should not have plugin_b
    assert.equal(failed1.has('plugin_b'), false)
    assert.equal(failed2.has('plugin_b'), true)
  })

  it('load + save round-trips data', async () => {
    const db2 = new VstDatabase(join(dir, 'roundtrip.json'))
    const p = makePlugin({ id: 'rt_plugin', name: 'Round Trip' })
    db2.addPlugin(p)
    db2.markFailed('rt_failed', 'test error')
    await db2.save()

    const db3 = new VstDatabase(join(dir, 'roundtrip.json'))
    await db3.load()
    const got = db3.getPlugin('rt_plugin')
    assert.ok(got !== undefined)
    assert.equal(got.name, 'Round Trip')
    assert.equal(db3.getFailedPlugins().get('rt_failed'), 'test error')
  })
})
