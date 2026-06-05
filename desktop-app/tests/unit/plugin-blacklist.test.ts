import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { rmSync, existsSync, readFileSync } from 'node:fs'

// IMPORTANT: clear any persisted file from a prior run before module import.
// The pluginBlacklist module loads its DB at import time from userData.
const userData = join(tmpdir(), 'neurotek-test-' + process.pid)
const blPath = join(userData, 'plugin-blacklist.json')
if (existsSync(blPath)) rmSync(blPath, { force: true })

const { recordCrash, isBlacklisted, getCrashCount, removeFromBlacklist, getAll, getEntry, listBlacklisted } =
  await import('../../src/main/modules/pluginBlacklist.ts')

describe('pluginBlacklist / basic crash counting', () => {
  before(() => {
    // ensure clean slate for known plugins used here
    removeFromBlacklist('/plugins/A.vst3')
    removeFromBlacklist('/plugins/B.vst3')
    removeFromBlacklist('/plugins/C.vst3')
  })

  it('starts with 0 crashes for an unknown plugin', () => {
    assert.equal(getCrashCount('/plugins/A.vst3'), 0)
  })

  it('recordCrash increments crashCount', () => {
    const r = recordCrash('/plugins/A.vst3', 'PluginA')
    assert.equal(r.crashCount, 1)
    assert.equal(r.blacklisted, false)
    assert.equal(getCrashCount('/plugins/A.vst3'), 1)
  })

  it('blacklists after 3 crashes', () => {
    recordCrash('/plugins/A.vst3', 'PluginA')
    const r3 = recordCrash('/plugins/A.vst3', 'PluginA')
    assert.equal(r3.crashCount, 3)
    assert.equal(r3.blacklisted, true)
    assert.equal(isBlacklisted('/plugins/A.vst3'), true)
  })

  it('does NOT blacklist a different plugin after fewer crashes', () => {
    recordCrash('/plugins/B.vst3', 'PluginB')
    assert.equal(isBlacklisted('/plugins/B.vst3'), false)
    assert.equal(getCrashCount('/plugins/B.vst3'), 1)
  })

  it('persists to disk as JSON', () => {
    assert.ok(existsSync(blPath), 'blacklist file should exist')
    const json = JSON.parse(readFileSync(blPath, 'utf8')) as Array<{ path: string }>
    const paths = json.map(e => e.path)
    assert.ok(paths.includes('/plugins/A.vst3'))
    assert.ok(paths.includes('/plugins/B.vst3'))
  })

  it('removeFromBlacklist resets crash count and unblacklists', () => {
    removeFromBlacklist('/plugins/A.vst3')
    assert.equal(isBlacklisted('/plugins/A.vst3'), false)
    assert.equal(getCrashCount('/plugins/A.vst3'), 0)
  })

  it('getEntry returns null for unknown plugin', () => {
    assert.equal(getEntry('/plugins/never-seen.vst3'), null)
  })

  it('listBlacklisted only includes blacklisted entries', () => {
    recordCrash('/plugins/C.vst3', 'PluginC')
    recordCrash('/plugins/C.vst3', 'PluginC')
    recordCrash('/plugins/C.vst3', 'PluginC')
    const list = listBlacklisted()
    const paths = list.map(e => e.path)
    assert.ok(paths.includes('/plugins/C.vst3'))
    assert.ok(!paths.includes('/plugins/B.vst3'))
  })

  it('records a reason when provided', () => {
    recordCrash('/plugins/D.vst3', 'PluginD', 'segfault on load')
    const e = getEntry('/plugins/D.vst3')
    assert.ok(e)
    assert.equal(e!.reason, 'segfault on load')
  })

  it('getAll returns every recorded plugin', () => {
    const all = getAll()
    const paths = all.map(e => e.path)
    assert.ok(paths.length >= 2)
  })
})
