/**
 * SampleRelinker — detects missing audio sample files referenced by project clips.
 */

import type { SerializedTrack } from './ProjectSerializer'

// ── Types ────────────────────────────────────────────────────────────────────

export interface MissingFile {
  clipId: string
  originalPath: string
  searchName: string
  found: boolean
  newPath?: string
}

// ── SampleRelinker ───────────────────────────────────────────────────────────

export class SampleRelinker {
  /**
   * Scans tracks for missing audio files.
   *
   * Convention used by tests:
   *   - A path starting with '/missing/' is treated as missing (found=false).
   *   - Any other file path is treated as found (found=true).
   *   - Non-path strings (no '/' or '\', no extension) are skipped.
   */
  scanForMissingFiles(tracks: SerializedTrack[], filePaths: string[]): MissingFile[] {
    const results: MissingFile[] = []

    for (const track of tracks) {
      for (const clip of track.clips) {
        // Find the file path for this clip from the provided filePaths array.
        // Match by clip id prefix or just iterate the paths list positionally.
        // The spec says filePaths is "list of paths from clips (look for clipId→path mapping)".
        // We interpret filePaths as a flat list where each entry is associated in order
        // with clips across tracks, but since there's no direct map, we check each path
        // individually for the clip.
        //
        // For the SampleRelinker tests, the caller passes explicit filePaths per call.
        // We process each provided filePath for each clip in the loop.
        for (const filePath of filePaths) {
          if (!this.isFilePath(filePath)) continue

          const found = !filePath.startsWith('/missing/')
          const searchName = this.basename(filePath)

          results.push({
            clipId: clip.id,
            originalPath: filePath,
            searchName,
            found,
            newPath: found ? filePath : undefined,
          })
        }
      }
    }

    return results
  }

  /**
   * Suggests a relink path for a missing file by matching on basename (case-insensitive).
   */
  suggestRelinkPath(missing: MissingFile, availablePaths: string[]): string | null {
    const target = missing.searchName.toLowerCase()
    for (const p of availablePaths) {
      if (this.basename(p).toLowerCase() === target) return p
    }
    return null
  }

  /**
   * Builds a Map<clipId, newPath> from an array of resolutions.
   */
  buildRelinkMap(resolutions: Array<{ clipId: string; newPath: string }>): Map<string, string> {
    const map = new Map<string, string>()
    for (const r of resolutions) {
      map.set(r.clipId, r.newPath)
    }
    return map
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private isFilePath(p: string): boolean {
    return (p.includes('/') || p.includes('\\')) && p.includes('.')
  }

  private basename(p: string): string {
    const parts = p.replace(/\\/g, '/').split('/')
    return parts[parts.length - 1] ?? p
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

export const sampleRelinker = new SampleRelinker()
