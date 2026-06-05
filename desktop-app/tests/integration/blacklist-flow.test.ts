import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { existsSync, readFileSync, rmSync } from 'node:fs'

// Fresh state: remove any prior persisted file. The module loads its DB at
// import time, so clear BEFORE importing.
const userData = join(tmpdir(), 'neurotek-test-' + process.pid)
const blPath = join(userData, 'plugin-blacklist.json')
if (existsSync(blPath)) rmSync(blPath, { force: true })

const { recordCrash, isBlacklisted, getCrashCount, removeFromBlacklist } =
  await import('../../src/main/modules/pluginBlacklist.ts')

// Use plugin paths unique to this integration test to avoid cross-test pollution.
const PA = '/integration/pluginA.vst3'
const PB = '/integration/pluginB.vst3'

describe('integration: blacklist persistence flow', () => {
  it('records 3 crashes for A and 2 for B', () => {
    removeFromBlacklist(PA)
    removeFromBlacklist(PB)

    recordCrash(PA, 'A', 'segfault')
    recordCrash(PA, 'A', 'segfault')
    recordCrash(PA, 'A', 'segfault')
    recordCrash(PB, 'B', 'hang')
    recordCrash(PB, 'B', 'hang')

    assert.equal(getCrashCount(PA), 3)
    assert.equal(getCrashCount(PB), 2)
    assert.equal(isBlacklisted(PA), true)
    assert.equal(isBlacklisted(PB), false)
  })

  it('persists state to disk in a structured JSON array', () => {
    assert.ok(existsSync(blPath))
    const arr = JSON.parse(readFileSync(blPath, 'utf8')) as Array<{
      path: string; crashCount: number; blacklistedAt: number | null
    }>
    const a = arr.find(e => e.path === PA)
    const b = arr.find(e => e.path === PB)
    assert.ok(a && b, 'both entries must persist')
    assert.equal(a!.crashCount, 3)
    assert.ok(a!.blacklistedAt !== null, 'A should have blacklistedAt set')
    assert.equal(b!.crashCount, 2)
    assert.equal(b!.blacklistedAt, null)
  })

  it('a fourth crash on A keeps it blacklisted (idempotent)', () => {
    recordCrash(PA, 'A', 'segfault')
    assert.equal(getCrashCount(PA), 4)
    assert.equal(isBlacklisted(PA), true)
  })

  it('removeFromBlacklist clears both blacklisted flag and crashCount', () => {
    removeFromBlacklist(PA)
    assert.equal(isBlacklisted(PA), false)
    assert.equal(getCrashCount(PA), 0)
  })
})
