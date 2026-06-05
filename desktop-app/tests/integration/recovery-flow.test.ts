import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { validateProjectSaveData } from '../../src/renderer/src/audio/save/projectSchema.ts'

// djb2 checksum (matches the pattern used by ProjectSerializer)
function djb2(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(16)
}

function makeValidProject(): unknown {
  return {
    version: 1,
    savedAt: Date.now(),
    appVersion: '1.0.0',
    project: { name: 'Recovery Test' },
    mixer: { buses: [{ id: 'master', gainDb: -3 }], channels: {} },
    transport: { bpm: 128, timeSignatureTop: 4, timeSignatureBottom: 4, looping: false },
    pianoRoll: { notes: [{ id: 'n1', pitch: 60, startBeat: 0, lengthBeats: 1, velocity: 100 }] },
    midi: { seqTracks: [], drumPads: [] },
  }
}

describe('recovery flow / crash → snapshot → restart → validate', () => {
  it('writes, reads back, and validates an autosave snapshot', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'recovery-'))
    const path = join(dir, 'autosave.snap.json')
    const data = makeValidProject()
    const raw  = JSON.stringify(data)
    const snap = { type: 'auto', createdAt: Date.now(), data, checksum: djb2(raw), sizeBytes: raw.length }
    writeFileSync(path, JSON.stringify(snap), 'utf8')

    // Simulate restart: read + verify
    assert.ok(existsSync(path))
    const loaded = JSON.parse(readFileSync(path, 'utf8')) as typeof snap
    const recomputed = djb2(JSON.stringify(loaded.data))
    assert.equal(recomputed, loaded.checksum, 'checksum mismatch after reload')

    // Schema accepts the recovered payload
    const res = validateProjectSaveData(loaded.data)
    assert.equal(res.ok, true, res.ok ? '' : res.reason)
  })

  it('detects tamper via checksum after mutating a field', () => {
    const data = makeValidProject() as Record<string, unknown>
    const raw = JSON.stringify(data)
    const checksum = djb2(raw)
    // Mutate transport.bpm
    ;(data.transport as Record<string, unknown>).bpm = 200
    const newSum = djb2(JSON.stringify(data))
    assert.notEqual(newSum, checksum, 'checksum should change after tampering')
  })

  it('schema rejects a tampered snapshot with invalid bpm', () => {
    const data = makeValidProject() as Record<string, unknown>
    ;(data.transport as Record<string, unknown>).bpm = 100000
    const res = validateProjectSaveData(data)
    assert.equal(res.ok, false)
    if (!res.ok) assert.match(res.reason, /bpm/i)
  })

  it('round-trip preserves piano-roll notes', () => {
    const data = makeValidProject()
    const reloaded = JSON.parse(JSON.stringify(data)) as { pianoRoll: { notes: unknown[] } }
    assert.equal(reloaded.pianoRoll.notes.length, 1)
    const res = validateProjectSaveData(reloaded)
    assert.equal(res.ok, true)
  })
})
