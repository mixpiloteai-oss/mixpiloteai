import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { BackupRotator } from '../../src/main/safety/BackupRotator.ts'

let dir: string
let rotator: BackupRotator

const SAMPLE_JSON = JSON.stringify({ version: 1, projectId: 'proj-test', bpm: 128, checksum: 12345 })

before(() => {
  dir = mkdtempSync(join(tmpdir(), 'backup-rotator-test-'))
  rotator = new BackupRotator(dir, 5)
})

after(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('BackupRotator', () => {
  it('saveSnapshot creates a .bak.json file in the backup dir', async () => {
    const entry = await rotator.saveSnapshot(SAMPLE_JSON, 'proj-test', 'Test Project')
    const filePath = join(dir, `${entry.id}.bak.json`)
    assert.ok(existsSync(filePath), `Expected file at ${filePath}`)
  })

  it('listSnapshots returns the saved entry', async () => {
    const list = await rotator.listSnapshots()
    assert.ok(list.length >= 1)
    assert.ok(list.some(e => e.projectId === 'proj-test'))
  })

  it('listSnapshots returns entries sorted newest first', async () => {
    // Save two snapshots
    await rotator.saveSnapshot(SAMPLE_JSON, 'proj-test', 'Test Project')
    await rotator.saveSnapshot(SAMPLE_JSON, 'proj-test', 'Test Project')

    const list = await rotator.listSnapshots()
    for (let i = 1; i < list.length; i++) {
      assert.ok(list[i - 1].savedAt >= list[i].savedAt)
    }
  })

  it('listSnapshots can filter by projectId', async () => {
    await rotator.saveSnapshot(SAMPLE_JSON, 'other-project', 'Other Project')
    const list = await rotator.listSnapshots('proj-test')
    assert.ok(list.every(e => e.projectId === 'proj-test'))
  })

  it('loadSnapshot returns the saved JSON', async () => {
    const entry = await rotator.saveSnapshot(SAMPLE_JSON, 'proj-load', 'Load Test')
    const loaded = await rotator.loadSnapshot(entry.id)
    assert.equal(loaded, SAMPLE_JSON)
  })

  it('loadSnapshot returns null for unknown id', async () => {
    const result = await rotator.loadSnapshot('nonexistent-id')
    assert.equal(result, null)
  })

  it('deleteSnapshot removes the entry from the list and deletes the file', async () => {
    const entry = await rotator.saveSnapshot(SAMPLE_JSON, 'proj-delete', 'Delete Test')
    const filePath = join(dir, `${entry.id}.bak.json`)
    assert.ok(existsSync(filePath))

    await rotator.deleteSnapshot(entry.id)

    assert.ok(!existsSync(filePath), 'File should be deleted')
    const list = await rotator.listSnapshots()
    assert.ok(!list.some(e => e.id === entry.id))
  })

  it('automatically removes oldest entry when maxBackups is exceeded', async () => {
    const smallRotator = new BackupRotator(
      mkdtempSync(join(tmpdir(), 'backup-max-test-')),
      3,
    )

    const entries: string[] = []
    for (let i = 0; i < 4; i++) {
      const e = await smallRotator.saveSnapshot(SAMPLE_JSON, 'proj-max', 'Max Test')
      entries.push(e.id)
    }

    const list = await smallRotator.listSnapshots()
    assert.equal(list.length, 3)
    // The oldest (first) entry should be gone
    assert.ok(!list.some(e => e.id === entries[0]))
  })

  it('clearCrashRecovery sets isCrashRecovery=false on all matching entries', async () => {
    const crashRotator = new BackupRotator(
      mkdtempSync(join(tmpdir(), 'backup-crash-test-')),
      10,
    )

    // Save as crash recoveries
    await crashRotator.saveSnapshot(SAMPLE_JSON, 'proj-crash', 'Crash Project', true)
    await crashRotator.saveSnapshot(SAMPLE_JSON, 'proj-crash', 'Crash Project', true)

    let list = await crashRotator.listSnapshots()
    assert.ok(list.every(e => e.isCrashRecovery === true))

    await crashRotator.clearCrashRecovery()

    list = await crashRotator.listSnapshots()
    assert.ok(list.every(e => e.isCrashRecovery === false))
  })

  it('getMostRecent returns the newest entry', async () => {
    const recentRotator = new BackupRotator(
      mkdtempSync(join(tmpdir(), 'backup-recent-test-')),
      10,
    )
    await recentRotator.saveSnapshot(SAMPLE_JSON, 'proj-recent', 'Recent Test')
    await new Promise(r => setTimeout(r, 5))
    const e2 = await recentRotator.saveSnapshot(SAMPLE_JSON, 'proj-recent', 'Recent Test')

    const most = await recentRotator.getMostRecent()
    assert.ok(most !== null)
    assert.equal(most!.id, e2.id)
  })
})
