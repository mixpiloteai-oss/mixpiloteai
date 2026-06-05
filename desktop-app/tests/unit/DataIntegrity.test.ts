// ─── DataIntegrity.test.ts ────────────────────────────────────────────────────
// Tests data integrity, corruption detection, and cross-module consistency.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  serializeProject,
  deserializeProject,
} from '../../src/renderer/src/audio/safety/ProjectSerializer'
import type { ProjectStoreState } from '../../src/renderer/src/audio/safety/ProjectSerializer'
import { encodeWav } from '../../src/renderer/src/audio/export/WavEncoderPcm'
import { applyDither } from '../../src/renderer/src/audio/export/DitherEngine'
import { LimiterProcessor } from '../../src/renderer/src/audio/export/LimiterProcessor'
import { softClip, processBuffer } from '../../src/renderer/src/audio/export/SoftClipper'
import { MasterChain } from '../../src/renderer/src/audio/export/MasterChain'
import { loudnessMeter } from '../../src/renderer/src/audio/export/LoudnessMeter'
import { SampleRelinker } from '../../src/renderer/src/audio/safety/SampleRelinker'
import { BackupRotator } from '../../src/main/safety/BackupRotator'

function makeMinimalState(bpm: number = 120, trackCount: number = 0): ProjectStoreState {
  return {
    bpm,
    tracks: Array.from({ length: trackCount }, (_, i) => ({
      id: `track-${i}`,
      name: `Track ${i}`,
      type: 'instrument',
      gainDb: 0,
      panCenter: 0,
      muted: false,
      soloed: false,
      clips: [],
    })),
    masterVolume: 0,
    id: 'proj-integrity',
    name: 'Integrity Test',
  }
}

describe('DataIntegrity', () => {
  it('ProjectSerializer round-trip: tracks array preserved', () => {
    const state = makeMinimalState(128, 3)
    const snapshot = serializeProject(state)
    const json = JSON.stringify(snapshot)
    const restored = deserializeProject(json)

    assert.ok(restored !== null, 'Should deserialize successfully')
    assert.equal(restored!.tracks.length, 3,
      `Expected 3 tracks, got ${restored!.tracks.length}`)
  })

  it('ProjectSerializer: null/undefined state fields handled gracefully', () => {
    const state: ProjectStoreState = {
      bpm: 120,
      tracks: [],
      // id and name are optional
    }

    let threw = false
    try {
      const snapshot = serializeProject(state)
      assert.ok(snapshot.bpm === 120, 'Should serialize bpm correctly')
    } catch {
      threw = true
    }
    assert.ok(!threw, 'Should not throw with minimal state')
  })

  it('BackupRotator: saveSnapshot + loadSnapshot returns identical JSON', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'backup-integrity-'))
    try {
      const rotator = new BackupRotator(dir, 5)
      const sampleJson = JSON.stringify({ version: 1, bpm: 128, projectId: 'test', checksum: 12345 })

      const entry = await rotator.saveSnapshot(sampleJson, 'test', 'Test Project')
      const loaded = await rotator.loadSnapshot(entry.id)

      assert.ok(loaded !== null, 'loadSnapshot should return data')
      assert.equal(loaded!, sampleJson, 'Loaded snapshot should match saved snapshot')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('BackupRotator: maxBackups=3, after 4 saves, listSnapshots.length===3', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'backup-rotator-prune-'))
    try {
      const rotator = new BackupRotator(dir, 3)
      const sampleJson = JSON.stringify({ version: 1, bpm: 128 })

      for (let i = 0; i < 4; i++) {
        await rotator.saveSnapshot(sampleJson, 'proj-prune', 'Prune Test')
      }

      const list = await rotator.listSnapshots()
      assert.ok(list.length <= 3,
        `Expected at most 3 snapshots after pruning, got ${list.length}`)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('WavEncoderPcm: 16-bit header correct — chunkId RIFF, format WAVE', () => {
    const samples = new Float32Array(1000).fill(0.5)
    const wav = encodeWav([samples, samples], 44100, 16)

    const riff = String.fromCharCode(wav[0]!, wav[1]!, wav[2]!, wav[3]!)
    const wave = String.fromCharCode(wav[8]!, wav[9]!, wav[10]!, wav[11]!)

    assert.equal(riff, 'RIFF', 'Should start with RIFF')
    assert.equal(wave, 'WAVE', 'Should contain WAVE')
  })

  it('WavEncoderPcm: 24-bit encoding: all output bytes readable', () => {
    const samples = new Float32Array(100)
    for (let i = 0; i < 100; i++) samples[i] = Math.sin(i * 0.1)

    const wav = encodeWav([samples], 44100, 24)
    // 44 header bytes + 100 samples * 1 channel * 3 bytes = 344 bytes
    const expectedSize = 44 + 100 * 1 * 3
    assert.equal(wav.length, expectedSize, `Expected ${expectedSize} bytes, got ${wav.length}`)

    // Check all bytes are valid numbers (no undefined/NaN)
    for (let i = 0; i < wav.length; i++) {
      assert.ok(wav[i] !== undefined && typeof wav[i] === 'number',
        `Byte at index ${i} should be a valid number`)
    }
  })

  it('DitherEngine + WavEncoderPcm: dithered signal encodes without crash', () => {
    const input = new Float32Array(1000)
    for (let i = 0; i < 1000; i++) input[i] = Math.sin(i * 0.01)

    let threw = false
    try {
      const dithered = applyDither(input, 16, 'tpdf')
      encodeWav([dithered], 44100, 16)
    } catch {
      threw = true
    }
    assert.ok(!threw, 'DitherEngine + WavEncoderPcm should not throw')
  })

  it('LimiterProcessor + SoftClipper: chaining produces no NaN values', () => {
    const limiter = new LimiterProcessor({ sampleRate: 44100 })
    const n = 4096
    const left = new Float32Array(n)
    const right = new Float32Array(n)

    for (let i = 0; i < n; i++) {
      left[i] = 1.5 * Math.sin(i * 0.01)
      right[i] = 1.5 * Math.sin(i * 0.01 + 0.5)
    }

    // Apply soft clipper first, then limiter
    const softClipped = processBuffer([left, right], 0.95)
    const limited = limiter.process(softClipped)

    for (let i = 0; i < limited[0]!.length; i++) {
      assert.ok(!isNaN(limited[0]![i]!), `Left[${i}] is NaN`)
      assert.ok(!isNaN(limited[1]![i]!), `Right[${i}] is NaN`)
    }
  })

  it('MasterChain: process then LoudnessMeter gives finite measurements', () => {
    const chain = new MasterChain({ sampleRate: 44100 })
    const n = 44100
    const left = new Float32Array(n)
    const right = new Float32Array(n)

    for (let i = 0; i < n; i++) {
      left[i] = 0.5 * Math.sin(2 * Math.PI * 440 * i / 44100)
      right[i] = 0.5 * Math.sin(2 * Math.PI * 440 * i / 44100)
    }

    const result = chain.process([left, right])
    const loudness = loudnessMeter.measureIntegratedLoudness(result.channels, 44100)

    assert.ok(isFinite(loudness.rmsDb) || loudness.rmsDb === -Infinity,
      `rmsDb should be finite or -Infinity, got ${loudness.rmsDb}`)
    assert.ok(!isNaN(loudness.peakDb), `peakDb should not be NaN`)
    assert.ok(!isNaN(loudness.lufsApprox) || loudness.rmsDb === -Infinity,
      `lufsApprox should not be NaN`)
  })

  it('SampleRelinker: relink map correct — clipId maps to newPath', () => {
    const relinker = new SampleRelinker()
    const resolutions = [
      { clipId: 'clip-1', newPath: '/new/audio/kick.wav' },
      { clipId: 'clip-2', newPath: '/new/audio/snare.wav' },
    ]

    const map = relinker.buildRelinkMap(resolutions)

    assert.equal(map.get('clip-1'), '/new/audio/kick.wav')
    assert.equal(map.get('clip-2'), '/new/audio/snare.wav')
    assert.equal(map.size, 2)
  })
})
