// ─── IncrementalSaveEngine ────────────────────────────────────────────────────
// Pure-TS diff/patch engine — no DOM, no IDB, fully testable in Node.

import type { ProjectSaveData, ProjectSnapshot } from './types'

// ─── Types ────────────────────────────────────────────────────────────────────

export type DiffOp = 'set' | 'del'

export interface DiffChange {
  path:   string
  op:     DiffOp
  value?: unknown
}

export interface IncrementalDiff {
  baseSnapshotId: string
  computedAt:     number
  changes:        DiffChange[]
  stats: {
    added:   number
    changed: number
    deleted: number
  }
}

/** Extended snapshot with diff payload */
export interface DeltaSnapshot {
  id:        string
  label:     string
  createdAt: number
  type:      'delta'
  baseId:    string
  diff:      IncrementalDiff
  checksum:  string
  sizeBytes: number
  dirty:     boolean
}

// ─── flattenObject ────────────────────────────────────────────────────────────

/**
 * Flatten a nested object to a flat key→value map.
 * Arrays are treated as OPAQUE leaves — they are NOT recursed into.
 * null values are kept as leaves.
 */
export function flattenObject(
  obj: unknown,
  prefix = '',
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  if (
    obj === null ||
    obj === undefined ||
    typeof obj !== 'object' ||
    Array.isArray(obj)
  ) {
    // Scalar or array — store as leaf
    if (prefix !== '') {
      result[prefix] = obj
    }
    return result
  }

  const record = obj as Record<string, unknown>
  const keys = Object.keys(record)

  if (keys.length === 0) {
    // Empty object — store as leaf so round-trips work
    if (prefix !== '') {
      result[prefix] = {}
    }
    return result
  }

  for (const key of keys) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    const val = record[key]

    if (
      val !== null &&
      val !== undefined &&
      typeof val === 'object' &&
      !Array.isArray(val)
    ) {
      // Recurse into plain objects only
      const nested = flattenObject(val, fullKey)
      Object.assign(result, nested)
    } else {
      // Leaf: scalar, null, or array
      result[fullKey] = val
    }
  }

  return result
}

// ─── setPath / deletePath ─────────────────────────────────────────────────────

/** Set a dot-notated path on an object, creating intermediate objects as needed */
export function setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.')
  let current = obj

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i] as string
    if (
      current[part] === undefined ||
      current[part] === null ||
      typeof current[part] !== 'object' ||
      Array.isArray(current[part])
    ) {
      current[part] = {}
    }
    current = current[part] as Record<string, unknown>
  }

  const lastPart = parts[parts.length - 1] as string
  current[lastPart] = value
}

/** Delete a dot-notated path from an object */
export function deletePath(obj: Record<string, unknown>, path: string): void {
  const parts = path.split('.')
  let current = obj

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i] as string
    if (
      current[part] === undefined ||
      current[part] === null ||
      typeof current[part] !== 'object' ||
      Array.isArray(current[part])
    ) {
      return // path doesn't exist, nothing to delete
    }
    current = current[part] as Record<string, unknown>
  }

  const lastPart = parts[parts.length - 1] as string
  delete current[lastPart]
}

// ─── computeDiff ──────────────────────────────────────────────────────────────

/**
 * Compute a diff between two ProjectSaveData objects.
 * Uses JSON.stringify equality for values.
 */
export function computeDiff(
  baseId: string,
  prev: ProjectSaveData,
  curr: ProjectSaveData,
): IncrementalDiff {
  const flatPrev = flattenObject(prev)
  const flatCurr = flattenObject(curr)

  const changes: DiffChange[] = []
  let added = 0
  let changed = 0
  let deleted = 0

  // Find set operations (added + changed)
  for (const key of Object.keys(flatCurr)) {
    if (!(key in flatPrev)) {
      changes.push({ path: key, op: 'set', value: flatCurr[key] })
      added++
    } else if (JSON.stringify(flatCurr[key]) !== JSON.stringify(flatPrev[key])) {
      changes.push({ path: key, op: 'set', value: flatCurr[key] })
      changed++
    }
  }

  // Find del operations (deleted keys)
  for (const key of Object.keys(flatPrev)) {
    if (!(key in flatCurr)) {
      changes.push({ path: key, op: 'del' })
      deleted++
    }
  }

  return {
    baseSnapshotId: baseId,
    computedAt:     Date.now(),
    changes,
    stats: { added, changed, deleted },
  }
}

// ─── applyDiff ────────────────────────────────────────────────────────────────

/**
 * Apply a diff to a base ProjectSaveData to reconstruct the target state.
 * Deep-clones base before applying to avoid mutation.
 */
export function applyDiff(base: ProjectSaveData, diff: IncrementalDiff): ProjectSaveData {
  // Deep-clone base
  const result = JSON.parse(JSON.stringify(base)) as Record<string, unknown>

  for (const change of diff.changes) {
    if (change.op === 'set') {
      setPath(result, change.path, change.value)
    } else {
      deletePath(result, change.path)
    }
  }

  return result as unknown as ProjectSaveData
}

// ─── isDeltaSnapshot ──────────────────────────────────────────────────────────

/** Type guard — checks if a snapshot is a DeltaSnapshot */
export function isDeltaSnapshot(snap: unknown): snap is DeltaSnapshot {
  if (snap === null || typeof snap !== 'object' || Array.isArray(snap)) return false
  const s = snap as Record<string, unknown>
  return s.type === 'delta' && typeof s.baseId === 'string' && s.diff !== undefined
}

// ─── computeSavings ───────────────────────────────────────────────────────────

/**
 * Estimate the storage savings of using a diff vs a full snapshot.
 * Each change is estimated as ~64 bytes of JSON overhead.
 */
export function computeSavings(
  fullSizeBytes: number,
  diffChangeCount: number,
): { diffBytes: number; savingsPct: number } {
  const BYTES_PER_CHANGE = 64
  const diffBytes = diffChangeCount * BYTES_PER_CHANGE

  if (fullSizeBytes === 0) {
    return { diffBytes: 0, savingsPct: 0 }
  }

  const savingsPct = Math.max(
    0,
    Math.min(100, Math.round(((fullSizeBytes - diffBytes) / fullSizeBytes) * 100)),
  )

  return { diffBytes, savingsPct }
}
