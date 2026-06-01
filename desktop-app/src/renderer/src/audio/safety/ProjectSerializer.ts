/**
 * ProjectSerializer — serialises/deserialises project state into a versioned snapshot.
 */

import { computeChecksum } from './ProjectChecksum'

// ── Types ────────────────────────────────────────────────────────────────────

export interface SerializedClip {
  id: string
  startBeat: number
  durationBeats: number
  color?: string
}

export interface SerializedTrack {
  id: string
  name: string
  type: string
  volume: number
  pan: number
  muted: boolean
  soloed: boolean
  clips: SerializedClip[]
}

export interface ProjectSnapshot {
  version: number
  schemaVersion: string
  savedAt: number
  projectId: string
  projectName: string
  bpm: number
  timeSignature: { numerator: number; denominator: number }
  tracks: SerializedTrack[]
  masterVolume: number
  checksum: number
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Minimal shape we read from the project store.
 * Matches the fields present in projectStore.ts / the Project type.
 */
export interface ProjectStoreState {
  bpm: number
  tracks: Array<{
    id: string
    name: string
    type: string
    gainDb: number
    panCenter: number
    muted: boolean
    soloed: boolean
    clips: Array<{
      id: string
      startBar: number
      lengthBars: number
      color?: string
    }>
  }>
  masterVolume?: number
  id?: string
  name?: string
  // project sub-object (for stores that nest state under .project)
  project?: {
    id?: string
    name?: string
    bpm?: number
    masterGainDb?: number
    timeSignatureNumerator?: number
    timeSignatureDenominator?: number
    tracks?: Array<{
      id: string
      name: string
      type: string
      gainDb: number
      panCenter: number
      muted: boolean
      soloed: boolean
      clips: Array<{
        id: string
        startBar: number
        lengthBars: number
        color?: string
      }>
    }>
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

type SnapshotWithoutChecksum = Omit<ProjectSnapshot, 'checksum'>

function buildSnapshotWithoutChecksum(state: ProjectStoreState): SnapshotWithoutChecksum {
  // Support both flat state and nested .project shape
  const proj = state.project
  const bpm = proj?.bpm ?? state.bpm
  const projectId = proj?.id ?? state.id ?? 'unknown'
  const projectName = proj?.name ?? state.name ?? 'Untitled'
  const masterVolume = proj?.masterGainDb ?? state.masterVolume ?? 0
  const numerator = proj?.timeSignatureNumerator ?? 4
  const denominator = proj?.timeSignatureDenominator ?? 4
  const rawTracks = proj?.tracks ?? state.tracks ?? []

  const tracks: SerializedTrack[] = rawTracks.map(t => ({
    id: t.id,
    name: t.name,
    type: t.type,
    volume: t.gainDb,
    pan: t.panCenter,
    muted: t.muted,
    soloed: t.soloed,
    clips: t.clips.map(c => ({
      id: c.id,
      startBeat: c.startBar,
      durationBeats: c.lengthBars,
      color: c.color,
    })),
  }))

  return {
    version: 1,
    schemaVersion: '1.0.0',
    savedAt: Date.now(),
    projectId,
    projectName,
    bpm,
    timeSignature: { numerator, denominator },
    tracks,
    masterVolume,
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function serializeProject(state: ProjectStoreState): ProjectSnapshot {
  const withoutChecksum = buildSnapshotWithoutChecksum(state)
  const checksum = computeChecksum(JSON.stringify(withoutChecksum))
  return { ...withoutChecksum, checksum }
}

export function deserializeProject(json: string): ProjectSnapshot | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return null
  }

  if (typeof parsed !== 'object' || parsed === null) return null

  const snapshot = parsed as ProjectSnapshot

  // Validate checksum: recompute without the checksum field
  const { checksum, ...withoutChecksum } = snapshot
  const expected = computeChecksum(JSON.stringify(withoutChecksum))
  if (expected !== checksum) return null

  return snapshot
}

export function validateSnapshot(snapshot: ProjectSnapshot): ValidationResult {
  const errors: string[] = []

  if (snapshot.version !== 1) {
    errors.push(`version must be 1, got ${snapshot.version}`)
  }

  if (typeof snapshot.savedAt !== 'number' || snapshot.savedAt <= 0) {
    errors.push('savedAt must be a positive number')
  }

  if (!Array.isArray(snapshot.tracks)) {
    errors.push('tracks must be an array')
  }

  if (typeof snapshot.bpm !== 'number' || snapshot.bpm < 20 || snapshot.bpm > 999) {
    errors.push(`bpm must be between 20 and 999, got ${snapshot.bpm}`)
  }

  return { valid: errors.length === 0, errors }
}
