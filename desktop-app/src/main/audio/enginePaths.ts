/**
 * enginePaths — pure functions for resolving the native audio-engine binary path.
 *
 * Extracted as a separate module so path-resolution logic can be unit-tested
 * without requiring an Electron runtime (no `import { app } from 'electron'`).
 *
 * Binary locations (in priority order):
 *   1. Production packaged build  — {appPath}/../audio-engine/audio-engine[.exe]
 *      Populated by electron-builder extraResources from:
 *      native/audio-engine/target/release/audio-engine[.exe]
 *
 *   2. Development release build  — <repo>/native/audio-engine/target/release/…
 *      Built by: cd native/audio-engine && cargo build --release
 *
 *   3. Development debug build    — <repo>/native/audio-engine/target/debug/…
 *      Built by: cd native/audio-engine && cargo build
 */

import { join }        from 'node:path'
import { existsSync }  from 'node:fs'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BinarySearchResult {
  /** Resolved path to the binary, or null if not found. */
  path:         string | null
  /** Every candidate path that was examined (in order). */
  checkedPaths: string[]
}

// ─── Path helpers ─────────────────────────────────────────────────────────────

/**
 * Returns the platform-specific binary filename.
 * Windows: "audio-engine.exe"  |  macOS / Linux: "audio-engine"
 */
export function engineBinaryName(platform: string): string {
  return platform === 'win32' ? 'audio-engine.exe' : 'audio-engine'
}

/**
 * Returns the ordered list of candidate paths for the native binary.
 *
 * @param appPath   `app.getAppPath()` from Electron — used to locate the
 *                  production resources directory.
 * @param dirname   `__dirname` of AudioEngineProcess — used to walk up to
 *                  the repo root during development.
 * @param platform  `process.platform`
 */
export function getEngineBinaryCandidates(
  appPath:  string,
  dirname:  string,
  platform: string,
): string[] {
  const bin = engineBinaryName(platform)
  return [
    // ── 1. Production (electron-builder extraResources) ───────────────────
    // electron-builder copies the binary into {resources}/audio-engine/
    // app.getAppPath() resolves to {resources}/app.asar (or /app),
    // so ".." lands in {resources}/.
    join(appPath, '..', 'audio-engine', bin),

    // ── 2. Development — Cargo release build ──────────────────────────────
    // Walk up from out/main/audio/ → out/main → out → desktop-app → repo root
    join(dirname, '..', '..', '..', '..', '..', 'native', 'audio-engine', 'target', 'release', bin),

    // ── 3. Development — Cargo debug build ────────────────────────────────
    join(dirname, '..', '..', '..', '..', '..', 'native', 'audio-engine', 'target', 'debug', bin),
  ]
}

/**
 * Walks the candidate list and returns the first path that exists on disk,
 * together with the full list of paths that were examined.
 */
export function findEngineBinary(candidates: string[]): BinarySearchResult {
  const checkedPaths: string[] = []
  for (const p of candidates) {
    checkedPaths.push(p)
    if (existsSync(p)) {
      return { path: p, checkedPaths }
    }
  }
  return { path: null, checkedPaths }
}
