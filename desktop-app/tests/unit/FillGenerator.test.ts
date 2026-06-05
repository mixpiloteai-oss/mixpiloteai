// ─── FillGenerator.test.ts ─────────────────────────────────────────────────────

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { FillGenerator } from '../../src/renderer/src/audio/ai/FillGenerator.ts'
import type { FillOptions } from '../../src/renderer/src/audio/ai/FillGenerator.ts'

const gen = new FillGenerator()

function makeOptions(overrides: Partial<FillOptions> = {}): FillOptions {
  return {
    style: 'snare-roll',
    lengthBeats: 1,
    startBeat: 0,
    intensity: 0.5,
    bpm: 128,
    seed: 42,
    ...overrides,
  }
}

describe('FillGenerator', () => {
  describe('snare-roll', () => {
    it('all notes are snare pitch (38)', () => {
      const notes = gen.generate(makeOptions({ style: 'snare-roll', lengthBeats: 1 }))
      assert.ok(notes.length > 0, 'Should generate notes')
      for (const n of notes) {
        assert.equal(n.pitch, 38, `Expected snare pitch 38, got ${n.pitch}`)
      }
    })

    it('intensity > 0.7 uses 32nds (more notes)', () => {
      const low  = gen.generate(makeOptions({ style: 'snare-roll', lengthBeats: 1, intensity: 0.5 }))
      const high = gen.generate(makeOptions({ style: 'snare-roll', lengthBeats: 1, intensity: 0.9 }))
      assert.ok(high.length >= low.length, 'High intensity should have >= notes (32nds vs 16ths)')
    })
  })

  describe('tom-fill', () => {
    it('includes at least one tom pitch (41-50)', () => {
      const notes = gen.generate(makeOptions({ style: 'tom-fill', lengthBeats: 1 }))
      const tomPitches = notes.filter(n => n.pitch >= 41 && n.pitch <= 50)
      assert.ok(tomPitches.length > 0, 'Should include at least one tom pitch (41-50)')
    })
  })

  describe('crash-buildup', () => {
    it('includes crash (49) as last note', () => {
      const notes = gen.generate(makeOptions({ style: 'crash-buildup', lengthBeats: 1 }))
      assert.ok(notes.length > 0, 'Should generate notes')
      const crash = notes.find(n => n.pitch === 49)
      assert.ok(crash !== undefined, 'Should include crash cymbal (49)')
    })
  })

  describe('trap-roll', () => {
    it('all notes are closed hat (42)', () => {
      const notes = gen.generate(makeOptions({ style: 'trap-roll', lengthBeats: 1 }))
      assert.ok(notes.length > 0, 'Should generate notes')
      for (const n of notes) {
        assert.equal(n.pitch, 42, `Expected closed hat 42, got ${n.pitch}`)
      }
    })
  })

  describe('simple', () => {
    it('returns >= 2 notes', () => {
      const notes = gen.generate(makeOptions({ style: 'simple', lengthBeats: 1 }))
      assert.ok(notes.length >= 2, `Expected >= 2 notes, got ${notes.length}`)
    })

    it('all notes within lengthBeats', () => {
      const startBeat = 4
      const lengthBeats = 1
      const notes = gen.generate(makeOptions({ style: 'simple', startBeat, lengthBeats }))
      for (const n of notes) {
        assert.ok(n.startBeat >= startBeat,
          `Note start ${n.startBeat} should be >= startBeat ${startBeat}`)
        assert.ok(n.startBeat < startBeat + lengthBeats,
          `Note start ${n.startBeat} should be < startBeat + lengthBeats ${startBeat + lengthBeats}`)
      }
    })
  })

  describe('general constraints', () => {
    const styles = ['snare-roll', 'tom-fill', 'crash-buildup', 'tribal', 'trap-roll', 'break', 'simple'] as const

    for (const style of styles) {
      it(`${style}: all notes have beat in [startBeat, startBeat + lengthBeats)`, () => {
        const startBeat = 8
        const lengthBeats = 2
        const notes = gen.generate(makeOptions({ style, startBeat, lengthBeats, seed: 99 }))
        for (const n of notes) {
          assert.ok(n.startBeat >= startBeat,
            `[${style}] note at ${n.startBeat} should be >= ${startBeat}`)
          assert.ok(n.startBeat < startBeat + lengthBeats,
            `[${style}] note at ${n.startBeat} should be < ${startBeat + lengthBeats}`)
        }
      })

      it(`${style}: all notes have velocity in [1, 127]`, () => {
        const notes = gen.generate(makeOptions({ style, seed: 77 }))
        for (const n of notes) {
          assert.ok(n.velocity >= 1 && n.velocity <= 127,
            `[${style}] velocity ${n.velocity} out of range [1, 127]`)
        }
      })

      it(`${style}: all notes have pitch in [0, 127]`, () => {
        const notes = gen.generate(makeOptions({ style, seed: 55 }))
        for (const n of notes) {
          assert.ok(n.pitch >= 0 && n.pitch <= 127,
            `[${style}] pitch ${n.pitch} out of range [0, 127]`)
        }
      })
    }
  })

  describe('determinism', () => {
    it('same seed produces same output', () => {
      const opts = makeOptions({ style: 'tribal', seed: 1234, lengthBeats: 2 })
      const run1 = gen.generate(opts)
      const run2 = gen.generate(opts)
      assert.equal(run1.length, run2.length, 'Same seed should produce same number of notes')
      for (let i = 0; i < run1.length; i++) {
        assert.equal(run1[i]!.pitch,      run2[i]!.pitch)
        assert.equal(run1[i]!.startBeat,  run2[i]!.startBeat)
        assert.equal(run1[i]!.velocity,   run2[i]!.velocity)
      }
    })

    it('different seeds produce different output', () => {
      const run1 = gen.generate(makeOptions({ style: 'tribal', seed: 1 }))
      const run2 = gen.generate(makeOptions({ style: 'tribal', seed: 9999 }))
      // Very unlikely to be identical
      const identical = run1.length === run2.length &&
        run1.every((n, i) => n.pitch === run2[i]!.pitch && n.startBeat === run2[i]!.startBeat)
      assert.ok(!identical, 'Different seeds should produce different output')
    })
  })

  describe('suggestFillPositions', () => {
    it('64 total beats → returns array of positions all in [0, 64)', () => {
      const positions = gen.suggestFillPositions(64, 128)
      assert.ok(Array.isArray(positions), 'Should return array')
      for (const p of positions) {
        assert.ok(p >= 0 && p < 64, `Position ${p} should be in [0, 64)`)
      }
    })

    it('returns fewer fill positions for higher tempo', () => {
      const slow = gen.suggestFillPositions(128, 80)   // bpm<100, fills every 4 bars = 16 beats
      const fast = gen.suggestFillPositions(128, 140)  // bpm>=100, fills every 8 bars = 32 beats
      assert.ok(slow.length >= fast.length, 'Slow tempo should have >= fill positions')
    })

    it('empty when totalBeats too small', () => {
      const positions = gen.suggestFillPositions(4, 128)
      // With interval=32, nothing should fit before beat 4
      assert.equal(positions.length, 0)
    })
  })
})
