import type { PRNote } from '../../components/piano-roll/types'

/** Transpose all notes by semitones (can be negative) */
export function transpose(notes: PRNote[], semitones: number): PRNote[] {
  return notes.map(n => ({
    ...n,
    pitch: Math.max(0, Math.min(127, n.pitch + semitones)),
  }))
}

/** Invert notes around the given pivot pitch (default: middle of range) */
export function invert(notes: PRNote[], pivotPitch?: number): PRNote[] {
  const pivot = pivotPitch ?? Math.round(
    notes.reduce((s, n) => s + n.pitch, 0) / (notes.length || 1)
  )
  return notes.map(n => ({
    ...n,
    pitch: Math.max(0, Math.min(127, 2 * pivot - n.pitch)),
  }))
}

/** Reverse note order in time (mirror around center of time range) */
export function reverse(notes: PRNote[]): PRNote[] {
  if (notes.length === 0) return []
  const minBeat = Math.min(...notes.map(n => n.startBeat))
  const maxEnd  = Math.max(...notes.map(n => n.startBeat + n.lengthBeats))
  return notes.map(n => ({
    ...n,
    startBeat: maxEnd - (n.startBeat - minBeat) - n.lengthBeats,
  })).sort((a, b) => a.startBeat - b.startBeat)
}

/** Make each note extend to the start of the next note (legato) */
export function legato(notes: PRNote[]): PRNote[] {
  const sorted = [...notes].sort((a, b) => a.startBeat - b.startBeat)
  return sorted.map((n, i) => {
    const next = sorted[i + 1]
    if (!next) return n
    return { ...n, lengthBeats: next.startBeat - n.startBeat }
  })
}

/** Shorten each note to staccato fraction (0.0–1.0 of original length) */
export function staccato(notes: PRNote[], fraction = 0.5): PRNote[] {
  return notes.map(n => ({
    ...n,
    lengthBeats: Math.max(0.0625, n.lengthBeats * Math.max(0, Math.min(1, fraction))),
  }))
}

/** Flam: add a ghost note 1/32 beat before each selected note, -20 velocity */
export function flam(notes: PRNote[]): PRNote[] {
  const flamBeats = 0.0625  // 1/32 beat
  const extras: PRNote[] = notes.map(n => ({
    ...n,
    id:          `${n.id}_flam`,
    startBeat:   Math.max(0, n.startBeat - flamBeats),
    lengthBeats: flamBeats,
    velocity:    Math.max(1, n.velocity - 20),
    selected:    false,
  }))
  return [...notes, ...extras]
}
