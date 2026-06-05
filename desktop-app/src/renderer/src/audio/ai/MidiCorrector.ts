// ─── MidiCorrector.ts ─────────────────────────────────────────────────────────
// Analyzes and corrects MIDI data quality issues.

export interface MidiNote {
  id: string
  pitch: number        // 0-127
  startBeat: number
  duration: number     // beats
  velocity: number     // 1-127
}

export interface CorrectionOptions {
  quantizeStrength: number   // 0-1: how strongly to snap to grid
  quantizeGrid: number       // e.g., 0.25 = 1/16th note at 1/4=beat
  velocitySmoothing: number  // 0-1
  removeOutliers: boolean
  pitchRange: { min: number; max: number }
}

export interface CorrectionChange {
  noteId: string
  type: 'quantize' | 'velocity' | 'removed' | 'pitch-snap'
  before: { startBeat?: number; velocity?: number; pitch?: number }
  after: { startBeat?: number; velocity?: number; pitch?: number }
}

export interface CorrectionResult {
  notes: MidiNote[]
  changes: CorrectionChange[]
  qualityBefore: number  // 0-1
  qualityAfter: number   // 0-1
}

export class MidiCorrector {
  /**
   * Quantize note start times to grid.
   * strength: 0 = no change, 1 = full snap
   */
  quantize(notes: MidiNote[], grid: number, strength: number): MidiNote[] {
    if (grid <= 0) return notes.map(n => ({ ...n }))
    return notes.map(n => {
      const snapped = Math.round(n.startBeat / grid) * grid
      const quantized = n.startBeat + (snapped - n.startBeat) * strength
      return { ...n, startBeat: quantized }
    })
  }

  /**
   * Smooth velocity curve using a running average over windowSize neighboring notes.
   */
  smoothVelocities(notes: MidiNote[], windowSize: number): MidiNote[] {
    if (notes.length === 0) return []
    const sorted = notes.slice().sort((a, b) => a.startBeat - b.startBeat)
    return sorted.map((note, i) => {
      let sum = 0
      let count = 0
      const half = Math.floor(windowSize / 2)
      for (let j = i - half; j <= i + half; j++) {
        if (j >= 0 && j < sorted.length) {
          sum += sorted[j]!.velocity
          count++
        }
      }
      const avg = count > 0 ? sum / count : note.velocity
      return { ...note, velocity: Math.max(1, Math.min(127, Math.round(avg))) }
    })
  }

  /**
   * Detect and fix overlapping notes of the same pitch.
   * Truncates the earlier note's duration if it overlaps with the next.
   */
  fixOverlaps(notes: MidiNote[]): MidiNote[] {
    if (notes.length === 0) return []
    const result = notes.map(n => ({ ...n }))

    // Group by pitch
    const byPitch = new Map<number, number[]>()
    for (let i = 0; i < result.length; i++) {
      const pitch = result[i]!.pitch
      if (!byPitch.has(pitch)) byPitch.set(pitch, [])
      byPitch.get(pitch)!.push(i)
    }

    for (const indices of byPitch.values()) {
      // Sort by startBeat
      indices.sort((a, b) => result[a]!.startBeat - result[b]!.startBeat)

      for (let k = 0; k < indices.length - 1; k++) {
        const curr = result[indices[k]!]!
        const next = result[indices[k + 1]!]!
        const currEnd = curr.startBeat + curr.duration
        if (currEnd > next.startBeat) {
          // Truncate curr so it ends just before next
          curr.duration = Math.max(0.01, next.startBeat - curr.startBeat)
        }
      }
    }

    return result
  }

  /**
   * Remove notes whose pitch falls outside [min, max].
   */
  removeOutlierPitches(notes: MidiNote[], min: number, max: number): MidiNote[] {
    return notes.filter(n => n.pitch >= min && n.pitch <= max)
  }

  /**
   * Compute overall quality score 0-1.
   * Factors: timing regularity, velocity smoothness, no overlaps.
   */
  computeQuality(notes: MidiNote[], grid: number): number {
    if (notes.length === 0) return 1

    // Timing score: avg deviation from nearest grid position
    let totalTimingDeviation = 0
    if (grid > 0) {
      for (const note of notes) {
        const snapped = Math.round(note.startBeat / grid) * grid
        totalTimingDeviation += Math.abs(note.startBeat - snapped)
      }
    }
    const avgDeviation = totalTimingDeviation / notes.length
    // Normalize: deviation of grid/2 = worst case
    const timingScore = grid > 0 ? Math.max(0, 1 - avgDeviation / (grid / 2)) : 1

    // Velocity score: 1 - stddev / 64
    const velMean = notes.reduce((s, n) => s + n.velocity, 0) / notes.length
    const velVariance = notes.reduce((s, n) => s + (n.velocity - velMean) ** 2, 0) / notes.length
    const velStdDev = Math.sqrt(velVariance)
    const velocityScore = Math.max(0, 1 - velStdDev / 64)

    // Overlap score: 1 if no overlaps
    let hasOverlap = false
    const byPitch = new Map<number, MidiNote[]>()
    for (const note of notes) {
      if (!byPitch.has(note.pitch)) byPitch.set(note.pitch, [])
      byPitch.get(note.pitch)!.push(note)
    }
    for (const pitchNotes of byPitch.values()) {
      const sorted = pitchNotes.slice().sort((a, b) => a.startBeat - b.startBeat)
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i]!.startBeat + sorted[i]!.duration > sorted[i + 1]!.startBeat) {
          hasOverlap = true
          break
        }
      }
      if (hasOverlap) break
    }
    const overlapScore = hasOverlap ? 0 : 1

    return (timingScore + velocityScore + overlapScore) / 3
  }

  /**
   * Apply all corrections in sequence.
   */
  correctAll(notes: MidiNote[], options: CorrectionOptions): CorrectionResult {
    const changes: CorrectionChange[] = []
    const qualityBefore = this.computeQuality(notes, options.quantizeGrid)

    let working = notes.map(n => ({ ...n }))

    // Step 1: Remove outlier pitches
    if (options.removeOutliers) {
      const kept = new Set(
        this.removeOutlierPitches(working, options.pitchRange.min, options.pitchRange.max).map(n => n.id),
      )
      for (const note of working) {
        if (!kept.has(note.id)) {
          changes.push({
            noteId: note.id,
            type: 'removed',
            before: { pitch: note.pitch },
            after: {},
          })
        }
      }
      working = working.filter(n => kept.has(n.id))
    }

    // Step 2: Quantize
    if (options.quantizeStrength > 0) {
      const quantized = this.quantize(working, options.quantizeGrid, options.quantizeStrength)
      for (let i = 0; i < working.length; i++) {
        const before = working[i]!
        const after = quantized[i]!
        if (Math.abs(before.startBeat - after.startBeat) > 0.0001) {
          changes.push({
            noteId: before.id,
            type: 'quantize',
            before: { startBeat: before.startBeat },
            after: { startBeat: after.startBeat },
          })
        }
      }
      working = quantized
    }

    // Step 3: Smooth velocities
    if (options.velocitySmoothing > 0) {
      const smoothed = this.smoothVelocities(working, 3)
      for (let i = 0; i < smoothed.length; i++) {
        const orig = working.find(n => n.id === smoothed[i]!.id)
        if (orig && orig.velocity !== smoothed[i]!.velocity) {
          changes.push({
            noteId: orig.id,
            type: 'velocity',
            before: { velocity: orig.velocity },
            after: { velocity: smoothed[i]!.velocity },
          })
        }
      }
      working = smoothed
    }

    // Step 4: Fix overlaps
    working = this.fixOverlaps(working)

    const qualityAfter = this.computeQuality(working, options.quantizeGrid)

    return {
      notes: working,
      changes,
      qualityBefore,
      qualityAfter,
    }
  }
}

export const midiCorrector = new MidiCorrector()
