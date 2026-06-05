import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { SampleDatabaseManager } from '../../src/main/samples/SampleDatabase.ts'
import type { SampleFileEntry } from '../../src/main/samples/FileScanner.ts'

// ─── Helpers ──────────────────────────────────────────────────────────────────

let testDir: string

before(async () => {
  testDir = join(tmpdir(), `sampledb-test-${process.pid}-${Date.now()}`)
  await fs.mkdir(testDir, { recursive: true })
})

after(async () => {
  await fs.rm(testDir, { recursive: true, force: true })
})

function makeEntry(name: string, dirPath = '/samples'): SampleFileEntry {
  return {
    path:       `${dirPath}/${name}.wav`,
    name,
    ext:        'wav',
    type:       'wav',
    sizeBytes:  1024,
    modifiedAt: Date.now(),
    dirPath,
  }
}

function makeDb(): SampleDatabaseManager {
  const dir = join(testDir, `db-${Math.random().toString(36).slice(2, 8)}`)
  return new SampleDatabaseManager({ dir })
}

// ─── indexEntries / getRecord ─────────────────────────────────────────────────

describe('SampleDatabase / indexEntries', () => {
  it('indexes entries and retrieves by id', () => {
    const db = makeDb()
    const entries = [makeEntry('kick'), makeEntry('snare')]
    db.indexEntries('/samples', entries)
    // Each entry should be findable via search
    const results = db.search('kick')
    assert.equal(results.length, 1)
    assert.equal(results[0].name, 'kick')
  })

  it('returns correct count of added entries', () => {
    const db = makeDb()
    const entries = [makeEntry('a'), makeEntry('b'), makeEntry('c')]
    const added = db.indexEntries('/samples', entries)
    assert.equal(added, 3)
  })

  it('does not double-count on re-index of same paths', () => {
    const db = makeDb()
    const entries = [makeEntry('kick')]
    db.indexEntries('/samples', entries)
    const added2 = db.indexEntries('/samples', entries)
    assert.equal(added2, 0, 'second index of same path adds 0')
  })

  it('registers the rootDir', () => {
    const db = makeDb()
    db.indexEntries('/my-samples', [makeEntry('x', '/my-samples')])
    assert.ok(db.getRootDirs().includes('/my-samples'))
  })

  it('getRecord returns the record by id', () => {
    const db = makeDb()
    db.indexEntries('/s', [makeEntry('pad', '/s')])
    const all = db.search('pad')
    assert.equal(all.length, 1)
    const rec = db.getRecord(all[0].id)
    assert.ok(rec !== null)
    assert.equal(rec!.name, 'pad')
  })

  it('getRecord returns null for unknown id', () => {
    const db = makeDb()
    assert.equal(db.getRecord('nonexistent'), null)
  })
})

// ─── search ───────────────────────────────────────────────────────────────────

describe('SampleDatabase / search', () => {
  it('empty query returns all records', () => {
    const db = makeDb()
    db.indexEntries('/s', [makeEntry('kick'), makeEntry('snare'), makeEntry('hihat')])
    const results = db.search('')
    assert.equal(results.length, 3)
  })

  it('query filters by name (case-insensitive)', () => {
    const db = makeDb()
    db.indexEntries('/s', [makeEntry('kick'), makeEntry('KickVariation'), makeEntry('snare')])
    const results = db.search('kick')
    assert.equal(results.length, 2)
  })

  it('multi-word query requires all words', () => {
    const db = makeDb()
    db.indexEntries('/s', [makeEntry('kick_hard'), makeEntry('kick_soft'), makeEntry('snare_hard')])
    const results = db.search('kick hard')
    assert.equal(results.length, 1)
    assert.equal(results[0].name, 'kick_hard')
  })

  it('type filter restricts to given type', () => {
    const db = makeDb()
    const entries: SampleFileEntry[] = [
      { ...makeEntry('kick'), ext: 'wav', type: 'wav' },
      { ...makeEntry('beat'), ext: 'mid', type: 'mid', path: '/s/beat.mid' },
    ]
    db.indexEntries('/s', entries)
    const wavResults = db.search('', { type: 'wav' })
    assert.equal(wavResults.length, 1)
    assert.equal(wavResults[0].name, 'kick')
  })

  it('favorite filter restricts to favorites', () => {
    const db = makeDb()
    db.indexEntries('/s', [makeEntry('kick'), makeEntry('snare')])
    const all = db.search('')
    db.setFavorite(all[0].id, true)
    const favs = db.search('', { favorite: true })
    assert.equal(favs.length, 1)
    assert.equal(favs[0].id, all[0].id)
  })

  it('tags filter restricts to records having all given tags', () => {
    const db = makeDb()
    db.indexEntries('/s', [makeEntry('kick'), makeEntry('snare')])
    const all = db.search('')
    db.addTag(all[0].id, 'heavy')
    db.addTag(all[0].id, 'bass')
    db.addTag(all[1].id, 'heavy')
    const results = db.search('', { tags: ['heavy', 'bass'] })
    assert.equal(results.length, 1)
    assert.equal(results[0].id, all[0].id)
  })
})

// ─── favorites ────────────────────────────────────────────────────────────────

describe('SampleDatabase / favorites', () => {
  it('setFavorite true marks a record', () => {
    const db = makeDb()
    db.indexEntries('/s', [makeEntry('kick')])
    const id = db.search('')[0].id
    db.setFavorite(id, true)
    assert.equal(db.getRecord(id)!.favorite, true)
  })

  it('setFavorite false unmarks a record', () => {
    const db = makeDb()
    db.indexEntries('/s', [makeEntry('kick')])
    const id = db.search('')[0].id
    db.setFavorite(id, true)
    db.setFavorite(id, false)
    assert.equal(db.getRecord(id)!.favorite, false)
  })

  it('getStats counts favorites', () => {
    const db = makeDb()
    db.indexEntries('/s', [makeEntry('a'), makeEntry('b'), makeEntry('c')])
    const ids = db.search('').map((r) => r.id)
    db.setFavorite(ids[0], true)
    db.setFavorite(ids[2], true)
    const stats = db.getStats()
    assert.equal(stats.favorites, 2)
  })
})

// ─── tags ─────────────────────────────────────────────────────────────────────

describe('SampleDatabase / tags', () => {
  it('addTag adds a tag to a record', () => {
    const db = makeDb()
    db.indexEntries('/s', [makeEntry('kick')])
    const id = db.search('')[0].id
    db.addTag(id, 'punchy')
    assert.ok(db.getRecord(id)!.tags.includes('punchy'))
  })

  it('addTag does not duplicate existing tag', () => {
    const db = makeDb()
    db.indexEntries('/s', [makeEntry('kick')])
    const id = db.search('')[0].id
    db.addTag(id, 'punchy')
    db.addTag(id, 'punchy')
    assert.equal(db.getRecord(id)!.tags.length, 1)
  })

  it('removeTag removes tag from a record', () => {
    const db = makeDb()
    db.indexEntries('/s', [makeEntry('kick')])
    const id = db.search('')[0].id
    db.addTag(id, 'punchy')
    db.removeTag(id, 'punchy')
    assert.equal(db.getRecord(id)!.tags.length, 0)
  })

  it('getAllTags returns union of all tags sorted', () => {
    const db = makeDb()
    db.indexEntries('/s', [makeEntry('a'), makeEntry('b')])
    const ids = db.search('').map((r) => r.id)
    db.addTag(ids[0], 'zebra')
    db.addTag(ids[1], 'alpha')
    db.addTag(ids[0], 'mid')
    const tags = db.getAllTags()
    assert.deepEqual(tags, ['alpha', 'mid', 'zebra'])
  })
})

// ─── pruneStale ───────────────────────────────────────────────────────────────

describe('SampleDatabase / pruneStale', () => {
  it('removes records whose paths are not in the provided set', () => {
    const db = makeDb()
    const e1 = makeEntry('kick')
    const e2 = makeEntry('snare')
    db.indexEntries('/s', [e1, e2])
    const removed = db.pruneStale(new Set([e1.path]))
    assert.equal(removed, 1)
    assert.equal(db.search('').length, 1)
    assert.equal(db.search('')[0].name, 'kick')
  })

  it('returns 0 when nothing is stale', () => {
    const db = makeDb()
    const e = makeEntry('kick')
    db.indexEntries('/s', [e])
    const removed = db.pruneStale(new Set([e.path]))
    assert.equal(removed, 0)
  })
})

// ─── removeRootDir ────────────────────────────────────────────────────────────

describe('SampleDatabase / removeRootDir', () => {
  it('removes rootDir from list', () => {
    const db = makeDb()
    db.indexEntries('/mylib', [makeEntry('pad', '/mylib')])
    db.removeRootDir('/mylib')
    assert.ok(!db.getRootDirs().includes('/mylib'))
  })

  it('removes all records from that dir', () => {
    const db = makeDb()
    db.indexEntries('/mylib', [makeEntry('pad', '/mylib'), makeEntry('kick', '/mylib')])
    db.indexEntries('/other', [makeEntry('snare', '/other')])
    db.removeRootDir('/mylib')
    const results = db.search('')
    assert.equal(results.length, 1)
    assert.equal(results[0].name, 'snare')
  })
})

// ─── getStats ─────────────────────────────────────────────────────────────────

describe('SampleDatabase / getStats', () => {
  it('reports totalRecords correctly', () => {
    const db = makeDb()
    db.indexEntries('/s', [makeEntry('a'), makeEntry('b'), makeEntry('c')])
    const stats = db.getStats()
    assert.equal(stats.totalRecords, 3)
  })

  it('reports rootDirs count', () => {
    const db = makeDb()
    db.indexEntries('/s1', [makeEntry('a', '/s1')])
    db.indexEntries('/s2', [makeEntry('b', '/s2')])
    const stats = db.getStats()
    assert.equal(stats.rootDirs, 2)
  })
})

// ─── persistence (save/load) ──────────────────────────────────────────────────

describe('SampleDatabase / save and load', () => {
  it('save then load restores records', async () => {
    const dir = join(testDir, `persist-${Date.now()}`)
    const db1 = new SampleDatabaseManager({ dir })
    db1.indexEntries('/s', [makeEntry('kick')])
    db1.setFavorite(db1.search('')[0].id, true)
    await db1.save()

    const db2 = new SampleDatabaseManager({ dir })
    await db2.load()
    const results = db2.search('')
    assert.equal(results.length, 1)
    assert.equal(results[0].name, 'kick')
    assert.equal(results[0].favorite, true)
  })

  it('save is idempotent when not dirty (no error)', async () => {
    const db = makeDb()
    await db.save()   // no-op, should not throw
    await db.save()
  })

  it('load on missing file does not throw (fresh start)', async () => {
    const dir = join(testDir, `fresh-${Date.now()}`)
    const db = new SampleDatabaseManager({ dir })
    await db.load()   // file does not exist yet
    assert.equal(db.getStats().totalRecords, 0)
  })
})
