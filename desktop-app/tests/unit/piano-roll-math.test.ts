import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  pitchName, isBlackKey,
  snapFloor, snapRound, snapCeil,
  SNAP_BEATS,
} from '../../src/renderer/src/components/piano-roll/types.ts'

describe('piano-roll / pitchName', () => {
  it('60 → C4', () => assert.equal(pitchName(60), 'C4'))
  it('61 → C#4', () => assert.equal(pitchName(61), 'C#4'))
  it('69 → A4 (concert A)', () => assert.equal(pitchName(69), 'A4'))
  it('0 → C-1', () => assert.equal(pitchName(0), 'C-1'))
  it('127 → G9', () => assert.equal(pitchName(127), 'G9'))
})

describe('piano-roll / isBlackKey', () => {
  it('C is white', () => assert.equal(isBlackKey(60), false))
  it('C# is black', () => assert.equal(isBlackKey(61), true))
  it('F# (66) is black', () => assert.equal(isBlackKey(66), true))
  it('E (64) is white', () => assert.equal(isBlackKey(64), false))
  it('agrees with the canonical pattern across an octave', () => {
    const expected = [false, true, false, true, false, false, true, false, true, false, true, false]
    for (let i = 0; i < 12; i++) {
      assert.equal(isBlackKey(60 + i), expected[i], `pitch ${60 + i}`)
    }
  })
})

describe('piano-roll / snap functions', () => {
  it('snapFloor 7 at 1/4 grid (=1 beat) → 7', () => assert.equal(snapFloor(7, '1/4'), 7))
  it('snapFloor 7.3 at 1/4 → 7', () => assert.equal(snapFloor(7.3, '1/4'), 7))
  it('snapRound 7.6 at 1/4 → 8', () => assert.equal(snapRound(7.6, '1/4'), 8))
  it('snapCeil 7.1 at 1/4 → 8', () => assert.equal(snapCeil(7.1, '1/4'), 8))
  it('snap=off returns value unchanged', () => {
    assert.equal(snapFloor(3.7, 'off'), 3.7)
    assert.equal(snapRound(3.7, 'off'), 3.7)
    assert.equal(snapCeil(3.7, 'off'), 3.7)
  })
  it('1/16 snap step is 0.25 beats', () => assert.equal(SNAP_BEATS['1/16'], 0.25))
  it('snapFloor 0.3 at 1/16 → 0.25', () => assert.equal(snapFloor(0.3, '1/16'), 0.25))
  it('snapCeil 0.26 at 1/16 → 0.5', () => assert.equal(snapCeil(0.26, '1/16'), 0.5))
})
