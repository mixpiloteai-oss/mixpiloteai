// ─── DiagnosticLogger ─────────────────────────────────────────────────────────
// Main-process structured diagnostic logger.
// Uses lazy require('electron') for getPath/getVersion to allow test imports.

import { appendFile, mkdir, readFile, readdir, rename, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { IpcMain } from 'electron'

// ─── Types ────────────────────────────────────────────────────────────────────

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

export interface LogEntry {
  ts:        number
  level:     LogLevel
  category:  string
  msg:       string
  data?:     unknown
  sessionId: string
  pid:       number
}

export interface CrashReport {
  generatedAt:     number
  sessionId:       string
  appVersion:      string
  platform:        string
  nodeVersion:     string
  electronVersion: string
  uptime:          number
  entries:         LogEntry[]
  summary: {
    errors:   number
    warnings: number
    fatals:   number
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LOG_PREFIX    = 'diagnostic-'
const MAX_FILES     = 5
const MAX_FILE_BYTES = 512 * 1024  // 500 KB

// ─── DiagnosticLogger ─────────────────────────────────────────────────────────

export class DiagnosticLogger {
  private dir:        string | null
  private sessionId:  string
  private currentFile: string | null = null
  private initialized: boolean = false

  constructor(opts?: { dir?: string; sessionId?: string }) {
    this.dir       = opts?.dir ?? null
    this.sessionId = opts?.sessionId ?? `session-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 8)}`
  }

  /** Initialize: create dir, open log file, write 'Session started' entry */
  async init(): Promise<void> {
    const dir = await this._resolveDir()
    await mkdir(dir, { recursive: true })
    this.dir = dir

    const filename = `${LOG_PREFIX}${Date.now()}.log`
    this.currentFile = join(dir, filename)
    this.initialized = true

    await this.log('info', 'system', 'Session started')
  }

  /** Write a structured log entry */
  async log(level: LogLevel, category: string, msg: string, data?: unknown): Promise<void> {
    const entry: LogEntry = {
      ts:        Date.now(),
      level,
      category,
      msg,
      sessionId: this.sessionId,
      pid:       process.pid,
      ...(data !== undefined ? { data } : {}),
    }
    await this._flushEntry(entry)
  }

  /** Log a crash at 'fatal' level */
  async logCrash(reason: string, data?: unknown): Promise<void> {
    await this.log('fatal', 'crash', reason, data)
  }

  /** Log a recovery result */
  async logRecovery(result: { ok: boolean; reason?: string }): Promise<void> {
    if (result.ok) {
      await this.log('info', 'recovery', 'Recovery succeeded', result)
    } else {
      await this.log('error', 'recovery', result.reason ?? 'Recovery failed', result)
    }
  }

  /** Read all log files, parse NDJSON, sort by ts desc, return latest N */
  async readAll(maxLines = 10000): Promise<LogEntry[]> {
    const dir = await this._resolveDir()

    let files: string[]
    try {
      files = await this._listLogFiles(dir)
    } catch {
      return []
    }

    const entries: LogEntry[] = []

    for (const file of files) {
      try {
        const content = await readFile(join(dir, file), 'utf8')
        for (const line of content.split('\n')) {
          const trimmed = line.trim()
          if (!trimmed) continue
          try {
            const entry = JSON.parse(trimmed) as LogEntry
            entries.push(entry)
          } catch {
            // skip malformed lines
          }
        }
      } catch {
        // skip unreadable files
      }
    }

    entries.sort((a, b) => b.ts - a.ts)
    return entries.slice(0, maxLines)
  }

  /** Generate a structured crash report */
  async generateReport(): Promise<CrashReport> {
    const entries = await this.readAll(500)

    let errors   = 0
    let warnings = 0
    let fatals   = 0

    for (const e of entries) {
      if (e.level === 'error')   errors++
      if (e.level === 'warn')    warnings++
      if (e.level === 'fatal')   fatals++
    }

    let appVersion      = 'unknown'
    let electronVersion = 'unknown'

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { app } = require('electron') as { app: { getVersion(): string } }
      appVersion      = app.getVersion()
      electronVersion = process.versions.electron ?? 'unknown'
    } catch {
      // running in test environment without electron
    }

    return {
      generatedAt:     Date.now(),
      sessionId:       this.sessionId,
      appVersion,
      platform:        process.platform,
      nodeVersion:     process.version,
      electronVersion,
      uptime:          process.uptime(),
      entries,
      summary: { errors, warnings, fatals },
    }
  }

  /** Delete all log files */
  async clearLogs(): Promise<void> {
    const dir = await this._resolveDir()

    let files: string[]
    try {
      files = await this._listLogFiles(dir)
    } catch {
      return
    }

    await Promise.all(
      files.map(f => rm(join(dir, f), { force: true })),
    )

    // Reset current file pointer so next log starts fresh
    if (this.initialized && this.dir) {
      const filename = `${LOG_PREFIX}${Date.now()}.log`
      this.currentFile = join(this.dir, filename)
    }
  }

  /** Keep only the newest MAX_FILES files */
  async prune(): Promise<void> {
    const dir = await this._resolveDir()

    let files: string[]
    try {
      files = await this._listLogFiles(dir)
    } catch {
      return
    }

    if (files.length <= MAX_FILES) return

    // files are sorted ascending (oldest first), so delete from the start
    const toDelete = files.slice(0, files.length - MAX_FILES)
    await Promise.all(
      toDelete.map(f => rm(join(dir, f), { force: true })),
    )
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  private async _flushEntry(entry: LogEntry): Promise<void> {
    if (!this.currentFile) {
      // Not initialized — try to write to a temp file
      if (!this.dir) {
        this.dir = tmpdir()
      }
      const filename = `${LOG_PREFIX}${Date.now()}.log`
      this.currentFile = join(this.dir, filename)
    }

    const line = JSON.stringify(entry) + '\n'
    await appendFile(this.currentFile, line, 'utf8')

    await this._rotateIfNeeded()
  }

  private async _rotateIfNeeded(): Promise<void> {
    if (!this.currentFile || !this.dir) return

    let fileSize = 0
    try {
      const s = await stat(this.currentFile)
      fileSize = s.size
    } catch {
      return
    }

    if (fileSize < MAX_FILE_BYTES) return

    // Rename current file with a unique suffix
    const rotated = this.currentFile.replace(/\.log$/, `-${Date.now()}.rotated.log`)
    try {
      await rename(this.currentFile, rotated)
    } catch {
      // ignore rename failure
    }

    // Start a new current file
    const filename = `${LOG_PREFIX}${Date.now()}.log`
    this.currentFile = join(this.dir, filename)

    await this.prune()
  }

  private async _listLogFiles(dir: string): Promise<string[]> {
    const entries = await readdir(dir)
    return entries
      .filter(f => f.startsWith(LOG_PREFIX) && f.endsWith('.log'))
      .sort()  // lexicographic = chronological for timestamp-named files
  }

  private async _resolveDir(): Promise<string> {
    if (this.dir) return this.dir

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { app } = require('electron') as { app: { getPath(name: string): string } }
      this.dir = join(app.getPath('userData'), 'diagnostic-logs')
    } catch {
      // Fallback for test environments
      this.dir = join(tmpdir(), 'mixpilot-diagnostic-logs')
    }

    return this.dir
  }
}

// ─── Module singleton ─────────────────────────────────────────────────────────

let _instance: DiagnosticLogger | null = null

export function getDiagnosticLogger(): DiagnosticLogger {
  if (!_instance) {
    _instance = new DiagnosticLogger()
  }
  return _instance
}

/** Reset singleton — for tests only */
export function _resetLogger(): void {
  _instance = null
}

// ─── IPC Registration ─────────────────────────────────────────────────────────

export function registerDiagnosticIPC(
  ipcMain: IpcMain,
  logger: DiagnosticLogger,
): void {
  ipcMain.handle('diagnostic:log', async (
    _event,
    level: string,
    category: string,
    msg: string,
    data?: unknown,
  ) => {
    await logger.log(level as LogLevel, category, msg, data)
  })

  ipcMain.handle('diagnostic:read', async (_event, maxLines?: number) => {
    return logger.readAll(maxLines)
  })

  ipcMain.handle('diagnostic:generate-report', async () => {
    return logger.generateReport()
  })

  ipcMain.handle('diagnostic:clear', async () => {
    await logger.clearLogs()
  })
}
