// RecordingFileManager — directory management, path generation, session markers,
// and partial-recording recovery for the audio recording system.
import { writeFile, readFile, unlink, readdir, mkdir } from 'node:fs/promises'
import { join, basename } from 'node:path'

export interface RecordingSessionMeta {
  sessionId: string
  trackId:   string
  format:    'wav' | 'flac'
  startedAt: number
  tmpPath:   string
}

export class RecordingFileManager {
  private _dir: string

  constructor(opts?: { dir?: string }) {
    if (opts?.dir) {
      this._dir = opts.dir
    } else {
      this._dir = ''  // resolved lazily via _resolveDir()
    }
  }

  private _resolveDir(): string {
    if (this._dir) return this._dir
    // Lazy require to avoid loading Electron in tests
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { app } = require('electron') as { app: { getPath: (n: string) => string } }
    return join(app.getPath('userData'), 'recordings')
  }

  async ensureDir(): Promise<void> {
    await mkdir(this._resolveDir(), { recursive: true })
  }

  // Returns an absolute path: <dir>/<sanitizedTrackId>-take-<NN>.<format>
  getRecordingPath(trackId: string, takeNumber: number, format: 'wav' | 'flac'): string {
    const safe = trackId
      .replace(/[^a-zA-Z0-9_\-]/g, '')
      .slice(0, 32) || 'track'
    const paddedTake = String(takeNumber).padStart(2, '0')
    return join(this._resolveDir(), `${safe}-take-${paddedTake}.${format}`)
  }

  // Path of the .tmp file used during recording (before finalize renames it)
  getTempPath(trackId: string): string {
    const safe = trackId
      .replace(/[^a-zA-Z0-9_\-]/g, '')
      .slice(0, 32) || 'track'
    return join(this._resolveDir(), `${safe}.tmp`)
  }

  // Returns basenames of all .wav and .flac files in the recordings directory
  async listRecordings(): Promise<string[]> {
    const dir = this._resolveDir()
    await mkdir(dir, { recursive: true })
    const entries = await readdir(dir)
    return entries.filter(f => f.endsWith('.wav') || f.endsWith('.flac'))
  }

  // Delete a recording — accepts basename only; rejects unsafe names
  async deleteRecording(filename: string): Promise<void> {
    if (!/^[\w\-]+\.(wav|flac)$/.test(filename)) {
      throw new Error(`Invalid recording filename: ${filename}`)
    }
    // Ensure only the basename is used (no path traversal)
    const safe = basename(filename)
    await unlink(join(this._resolveDir(), safe))
  }

  // Scan for leftover *.tmp files (from interrupted sessions), delete them,
  // and return the list of deleted paths.
  async recoverPartialRecordings(): Promise<string[]> {
    const dir = this._resolveDir()
    let entries: string[]
    try {
      entries = await readdir(dir)
    } catch {
      return []
    }
    const tmpFiles = entries.filter(f => f.endsWith('.tmp'))
    const deleted: string[] = []
    for (const f of tmpFiles) {
      const fullPath = join(dir, f)
      try {
        await unlink(fullPath)
        deleted.push(fullPath)
      } catch {
        // already gone — ignore
      }
    }
    return deleted
  }

  // ── Session markers ──────────────────────────────────────────────────────

  private _markerPath(sessionId: string): string {
    return join(this._resolveDir(), `session-${sessionId}.marker`)
  }

  async writeSessionMarker(sessionId: string, meta: RecordingSessionMeta): Promise<void> {
    const dir = this._resolveDir()
    await mkdir(dir, { recursive: true })
    await writeFile(this._markerPath(sessionId), JSON.stringify(meta), 'utf8')
  }

  async clearSessionMarker(sessionId: string): Promise<void> {
    try {
      await unlink(this._markerPath(sessionId))
    } catch {
      // already gone — that's fine
    }
  }

  async listSessionMarkers(): Promise<RecordingSessionMeta[]> {
    const dir = this._resolveDir()
    let entries: string[]
    try {
      entries = await readdir(dir)
    } catch {
      return []
    }
    const markerFiles = entries.filter(f => f.startsWith('session-') && f.endsWith('.marker'))
    const results: RecordingSessionMeta[] = []
    for (const f of markerFiles) {
      try {
        const raw = await readFile(join(dir, f), 'utf8')
        const parsed = JSON.parse(raw) as RecordingSessionMeta
        results.push(parsed)
      } catch {
        // corrupt marker — skip
      }
    }
    return results
  }
}
