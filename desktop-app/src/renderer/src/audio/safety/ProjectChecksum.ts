/**
 * ProjectChecksum — lightweight fast checksum using djb2 hash algorithm.
 * Pure functions, no state, no classes.
 */

/**
 * djb2 hash: deterministic unsigned 32-bit integer from a string.
 */
export function computeChecksum(data: string): number {
  let hash = 5381
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) + hash) + data.charCodeAt(i)
  }
  return hash >>> 0
}

/**
 * Returns true if the two checksums differ (i.e. the data has changed).
 */
export function hasChanged(prev: number, current: number): boolean {
  return prev !== current
}

/**
 * Computes the checksum of any object by JSON-serialising it first.
 */
export function checksumObject(obj: unknown): number {
  return computeChecksum(JSON.stringify(obj))
}
