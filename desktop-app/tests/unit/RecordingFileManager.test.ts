// ─── RecordingFileManager.test.ts ─────────────────────────────────────────────

import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { RecordingFileManager } from '../../src/main/recording/RecordingFileManager.ts'
import type { RecordingSessionMeta } from '../../src/main/recording/RecordingFileManager.ts'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promises as fs } from 'node:fs'

let testDir: string
let rfm: RecordingFileManager

describe('RecordingFileManager', () => {
  beforeEach(async () => {
    testDir = join(tmpdir(), `rfm-test-${process.pid}-${Date.now()}`)
    await fs.mkdir(testDir, { recursive: true })
    rfm = new RecordingFileManager({ dir: testDir })
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  // ─── getRecordingPath ────────────────────────────────────────────────────────

  it("getRecordingPath: take 1 → path ends with 'tk-kick-take-01.wav'", () => {
    const p = rfm.getRecordingPath('tk-kick', 1, 'wav')
    assert.ok(p.endsWith('tk-kick-take-01.wav'), `path was: ${p}`)
  })

  it("getRecordingPath: take 10 → path ends with 'take-10.wav'", () => {
    const p = rfm.getRecordingPath('track', 10, 'wav')
    assert.ok(p.endsWith('take-10.wav'), `path was: ${p}`)
  })

  it("getRecordingPath: flac extension → ends with '.flac'", () => {
    const p = rfm.getRecordingPath('tk-vox', 1, 'flac')
    assert.ok(p.endsWith('.flac'), `path was: ${p}`)
  })

  it("getRecordingPath: sanitises trackId — '../evil' → no path traversal (no '..' in basename)", () => {
    const p = rfm.getRecordingPath('../evil', 1, 'wav')
    const base = p.split('/').pop()!
    assert.ok(!base.includes('..'), `basename should not contain '..', got: ${base}`)
    assert.ok(!p.includes('/../'), `full path should not contain path traversal, got: ${p}`)
  })

  // ─── getTempPath ─────────────────────────────────────────────────────────────

  it("getTempPath: ends with '.tmp'", () => {
    const p = rfm.getTempPath('tk-bass')
    assert.ok(p.endsWith('.tmp'), `path was: ${p}`)
  })

  // ─── ensureDir ───────────────────────────────────────────────────────────────

  it('ensureDir creates directory', async () => {
    const subDir = join(testDir, 'ensure-subdir')
    const rfm2 = new RecordingFileManager({ dir: subDir })
    await rfm2.ensureDir()
    const stat = await fs.stat(subDir)
    assert.ok(stat.isDirectory(), 'directory should exist after ensureDir()')
  })

  // ─── listRecordings ──────────────────────────────────────────────────────────

  it('listRecordings: empty dir returns []', async () => {
    const recordings = await rfm.listRecordings()
    assert.deepEqual(recordings, [])
  })

  it('listRecordings: only returns .wav/.flac files (not .tmp or .json)', async () => {
    await fs.writeFile(join(testDir, 'test.wav'), '')
    await fs.writeFile(join(testDir, 'test.flac'), '')
    await fs.writeFile(join(testDir, 'test.tmp'), '')
    await fs.writeFile(join(testDir, 'test.json'), '')

    const recordings = await rfm.listRecordings()
    const sorted = recordings.slice().sort()
    assert.deepEqual(sorted, ['test.flac', 'test.wav'])
  })

  // ─── deleteRecording ─────────────────────────────────────────────────────────

  it('deleteRecording: removes the file', async () => {
    const filePath = join(testDir, 'track-take-01.wav')
    await fs.writeFile(filePath, '')
    await rfm.deleteRecording('track-take-01.wav')
    await assert.rejects(
      () => fs.stat(filePath),
      (err: NodeJS.ErrnoException) => err.code === 'ENOENT',
    )
  })

  it("deleteRecording: rejects path traversal — '../../etc/passwd' throws", async () => {
    await assert.rejects(
      () => rfm.deleteRecording('../../etc/passwd'),
      /Invalid recording filename/,
    )
  })

  it("deleteRecording: rejects non-audio extension — 'secret.exe' throws", async () => {
    await assert.rejects(
      () => rfm.deleteRecording('secret.exe'),
      /Invalid recording filename/,
    )
  })

  // ─── session markers ─────────────────────────────────────────────────────────

  it('writeSessionMarker + listSessionMarkers: round-trip (2 markers)', async () => {
    const meta1: RecordingSessionMeta = {
      sessionId: 'sess-001',
      trackId: 'tk-drums',
      format: 'wav',
      startedAt: 1000,
      tmpPath: join(testDir, 'tk-drums.tmp'),
    }
    const meta2: RecordingSessionMeta = {
      sessionId: 'sess-002',
      trackId: 'tk-bass',
      format: 'flac',
      startedAt: 2000,
      tmpPath: join(testDir, 'tk-bass.tmp'),
    }
    await rfm.writeSessionMarker('sess-001', meta1)
    await rfm.writeSessionMarker('sess-002', meta2)

    const markers = await rfm.listSessionMarkers()
    assert.equal(markers.length, 2)
    const ids = markers.map(m => m.sessionId).sort()
    assert.deepEqual(ids, ['sess-001', 'sess-002'])
  })

  it('clearSessionMarker: removes marker → listSessionMarkers returns []', async () => {
    const meta: RecordingSessionMeta = {
      sessionId: 'sess-003',
      trackId: 'tk-guitar',
      format: 'wav',
      startedAt: 3000,
      tmpPath: join(testDir, 'tk-guitar.tmp'),
    }
    await rfm.writeSessionMarker('sess-003', meta)
    await rfm.clearSessionMarker('sess-003')
    const markers = await rfm.listSessionMarkers()
    assert.deepEqual(markers, [])
  })

  // ─── recoverPartialRecordings ─────────────────────────────────────────────────

  it('recoverPartialRecordings: deletes .tmp files and returns their paths', async () => {
    const tmp1 = join(testDir, 'tk-kick.tmp')
    const tmp2 = join(testDir, 'tk-snare.tmp')
    await fs.writeFile(tmp1, '')
    await fs.writeFile(tmp2, '')

    const recovered = await rfm.recoverPartialRecordings()
    assert.equal(recovered.length, 2, `expected 2 recovered files, got ${recovered.length}: ${recovered}`)
    assert.ok(recovered.some(p => p.endsWith('tk-kick.tmp')), `tk-kick.tmp should be in result: ${recovered}`)
    assert.ok(recovered.some(p => p.endsWith('tk-snare.tmp')), `tk-snare.tmp should be in result: ${recovered}`)

    await assert.rejects(() => fs.stat(tmp1), (err: NodeJS.ErrnoException) => err.code === 'ENOENT')
    await assert.rejects(() => fs.stat(tmp2), (err: NodeJS.ErrnoException) => err.code === 'ENOENT')
  })

  it('recoverPartialRecordings: does not delete .wav files', async () => {
    const wav = join(testDir, 'tk-bass-take-01.wav')
    const tmp = join(testDir, 'tk-bass.tmp')
    await fs.writeFile(wav, '')
    await fs.writeFile(tmp, '')

    await rfm.recoverPartialRecordings()

    const stat = await fs.stat(wav)
    assert.ok(stat.isFile(), '.wav file should still exist after recovery')
  })
})
