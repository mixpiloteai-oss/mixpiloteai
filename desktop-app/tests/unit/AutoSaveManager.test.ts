import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { AutoSaveManager } from '../../src/main/autosave.ts'

let dir:  string
let mgr:  AutoSaveManager

before(() => {
  dir = mkdtempSync(join(tmpdir(), 'autosave-test-'))
  mgr = new AutoSaveManager({ dir })
})

after(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('AutoSaveManager', () => {
  it('save() creates a .json file in the dir', async () => {
    await mgr.save({ hello: 'world' })
    const files = (await readdir(dir)).filter(f => f.endsWith('.json'))
    assert.ok(files.length >= 1)
  })

  it('no .tmp file remains after save', async () => {
    await mgr.save({ x: 1 })
    const tmps = (await readdir(dir)).filter(f => f.endsWith('.tmp'))
    assert.equal(tmps.length, 0)
  })

  it('loadLatest() returns saved data', async () => {
    const d = mkdtempSync(join(tmpdir(), 'autosave-load-'))
    const m = new AutoSaveManager({ dir: d })
    try {
      await m.save({ key: 'value' })
      const loaded = await m.loadLatest()
      assert.deepEqual(loaded, { key: 'value' })
    } finally {
      rmSync(d, { recursive: true, force: true })
    }
  })

  it('listVersions() returns entries with filename and sizeBytes', async () => {
    const d = mkdtempSync(join(tmpdir(), 'autosave-list-'))
    const m = new AutoSaveManager({ dir: d })
    try {
      await m.save({ n: 1 })
      // small delay to ensure distinct millisecond timestamps
      await new Promise(r => setTimeout(r, 5))
      await m.save({ n: 2 })
      const versions = await m.listVersions()
      assert.equal(versions.length, 2)
      assert.ok(versions[0].filename.startsWith('autosave-'))
      assert.ok(versions[0].sizeBytes > 0)
    } finally {
      rmSync(d, { recursive: true, force: true })
    }
  })

  it('getVersion(filename) returns the data', async () => {
    const d = mkdtempSync(join(tmpdir(), 'autosave-gv-'))
    const m = new AutoSaveManager({ dir: d })
    try {
      await m.save({ test: 99 })
      const versions = await m.listVersions()
      const loaded   = await m.getVersion(versions[0].filename)
      assert.deepEqual(loaded, { test: 99 })
    } finally {
      rmSync(d, { recursive: true, force: true })
    }
  })

  it('getVersion with path traversal returns null', async () => {
    const result = await mgr.getVersion('../../../etc/passwd')
    assert.equal(result, null)
  })

  it('rotation: 12 saves keeps at most 10 files', async () => {
    const d = mkdtempSync(join(tmpdir(), 'autosave-rotate-'))
    const m = new AutoSaveManager({ dir: d, maxVersions: 10 })
    try {
      for (let i = 0; i < 12; i++) {
        await m.save({ i })
        // small delay to ensure distinct timestamps
        await new Promise(r => setTimeout(r, 5))
      }
      const versions = await m.listVersions()
      assert.ok(versions.length <= 10)
    } finally {
      rmSync(d, { recursive: true, force: true })
    }
  })
})
