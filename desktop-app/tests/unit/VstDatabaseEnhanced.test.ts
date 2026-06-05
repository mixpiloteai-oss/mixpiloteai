// ─── VstDatabaseEnhanced.test.ts ──────────────────────────────────────────────
import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { VstDatabase } from '../../src/main/vst/VstDatabase.ts'
import type { ScannedPlugin, PluginCategory } from '../../src/main/vst/VstDatabase.ts'

function makePlugin(overrides: Partial<ScannedPlugin> = {}): ScannedPlugin {
  return {
    id: 'plugin_1',
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

let tmpDir: string
let db: VstDatabase

before(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vst-db-enhanced-test-'))
})

after(() => {
  try { rmSync(tmpDir, { recursive: true, force: true }) } catch { /* ignore */ }
})

beforeEach(() => {
  db = new VstDatabase(join(tmpDir, `vst-${Date.now()}.json`))
})

// ── Favorites ─────────────────────────────────────────────────────────────────

describe('VstDatabase favorites', () => {
  it('addFavorite + getFavorites returns the favorited plugin', () => {
    const p = makePlugin()
    db.addPlugin(p)
    db.addFavorite(p.id)

    const favs = db.getFavorites()
    assert.strictEqual(favs.length, 1)
    assert.strictEqual(favs[0].id, p.id)
  })

  it('removeFavorite removes plugin from favorites', () => {
    const p = makePlugin()
    db.addPlugin(p)
    db.addFavorite(p.id)
    db.removeFavorite(p.id)

    const favs = db.getFavorites()
    assert.strictEqual(favs.length, 0)
  })

  it('isFavorite returns true after addFavorite', () => {
    const p = makePlugin()
    db.addPlugin(p)
    db.addFavorite(p.id)
    assert.strictEqual(db.isFavorite(p.id), true)
  })

  it('isFavorite returns false for non-favorited plugin', () => {
    const p = makePlugin()
    db.addPlugin(p)
    assert.strictEqual(db.isFavorite(p.id), false)
  })

  it('isFavorite returns false after removeFavorite', () => {
    const p = makePlugin()
    db.addPlugin(p)
    db.addFavorite(p.id)
    db.removeFavorite(p.id)
    assert.strictEqual(db.isFavorite(p.id), false)
  })

  it('getFavorites only returns plugins that exist in the plugin map', () => {
    const p = makePlugin()
    // Add favorite WITHOUT adding plugin first
    db.addFavorite('nonexistent_plugin')
    db.addPlugin(p)
    db.addFavorite(p.id)

    const favs = db.getFavorites()
    assert.strictEqual(favs.length, 1, 'Should only return plugins that exist')
    assert.strictEqual(favs[0].id, p.id)
  })

  it('addFavorite is idempotent', () => {
    const p = makePlugin()
    db.addPlugin(p)
    db.addFavorite(p.id)
    db.addFavorite(p.id)
    db.addFavorite(p.id)
    assert.strictEqual(db.getFavorites().length, 1)
  })
})

// ── Tags ──────────────────────────────────────────────────────────────────────

describe('VstDatabase tags', () => {
  it('addTag + getByTag returns correct plugins', () => {
    const p1 = makePlugin({ id: 'p1', name: 'Synth 1' })
    const p2 = makePlugin({ id: 'p2', name: 'Synth 2', category: 'effect' })
    db.addPlugin(p1)
    db.addPlugin(p2)

    db.addTag('p1', 'favorite')
    db.addTag('p2', 'warmth')
    db.addTag('p1', 'warmth')

    const warmth = db.getByTag('warmth')
    assert.strictEqual(warmth.length, 2)
    const ids = warmth.map(p => p.id)
    assert.ok(ids.includes('p1'))
    assert.ok(ids.includes('p2'))
  })

  it('getAllTags returns union of all tags', () => {
    const p1 = makePlugin({ id: 'p1' })
    const p2 = makePlugin({ id: 'p2', category: 'effect' })
    db.addPlugin(p1)
    db.addPlugin(p2)

    db.addTag('p1', 'alpha')
    db.addTag('p1', 'beta')
    db.addTag('p2', 'beta')
    db.addTag('p2', 'gamma')

    const all = db.getAllTags()
    assert.ok(all.includes('alpha'))
    assert.ok(all.includes('beta'))
    assert.ok(all.includes('gamma'))
    // No duplicates
    const betaCount = all.filter(t => t === 'beta').length
    assert.strictEqual(betaCount, 1)
  })

  it('removeTag removes tag from plugin', () => {
    const p = makePlugin()
    db.addPlugin(p)
    db.addTag(p.id, 'removeme')
    db.addTag(p.id, 'keepme')
    db.removeTag(p.id, 'removeme')

    const tags = db.getTags(p.id)
    assert.ok(!tags.includes('removeme'))
    assert.ok(tags.includes('keepme'))
  })

  it('addTag is idempotent', () => {
    const p = makePlugin()
    db.addPlugin(p)
    db.addTag(p.id, 'unique')
    db.addTag(p.id, 'unique')
    db.addTag(p.id, 'unique')

    const tags = db.getTags(p.id)
    assert.strictEqual(tags.filter(t => t === 'unique').length, 1)
  })

  it('getByTag returns empty array for unknown tag', () => {
    const result = db.getByTag('no-such-tag')
    assert.deepStrictEqual(result, [])
  })
})

// ── Collections ───────────────────────────────────────────────────────────────

describe('VstDatabase collections', () => {
  it('createCollection + getCollection works', () => {
    const coll = db.createCollection('My Synths')
    assert.ok(typeof coll.id === 'string' && coll.id.length > 0)
    assert.strictEqual(coll.name, 'My Synths')
    assert.deepStrictEqual(coll.pluginIds, [])

    const retrieved = db.getCollection(coll.id)
    assert.ok(retrieved !== undefined)
    assert.strictEqual(retrieved.name, 'My Synths')
  })

  it('addToCollection + getCollection shows plugin in collection', () => {
    const p = makePlugin()
    db.addPlugin(p)
    const coll = db.createCollection('My Effects')
    db.addToCollection(coll.id, p.id)

    const retrieved = db.getCollection(coll.id)
    assert.ok(retrieved !== undefined)
    assert.ok(retrieved.pluginIds.includes(p.id))
  })

  it('removeFromCollection removes plugin from collection', () => {
    const p = makePlugin()
    db.addPlugin(p)
    const coll = db.createCollection('Temp')
    db.addToCollection(coll.id, p.id)
    db.removeFromCollection(coll.id, p.id)

    const retrieved = db.getCollection(coll.id)
    assert.ok(retrieved !== undefined)
    assert.ok(!retrieved.pluginIds.includes(p.id))
  })

  it('getAllCollections returns all collections', () => {
    db.createCollection('A')
    db.createCollection('B')
    db.createCollection('C')

    const all = db.getAllCollections()
    assert.strictEqual(all.length, 3)
    const names = all.map(c => c.name)
    assert.ok(names.includes('A'))
    assert.ok(names.includes('B'))
    assert.ok(names.includes('C'))
  })

  it('addToCollection throws for unknown collection', () => {
    assert.throws(
      () => db.addToCollection('nonexistent-id', 'plugin_1'),
      /Collection not found/
    )
  })

  it('addToCollection is idempotent', () => {
    const p = makePlugin()
    db.addPlugin(p)
    const coll = db.createCollection('Idempotent')
    db.addToCollection(coll.id, p.id)
    db.addToCollection(coll.id, p.id)
    db.addToCollection(coll.id, p.id)

    const retrieved = db.getCollection(coll.id)
    assert.strictEqual(retrieved?.pluginIds.filter(id => id === p.id).length, 1)
  })
})

// ── searchAdvanced ────────────────────────────────────────────────────────────

describe('VstDatabase.searchAdvanced', () => {
  it('favoritesOnly=true returns only favorited plugins', () => {
    const p1 = makePlugin({ id: 'p1', name: 'Fav Synth' })
    const p2 = makePlugin({ id: 'p2', name: 'Unfav Effect', category: 'effect' })
    db.addPlugin(p1)
    db.addPlugin(p2)
    db.addFavorite('p1')

    const results = db.searchAdvanced('', { favoritesOnly: true })
    assert.strictEqual(results.length, 1)
    assert.strictEqual(results[0].id, 'p1')
  })

  it('category filter returns correct subset', () => {
    const p1 = makePlugin({ id: 'p1', category: 'instrument' })
    const p2 = makePlugin({ id: 'p2', category: 'effect' })
    const p3 = makePlugin({ id: 'p3', category: 'analyzer' })
    db.addPlugin(p1)
    db.addPlugin(p2)
    db.addPlugin(p3)

    const results = db.searchAdvanced('', { category: 'effect' })
    assert.strictEqual(results.length, 1)
    assert.strictEqual(results[0].id, 'p2')
  })

  it('tags filter returns plugins having all specified tags', () => {
    const p1 = makePlugin({ id: 'p1' })
    const p2 = makePlugin({ id: 'p2', category: 'effect' })
    db.addPlugin(p1)
    db.addPlugin(p2)
    db.addTag('p1', 'warm')
    db.addTag('p1', 'analog')
    db.addTag('p2', 'warm')

    // Both have 'warm', only p1 has 'analog'
    const warmOnly = db.searchAdvanced('', { tags: ['warm'] })
    assert.strictEqual(warmOnly.length, 2)

    const warmAndAnalog = db.searchAdvanced('', { tags: ['warm', 'analog'] })
    assert.strictEqual(warmAndAnalog.length, 1)
    assert.strictEqual(warmAndAnalog[0].id, 'p1')
  })

  it('collectionId filter returns only plugins in that collection', () => {
    const p1 = makePlugin({ id: 'p1' })
    const p2 = makePlugin({ id: 'p2', category: 'effect' })
    db.addPlugin(p1)
    db.addPlugin(p2)
    const coll = db.createCollection('MyCollection')
    db.addToCollection(coll.id, 'p1')

    const results = db.searchAdvanced('', { collectionId: coll.id })
    assert.strictEqual(results.length, 1)
    assert.strictEqual(results[0].id, 'p1')
  })

  it('text query matches vendor and tag', () => {
    const p1 = makePlugin({ id: 'p1', name: 'ZapSynth', vendor: 'Acme Corp' })
    const p2 = makePlugin({ id: 'p2', name: 'BlipFX', vendor: 'Other Co', category: 'effect' })
    db.addPlugin(p1)
    db.addPlugin(p2)
    db.addTag('p2', 'vintage')

    const acme = db.searchAdvanced('acme', {})
    assert.strictEqual(acme.length, 1)
    assert.strictEqual(acme[0].id, 'p1')

    const vintage = db.searchAdvanced('vintage', {})
    assert.strictEqual(vintage.length, 1)
    assert.strictEqual(vintage[0].id, 'p2')
  })

  it('empty query with no filters returns all plugins', () => {
    db.addPlugin(makePlugin({ id: 'p1' }))
    db.addPlugin(makePlugin({ id: 'p2', category: 'effect' }))
    db.addPlugin(makePlugin({ id: 'p3', category: 'analyzer' }))

    const all = db.searchAdvanced('', {})
    assert.strictEqual(all.length, 3)
  })
})

// ── Persistence ───────────────────────────────────────────────────────────────

describe('VstDatabase persistence (favorites + tags + collections)', () => {
  it('favorites are preserved after save + load', async () => {
    const dbPath = join(tmpDir, 'persist-test.json')
    const db1 = new VstDatabase(dbPath)
    const p = makePlugin({ id: 'persist_p1' })
    db1.addPlugin(p)
    db1.addFavorite(p.id)
    await db1.save()

    const db2 = new VstDatabase(dbPath)
    await db2.load()
    assert.strictEqual(db2.isFavorite(p.id), true)
    assert.strictEqual(db2.getFavorites().length, 1)
  })

  it('tags are preserved after save + load', async () => {
    const dbPath = join(tmpDir, 'persist-tags.json')
    const db1 = new VstDatabase(dbPath)
    const p = makePlugin({ id: 'persist_tag' })
    db1.addPlugin(p)
    db1.addTag(p.id, 'alpha')
    db1.addTag(p.id, 'beta')
    await db1.save()

    const db2 = new VstDatabase(dbPath)
    await db2.load()
    const tags = db2.getTags(p.id)
    assert.ok(tags.includes('alpha'))
    assert.ok(tags.includes('beta'))
  })

  it('collections are preserved after save + load', async () => {
    const dbPath = join(tmpDir, 'persist-colls.json')
    const db1 = new VstDatabase(dbPath)
    const p = makePlugin({ id: 'persist_coll' })
    db1.addPlugin(p)
    const coll = db1.createCollection('Saved Collection')
    db1.addToCollection(coll.id, p.id)
    await db1.save()

    const db2 = new VstDatabase(dbPath)
    await db2.load()
    const colls = db2.getAllCollections()
    assert.strictEqual(colls.length, 1)
    assert.strictEqual(colls[0].name, 'Saved Collection')
    assert.ok(colls[0].pluginIds.includes(p.id))
  })

  it('all data (favorites + tags + collections) persists together', async () => {
    const dbPath = join(tmpDir, 'persist-all.json')
    const db1 = new VstDatabase(dbPath)

    const p1 = makePlugin({ id: 'all_p1', name: 'FullPersist' })
    const p2 = makePlugin({ id: 'all_p2', category: 'effect', name: 'FullPersist2' })
    db1.addPlugin(p1)
    db1.addPlugin(p2)
    db1.addFavorite('all_p1')
    db1.addTag('all_p1', 'warm')
    db1.addTag('all_p2', 'clean')
    const coll = db1.createCollection('Persist All')
    db1.addToCollection(coll.id, 'all_p1')
    await db1.save()

    const db2 = new VstDatabase(dbPath)
    await db2.load()

    assert.strictEqual(db2.isFavorite('all_p1'), true)
    assert.strictEqual(db2.isFavorite('all_p2'), false)
    assert.ok(db2.getTags('all_p1').includes('warm'))
    assert.ok(db2.getTags('all_p2').includes('clean'))
    const loaded = db2.getAllCollections()
    assert.strictEqual(loaded.length, 1)
    assert.ok(loaded[0].pluginIds.includes('all_p1'))
  })
})
