import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { CorruptionGuard } from '../../src/main/corruptionGuard.ts'

let dir:   string
let guard: CorruptionGuard

before(() => {
  dir   = mkdtempSync(join(tmpdir(), 'corruption-test-'))
  guard = new CorruptionGuard()
})

after(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('CorruptionGuard', () => {
  it('writeProtected + verifyFile returns ok:true', async () => {
    const path = join(dir, 'safe.json')
    await guard.writeProtected(path, '{"valid":true}')
    const result = await guard.verifyFile(path)
    assert.equal(result.ok, true)
  })

  it('hashFile returns 64-char hex', async () => {
    const path = join(dir, 'hash-test.txt')
    writeFileSync(path, 'hello world')
    const hash = await guard.hashFile(path)
    assert.equal(hash.length, 64)
    assert.ok(/^[0-9a-f]+$/.test(hash))
  })

  it('verifyFile detects tampered data', async () => {
    const path = join(dir, 'tamper.json')
    await guard.writeProtected(path, '{"original":true}')
    writeFileSync(path, '{"tampered":true}')
    const result = await guard.verifyFile(path)
    assert.equal(result.ok, false)
    assert.notEqual(result.expected, result.actual)
  })

  it('hashFile is deterministic', async () => {
    const path = join(dir, 'deterministic.txt')
    writeFileSync(path, 'same content')
    const h1 = await guard.hashFile(path)
    const h2 = await guard.hashFile(path)
    assert.equal(h1, h2)
  })

  it('verifyFile returns ok:false when .sha256 sidecar is missing', async () => {
    const path = join(dir, 'nosidecar.json')
    writeFileSync(path, '{}')
    const result = await guard.verifyFile(path)
    assert.equal(result.ok, false)
  })
})
