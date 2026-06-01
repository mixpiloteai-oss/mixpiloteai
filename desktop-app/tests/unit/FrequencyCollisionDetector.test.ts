import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { FrequencyCollisionDetector } from '../../src/renderer/src/audio/analysis/FrequencyCollisionDetector.ts'

const SR = 44100

function makeSine(freq: number, sr: number, n: number, amplitude = 0.8): Float32Array {
  const buf = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    buf[i] = amplitude * Math.sin(2 * Math.PI * freq * i / sr)
  }
  return buf
}

describe('FrequencyCollisionDetector', () => {
  const detector = new FrequencyCollisionDetector()

  describe('detectCollisions()', () => {
    it('same buffer on 2 tracks → at least 1 collision', () => {
      const buf    = makeSine(440, SR, 1024)
      const tracks = [
        { id: 'a', name: 'Track A', buffer: buf },
        { id: 'b', name: 'Track B', buffer: buf },
      ]
      const collisions = detector.detectCollisions(tracks, SR)
      assert.ok(
        collisions.length >= 1,
        `expected ≥1 collision for identical tracks, got ${collisions.length}`,
      )
    })

    it('silence vs signal → no collisions (silence has no energy above -30 dBFS)', () => {
      const silence = new Float32Array(1024)
      const signal  = makeSine(440, SR, 1024)
      const tracks  = [
        { id: 'a', name: 'Silence', buffer: silence },
        { id: 'b', name: 'Signal',  buffer: signal  },
      ]
      const collisions = detector.detectCollisions(tracks, SR)
      assert.strictEqual(
        collisions.length, 0,
        `expected 0 collisions with silence, got ${collisions.length}`,
      )
    })
  })

  describe('detectKickBassConflict()', () => {
    it('sub-bass sine (50 Hz) on both → severity high', () => {
      const buf  = makeSine(50, SR, SR)  // 1 second of 50 Hz
      const kick = { id: 'kick', name: 'Kick', buffer: buf }
      const bass = { id: 'bass', name: 'Bass', buffer: buf }
      const result = detector.detectKickBassConflict(kick, bass, SR)

      assert.strictEqual(
        result.severity, 'high',
        `expected severity 'high', got '${result.severity}'`,
      )
    })

    it('result has subBassOverlap and bassOverlap between 0 and 1', () => {
      const buf  = makeSine(100, SR, 2048)
      const kick = { id: 'kick', name: 'Kick', buffer: buf }
      const bass = { id: 'bass', name: 'Bass', buffer: buf }
      const result = detector.detectKickBassConflict(kick, bass, SR)

      assert.ok(result.subBassOverlap >= 0 && result.subBassOverlap <= 1)
      assert.ok(result.bassOverlap    >= 0 && result.bassOverlap    <= 1)
    })
  })
})
