import { test } from 'node:test'
import assert from 'node:assert/strict'
import { transpose, invert, reverse, legato, staccato, flam } from '../../src/renderer/src/audio/midi/MidiNoteTransformer.ts'
import type { PRNote } from '../../src/renderer/src/components/piano-roll/types.ts'

function mk(id: string, pitch: number, start: number, len: number, vel = 100): PRNote {
  return { id, pitch, startBeat: start, lengthBeats: len, velocity: vel, selected: true, muted: false }
}

// ── transpose ─────────────────────────────────────────────────────────────────

test('transpose up 12 semitones', () => {
  const result = transpose([mk('a', 60, 0, 1)], 12)
  assert.strictEqual(result[0]!.pitch, 72)
})

test('transpose down', () => {
  const result = transpose([mk('a', 60, 0, 1)], -12)
  assert.strictEqual(result[0]!.pitch, 48)
})

test('transpose clamps to 127', () => {
  const result = transpose([mk('a', 120, 0, 1)], 20)
  assert.strictEqual(result[0]!.pitch, 127)
})

test('transpose clamps to 0', () => {
  const result = transpose([mk('a', 5, 0, 1)], -20)
  assert.strictEqual(result[0]!.pitch, 0)
})

// ── invert ────────────────────────────────────────────────────────────────────

test('invert around explicit pivot', () => {
  const result = invert([mk('a', 60, 0, 1)], 64)
  assert.strictEqual(result[0]!.pitch, 68)  // 2*64 - 60 = 68
})

test('invert around computed center', () => {
  // Two notes at 60 and 72 → center = 66 → invert 60→72, 72→60
  const notes = [mk('a', 60, 0, 1), mk('b', 72, 1, 1)]
  const result = invert(notes)
  const pitches = result.map(n => n.pitch).sort((a, b) => a - b)
  assert.deepStrictEqual(pitches, [60, 72])  // symmetric swap
})

// ── reverse ───────────────────────────────────────────────────────────────────

test('reverse flips note order in time', () => {
  const notes = [mk('a', 60, 0, 1), mk('b', 62, 2, 1)]
  const result = reverse(notes)
  assert.strictEqual(result[0]!.pitch, 62)   // b now first
  assert.strictEqual(result[1]!.pitch, 60)   // a now last
})

test('reverse maintains time span', () => {
  const notes = [mk('a', 60, 0, 1), mk('b', 62, 3, 1)]
  const result = reverse(notes)
  const minStart = Math.min(...result.map(n => n.startBeat))
  const maxEnd   = Math.max(...result.map(n => n.startBeat + n.lengthBeats))
  assert.ok(minStart >= 0)
  assert.strictEqual(maxEnd, 4)   // original span was 0..4
})

test('reverse empty array returns empty', () => {
  assert.deepStrictEqual(reverse([]), [])
})

// ── legato ────────────────────────────────────────────────────────────────────

test('legato extends first note to second start', () => {
  const notes = [mk('a', 60, 0, 0.25), mk('b', 62, 1, 0.25)]
  const result = legato(notes)
  const a = result.find(n => n.id === 'a')!
  assert.strictEqual(a.lengthBeats, 1)
})

test('legato last note unchanged', () => {
  const notes = [mk('a', 60, 0, 0.25), mk('b', 62, 1, 0.5)]
  const result = legato(notes)
  const b = result.find(n => n.id === 'b')!
  assert.strictEqual(b.lengthBeats, 0.5)
})

// ── staccato ─────────────────────────────────────────────────────────────────

test('staccato halves note length', () => {
  const result = staccato([mk('a', 60, 0, 1)], 0.5)
  assert.strictEqual(result[0]!.lengthBeats, 0.5)
})

test('staccato clamps to minimum 1/16', () => {
  const result = staccato([mk('a', 60, 0, 0.0625)], 0.1)
  assert.ok(result[0]!.lengthBeats >= 0.0625)
})

// ── flam ─────────────────────────────────────────────────────────────────────

test('flam doubles note count', () => {
  const notes = [mk('a', 60, 1, 0.5), mk('b', 64, 2, 0.5)]
  const result = flam(notes)
  assert.strictEqual(result.length, 4)
})

test('flam ghost note starts before original', () => {
  const notes = [mk('a', 60, 1, 0.5)]
  const result = flam(notes)
  const ghost = result.find(n => n.id === 'a_flam')!
  assert.ok(ghost.startBeat < 1)
})

test('flam ghost velocity is lower', () => {
  const notes = [mk('a', 60, 1, 0.5, 100)]
  const result = flam(notes)
  const ghost = result.find(n => n.id === 'a_flam')!
  assert.ok(ghost.velocity < 100)
})
