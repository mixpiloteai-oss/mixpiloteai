import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SampleDatabaseManager } from '../../src/main/samples/SampleDatabase.ts'

// Create a temp dir for each test
function makeTempDb() {
  const dir = mkdtempSync(join(tmpdir(), 'sample-db-test-'))
  const db = new SampleDatabaseManager({ dir })
  return { db, dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}

test('createCollection adds a collection', () => {
  const { db, cleanup } = makeTempDb()
  try {
    const col = db.createCollection('My Kicks')
    assert.strictEqual(col.name, 'My Kicks')
    assert.ok(col.id.length > 0)
    assert.deepStrictEqual(col.sampleIds, [])
    const list = db.listCollections()
    assert.strictEqual(list.length, 1)
    assert.strictEqual(list[0]!.name, 'My Kicks')
  } finally { cleanup() }
})

test('addToCollection adds sample id', () => {
  const { db, cleanup } = makeTempDb()
  try {
    const col = db.createCollection('Test')
    db.addToCollection(col.id, 'sample-abc')
    const list = db.listCollections()
    assert.ok(list[0]!.sampleIds.includes('sample-abc'))
  } finally { cleanup() }
})

test('addToCollection is idempotent', () => {
  const { db, cleanup } = makeTempDb()
  try {
    const col = db.createCollection('Test')
    db.addToCollection(col.id, 'abc')
    db.addToCollection(col.id, 'abc')
    assert.strictEqual(db.listCollections()[0]!.sampleIds.length, 1)
  } finally { cleanup() }
})

test('removeFromCollection removes sample id', () => {
  const { db, cleanup } = makeTempDb()
  try {
    const col = db.createCollection('Test')
    db.addToCollection(col.id, 'abc')
    db.removeFromCollection(col.id, 'abc')
    assert.strictEqual(db.listCollections()[0]!.sampleIds.length, 0)
  } finally { cleanup() }
})

test('deleteCollection removes it', () => {
  const { db, cleanup } = makeTempDb()
  try {
    const col = db.createCollection('ToDelete')
    db.deleteCollection(col.id)
    assert.strictEqual(db.listCollections().length, 0)
  } finally { cleanup() }
})

test('createSmartFolder stores query and opts', () => {
  const { db, cleanup } = makeTempDb()
  try {
    const sf = db.createSmartFolder('Kicks 120bpm', 'kick', { type: 'wav', favorite: null, tags: ['kick'] })
    assert.strictEqual(sf.name, 'Kicks 120bpm')
    assert.strictEqual(sf.query, 'kick')
    assert.strictEqual(sf.type, 'wav')
    const list = db.listSmartFolders()
    assert.strictEqual(list.length, 1)
    assert.deepStrictEqual(list[0]!.tags, ['kick'])
  } finally { cleanup() }
})

test('deleteSmartFolder removes it', () => {
  const { db, cleanup } = makeTempDb()
  try {
    const sf = db.createSmartFolder('Test', 'q', { type: null, favorite: null, tags: [] })
    db.deleteSmartFolder(sf.id)
    assert.strictEqual(db.listSmartFolders().length, 0)
  } finally { cleanup() }
})

test('collections persist across load/save cycle', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sample-db-persist-'))
  try {
    const db1 = new SampleDatabaseManager({ dir })
    db1.createCollection('Saved')
    await db1.save()

    const db2 = new SampleDatabaseManager({ dir })
    await db2.load()
    const list = db2.listCollections()
    assert.strictEqual(list.length, 1)
    assert.strictEqual(list[0]!.name, 'Saved')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
