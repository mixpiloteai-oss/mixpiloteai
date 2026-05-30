import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { CrashRecoveryManager } from '../../src/main/crashRecovery.ts'

let dir: string
let mgr: CrashRecoveryManager

before(() => {
  dir = mkdtempSync(join(tmpdir(), 'crash-test-'))
  mgr = new CrashRecoveryManager({ dir })
})

after(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('CrashRecoveryManager', () => {
  it('writeCrashMarker creates a file', async () => {
    await mgr.writeCrashMarker('sess-1')
    assert.equal(await mgr.hasCrashMarker('sess-1'), true)
  })

  it('hasCrashMarker returns false for unknown session', async () => {
    assert.equal(await mgr.hasCrashMarker('sess-nonexistent'), false)
  })

  it('clearCrashMarker removes the marker', async () => {
    await mgr.writeCrashMarker('sess-clear')
    await mgr.clearCrashMarker('sess-clear')
    assert.equal(await mgr.hasCrashMarker('sess-clear'), false)
  })

  it('listMarkers returns marker filenames', async () => {
    const d    = mkdtempSync(join(tmpdir(), 'crash-list-'))
    const mgr2 = new CrashRecoveryManager({ dir: d })
    try {
      await mgr2.writeCrashMarker('s1')
      await mgr2.writeCrashMarker('s2')
      const markers = await mgr2.listMarkers()
      assert.ok(markers.some(f => f.includes('s1')))
      assert.ok(markers.some(f => f.includes('s2')))
    } finally {
      rmSync(d, { recursive: true, force: true })
    }
  })

  it('pruneOldMarkers removes all markers when maxAgeMs is negative', async () => {
    const d    = mkdtempSync(join(tmpdir(), 'crash-prune-'))
    const mgr3 = new CrashRecoveryManager({ dir: d })
    try {
      await mgr3.writeCrashMarker('old-1')
      await mgr3.writeCrashMarker('old-2')
      // Use -1 to ensure now - mtimeMs > -1 is always true (file always qualifies)
      await mgr3.pruneOldMarkers(-1)
      const remaining = await mgr3.listMarkers()
      assert.equal(remaining.length, 0)
    } finally {
      rmSync(d, { recursive: true, force: true })
    }
  })

  it('marker file is valid JSON with pid and timestamp', async () => {
    const { readFile } = await import('node:fs/promises')
    await mgr.writeCrashMarker('json-check')
    const markers = await mgr.listMarkers()
    const target  = markers.find(f => f.includes('json-check'))
    assert.ok(target !== undefined)
    const content = JSON.parse(await readFile(join(dir, target!), 'utf8')) as Record<string, unknown>
    assert.ok(typeof content['pid'] === 'number')
    assert.ok(typeof content['timestamp'] === 'number')
    await mgr.clearCrashMarker('json-check')
  })
})
