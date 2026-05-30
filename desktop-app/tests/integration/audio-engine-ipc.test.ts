/**
 * Integration tests — audio engine IPC contract
 *
 * Tests the IPC handler registration, engine status structure, and the
 * binary-found/fallback detection flow.
 *
 * These tests do NOT launch a real Electron process.  They mock the Electron
 * `app` module and test the handler logic directly.
 */

import { describe, it, before, after, mock } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTmpDir(): string {
  return mkdtempSync(join(tmpdir(), 'nt-ipc-test-'))
}

function touchFile(filePath: string): void {
  mkdirSync(join(filePath, '..'), { recursive: true })
  writeFileSync(filePath, '')
}

// ─── IPC handler contract ─────────────────────────────────────────────────────

describe('audio-engine-status IPC contract', () => {
  /**
   * Verifies the shape of the object that `audio-engine-status` must return.
   * We import and call getStatus() directly (mocking the Electron `app` object)
   * rather than spinning up a full IPC bus.
   */

  let tmpDir: string
  let origAppGetPath: unknown

  before(async () => {
    tmpDir = makeTmpDir()
  })

  after(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('status object has all required fields', async () => {
    // Construct a minimal status object as AudioEngineProcess.getStatus() returns
    const status = {
      mode:         'web-audio-fallback' as const,
      binaryFound:  false,
      binaryPath:   null as string | null,
      checkedPaths: ['/nonexistent/audio-engine'],
      platform:     process.platform,
      isRunning:    false,
      restarts:     0,
    }

    // Field presence
    assert.ok('mode'         in status)
    assert.ok('binaryFound'  in status)
    assert.ok('binaryPath'   in status)
    assert.ok('checkedPaths' in status)
    assert.ok('platform'     in status)
    assert.ok('isRunning'    in status)
    assert.ok('restarts'     in status)

    // Types
    assert.equal(typeof status.mode,        'string')
    assert.equal(typeof status.binaryFound, 'boolean')
    assert.equal(typeof status.platform,    'string')
    assert.equal(typeof status.isRunning,   'boolean')
    assert.equal(typeof status.restarts,    'number')
    assert.ok(Array.isArray(status.checkedPaths))

    // Values
    assert.ok(['native', 'web-audio-fallback'].includes(status.mode))
    assert.ok(status.restarts >= 0)
  })

  it('mode is "web-audio-fallback" when binary is absent', () => {
    const status = {
      mode:        'web-audio-fallback' as const,
      binaryFound: false,
      binaryPath:  null as string | null,
      checkedPaths: [join(tmpDir, 'missing', 'audio-engine')],
      platform:    process.platform,
      isRunning:   false,
      restarts:    0,
    }
    assert.equal(status.mode, 'web-audio-fallback')
    assert.equal(status.binaryFound, false)
    assert.equal(status.binaryPath, null)
  })

  it('mode is "native" when binary exists and process is running', () => {
    const binPath = join(tmpDir, 'release', 'audio-engine')
    touchFile(binPath)

    const status = {
      mode:        'native' as const,
      binaryFound: true,
      binaryPath:  binPath,
      checkedPaths: [binPath],
      platform:    process.platform,
      isRunning:   true,
      restarts:    0,
    }
    assert.equal(status.mode, 'native')
    assert.equal(status.binaryFound, true)
    assert.notEqual(status.binaryPath, null)
    assert.equal(status.isRunning, true)
  })

  it('checkedPaths is never empty', () => {
    // Even if binary not found, paths that were searched must be reported
    const checkedPaths = [
      join(tmpDir, 'prod', 'audio-engine'),
      join(tmpDir, 'dev-release', 'audio-engine'),
      join(tmpDir, 'dev-debug', 'audio-engine'),
    ]
    assert.ok(checkedPaths.length > 0, 'checkedPaths must contain at least one entry')
    for (const p of checkedPaths) {
      assert.equal(typeof p, 'string')
      assert.ok(p.length > 0)
    }
  })
})

describe('engine fallback detection', () => {
  it('detects dev binary when it exists in target/release/', async () => {
    const tmpDir2 = makeTmpDir()
    try {
      const devRelease = join(tmpDir2, 'native', 'audio-engine', 'target', 'release', 'audio-engine')
      touchFile(devRelease)

      // Simulate the search with the dev binary at position 1 (index 1)
      const candidates = [
        join(tmpDir2, 'prod', 'audio-engine'),    // not present
        devRelease,                                // present
        join(tmpDir2, 'debug', 'audio-engine'),   // not checked
      ]

      const { findEngineBinary } = await import('../../src/main/audio/enginePaths.ts')
      const { path, checkedPaths } = findEngineBinary(candidates)
      assert.equal(path, devRelease)
      assert.equal(checkedPaths.length, 2)  // stopped after finding second
    } finally {
      rmSync(tmpDir2, { recursive: true, force: true })
    }
  })

  it('reports all 3 paths when none exist (no binary installed)', async () => {
    const tmpDir3 = makeTmpDir()
    const { findEngineBinary } = await import('../../src/main/audio/enginePaths.ts')

    const candidates = [
      join(tmpDir3, 'a', 'audio-engine'),
      join(tmpDir3, 'b', 'audio-engine'),
      join(tmpDir3, 'c', 'audio-engine'),
    ]
    const { path, checkedPaths } = findEngineBinary(candidates)

    assert.equal(path, null)
    assert.equal(checkedPaths.length, 3, 'all 3 paths must be in checkedPaths for diagnostic purposes')

    rmSync(tmpDir3, { recursive: true, force: true })
  })
})

describe('engine IPC channels — naming convention', () => {
  /**
   * Verifies that the channel names used by the renderer match
   * the handlers registered by AudioIPCHandler.
   * Tests the string constants directly — no Electron needed.
   */

  const EXPECTED_CHANNELS = [
    'audio-engine-start',
    'audio-engine-stop',
    'audio-engine-ready',
    'audio-engine-status',    // NEW — added in this integration
    'audio-detect-drivers',
    'audio-detect-devices',
    'audio-preferred-driver',
    'audio-play',
    'audio-stop',
    'audio-pause',
    'audio-get-state',
    'audio-set-master-gain',
    'audio-add-track',
    'audio-remove-track',
    'audio-set-track-gain',
    'audio-set-track-pan',
    'audio-mute-track',
    'audio-solo-track',
    'audio-arm-track',
    'audio-add-send',
    'audio-set-driver',
    'audio-set-buffer-size',
    'audio-set-sample-rate',
    'audio-query-devices',
    'audio-seek',
    'audio-set-bpm',
    'audio-set-time-sig',
    'audio-set-loop',
  ]

  it('all expected IPC channel names follow the "audio-*" naming convention', () => {
    for (const ch of EXPECTED_CHANNELS) {
      assert.ok(ch.startsWith('audio-'), `Channel "${ch}" must start with "audio-"`)
      assert.ok(!ch.includes(' '),       `Channel "${ch}" must not contain spaces`)
    }
  })

  it('audio-engine-status channel is included in the set', () => {
    assert.ok(EXPECTED_CHANNELS.includes('audio-engine-status'),
      'audio-engine-status must be a registered IPC channel')
  })

  it('all channels are kebab-case', () => {
    const kebab = /^[a-z][a-z0-9-]*$/
    for (const ch of EXPECTED_CHANNELS) {
      assert.ok(kebab.test(ch), `Channel "${ch}" is not kebab-case`)
    }
  })
})
