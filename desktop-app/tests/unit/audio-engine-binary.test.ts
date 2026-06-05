/**
 * Unit tests — audio engine binary path resolution
 *
 * Tests the pure functions from enginePaths.ts without requiring an Electron
 * runtime.  All filesystem interactions are controlled via temp directories.
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join, sep } from 'node:path'
import { tmpdir } from 'node:os'

import {
  engineBinaryName,
  getEngineBinaryCandidates,
  findEngineBinary,
} from '../../src/main/audio/enginePaths.ts'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTmpDir(): string {
  return mkdtempSync(join(tmpdir(), 'nt-audio-test-'))
}

function touchFile(filePath: string): void {
  mkdirSync(join(filePath, '..'), { recursive: true })
  writeFileSync(filePath, '')
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('engineBinaryName()', () => {
  it('returns audio-engine.exe on win32', () => {
    assert.equal(engineBinaryName('win32'), 'audio-engine.exe')
  })

  it('returns audio-engine on darwin', () => {
    assert.equal(engineBinaryName('darwin'), 'audio-engine')
  })

  it('returns audio-engine on linux', () => {
    assert.equal(engineBinaryName('linux'), 'audio-engine')
  })

  it('returns audio-engine for any unknown platform', () => {
    assert.equal(engineBinaryName('freebsd'), 'audio-engine')
    assert.equal(engineBinaryName(''), 'audio-engine')
  })
})

describe('getEngineBinaryCandidates()', () => {
  it('returns exactly 3 candidates', () => {
    const paths = getEngineBinaryCandidates('/app', '/src/main/audio', 'linux')
    assert.equal(paths.length, 3)
  })

  it('first candidate targets the production resources directory', () => {
    // Production: {appPath}/../audio-engine/audio-engine
    const paths = getEngineBinaryCandidates('/app/contents/resources/app.asar', '/src', 'linux')
    const prod  = paths[0]
    // Must contain "audio-engine" directory and end with the binary name
    assert.ok(prod.includes(`audio-engine${sep}audio-engine`) || prod.includes('audio-engine/audio-engine'),
      `Expected production path to include audio-engine/audio-engine, got: ${prod}`)
  })

  it('second and third candidates target release and debug builds', () => {
    const paths = getEngineBinaryCandidates('/app', '/repo/desktop-app/out/main/audio', 'darwin')
    const [, release, debug] = paths
    assert.ok(release.includes('release'), `Expected release path, got: ${release}`)
    assert.ok(debug.includes('debug'),     `Expected debug path, got: ${debug}`)
  })

  it('appends .exe suffix on Windows', () => {
    const paths = getEngineBinaryCandidates('/app', '/src', 'win32')
    for (const p of paths) {
      assert.ok(p.endsWith('audio-engine.exe'), `Expected .exe suffix in: ${p}`)
    }
  })

  it('does NOT append .exe on macOS', () => {
    const paths = getEngineBinaryCandidates('/app', '/src', 'darwin')
    for (const p of paths) {
      assert.ok(!p.endsWith('.exe'), `Unexpected .exe suffix in: ${p}`)
    }
  })
})

describe('findEngineBinary()', () => {
  let tmpDir: string

  before(() => { tmpDir = makeTmpDir() })
  after(() => { rmSync(tmpDir, { recursive: true, force: true }) })

  it('returns path=null and full checkedPaths when no binary exists', () => {
    const candidates = [
      join(tmpDir, 'a', 'audio-engine'),
      join(tmpDir, 'b', 'audio-engine'),
    ]
    const result = findEngineBinary(candidates)
    assert.equal(result.path, null)
    assert.deepEqual(result.checkedPaths, candidates)
  })

  it('returns first match when first candidate exists', () => {
    const first  = join(tmpDir, 'first', 'audio-engine')
    const second = join(tmpDir, 'second', 'audio-engine')
    touchFile(first)

    const result = findEngineBinary([first, second])
    assert.equal(result.path, first)
    // Only the first path should be in checkedPaths (stopped on first hit)
    assert.deepEqual(result.checkedPaths, [first])
  })

  it('returns second match when first is absent but second exists', () => {
    const missing = join(tmpDir, 'missing', 'audio-engine')
    const present = join(tmpDir, 'present', 'audio-engine')
    touchFile(present)

    const result = findEngineBinary([missing, present])
    assert.equal(result.path, present)
    assert.deepEqual(result.checkedPaths, [missing, present])
  })

  it('returns all paths in checkedPaths even when none exist', () => {
    const candidates = [
      join(tmpDir, 'x1', 'audio-engine'),
      join(tmpDir, 'x2', 'audio-engine'),
      join(tmpDir, 'x3', 'audio-engine'),
    ]
    const result = findEngineBinary(candidates)
    assert.equal(result.checkedPaths.length, 3)
    assert.equal(result.path, null)
  })

  it('handles an empty candidate list gracefully', () => {
    const result = findEngineBinary([])
    assert.equal(result.path, null)
    assert.deepEqual(result.checkedPaths, [])
  })
})

describe('EngineStatus contract', () => {
  /**
   * Validates the shape of an EngineStatus object returned by getStatus().
   * These tests work without spawning a real AudioEngineProcess by verifying
   * the schema of the enginePaths output directly.
   */

  it('findEngineBinary result maps cleanly to EngineStatus shape', () => {
    const candidates = ['/nonexistent/audio-engine']
    const { path, checkedPaths } = findEngineBinary(candidates)

    // Simulate what AudioEngineProcess.getStatus() would return
    const status = {
      mode:         path ? 'native' : 'web-audio-fallback',
      binaryFound:  path !== null,
      binaryPath:   path,
      checkedPaths,
      platform:     process.platform,
      isRunning:    false,
      restarts:     0,
    }

    assert.equal(typeof status.mode,          'string')
    assert.equal(typeof status.binaryFound,   'boolean')
    assert.equal(typeof status.platform,      'string')
    assert.ok(Array.isArray(status.checkedPaths))
    assert.equal(status.mode, 'web-audio-fallback')
    assert.equal(status.binaryFound, false)
    assert.equal(status.binaryPath, null)
  })

  it('status reflects "native" mode when binary is present', () => {
    const tmpBin = join(makeTmpDir(), 'audio-engine')
    touchFile(tmpBin)

    const { path, checkedPaths } = findEngineBinary([tmpBin])

    const status = {
      mode:        path ? 'native' : 'web-audio-fallback',
      binaryFound: path !== null,
      binaryPath:  path,
      checkedPaths,
    }

    assert.equal(status.mode, 'native')
    assert.equal(status.binaryFound, true)
    assert.equal(status.binaryPath, tmpBin)
  })
})
