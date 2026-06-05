// ─── Persistent crash / error log ─────────────────────────────────────────────
// Append-only JSONL file at {userData}/logs/crash.log
// Rotates once (crash.log → crash.log.old) when the active file exceeds 5 MB.
//
// Designed to be crash-safe: all file ops are async (fs/promises) and failures
// are swallowed via console.error — logging must never crash the host process.

import { app, type IpcMain } from 'electron'
import { promises as fs } from 'fs'
import { join, dirname } from 'path'

export type CrashSource = 'main' | 'renderer' | 'plugin' | 'audio' | 'stability'

export interface CrashEntry {
  timestamp:  string
  appVersion: string
  platform:   NodeJS.Platform
  source:     CrashSource
  message:    string
  stack?:     string
  meta?:      Record<string, unknown>
}

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

function logsDir(): string {
  return join(app.getPath('userData'), 'logs')
}

function logPath(): string {
  return join(logsDir(), 'crash.log')
}

function oldPath(): string {
  return join(logsDir(), 'crash.log.old')
}

async function ensureDir(): Promise<void> {
  try {
    await fs.mkdir(logsDir(), { recursive: true })
  } catch (e) {
    console.error('[errorReporter] mkdir failed:', e)
  }
}

async function rotateIfNeeded(): Promise<void> {
  try {
    const stat = await fs.stat(logPath())
    if (stat.size > MAX_BYTES) {
      // Single-rotation: overwrite any prior .old
      await fs.rename(logPath(), oldPath()).catch(async () => {
        // Fall back: copy+truncate if rename fails (cross-device etc.)
        try {
          const data = await fs.readFile(logPath())
          await fs.writeFile(oldPath(), data)
          await fs.truncate(logPath(), 0)
        } catch (e) {
          console.error('[errorReporter] rotation fallback failed:', e)
        }
      })
    }
  } catch {
    // File doesn't exist yet — nothing to rotate
  }
}

export async function logCrash(input: {
  source:  CrashSource
  message: string
  stack?:  string
  meta?:   Record<string, unknown>
}): Promise<void> {
  try {
    await ensureDir()
    await rotateIfNeeded()

    const entry: CrashEntry = {
      timestamp:  new Date().toISOString(),
      appVersion: safeAppVersion(),
      platform:   process.platform,
      source:     input.source,
      message:    input.message,
      ...(input.stack ? { stack: input.stack } : {}),
      ...(input.meta  ? { meta:  input.meta  } : {}),
    }

    await fs.appendFile(logPath(), JSON.stringify(entry) + '\n', 'utf8')
  } catch (e) {
    console.error('[errorReporter] logCrash failed:', e)
  }
}

export async function readRecentCrashes(limit = 50): Promise<CrashEntry[]> {
  try {
    const raw = await fs.readFile(logPath(), 'utf8').catch(() => '')
    if (!raw) return []
    const lines = raw.split('\n').filter(Boolean)
    const tail  = lines.slice(-Math.max(1, limit))
    const out: CrashEntry[] = []
    for (const line of tail) {
      try {
        out.push(JSON.parse(line) as CrashEntry)
      } catch {
        // Skip malformed line
      }
    }
    return out
  } catch (e) {
    console.error('[errorReporter] readRecentCrashes failed:', e)
    return []
  }
}

function safeAppVersion(): string {
  try {
    return app.getVersion()
  } catch {
    return 'unknown'
  }
}

// Silence unused-import warning when only types from `path` would be needed.
void dirname

// ─── IPC ─────────────────────────────────────────────────────────────────────

interface CrashReportPayload {
  source?:  CrashSource
  message?: string
  stack?:   string
  meta?:    Record<string, unknown>
}

export function registerCrashIPC(ipcMain: IpcMain): void {
  ipcMain.handle('crash:report', async (_e, payload: CrashReportPayload) => {
    const src: CrashSource = (payload?.source && ['main','renderer','plugin','audio','stability'].includes(payload.source))
      ? payload.source as CrashSource
      : 'renderer'
    await logCrash({
      source:  src,
      message: typeof payload?.message === 'string' ? payload.message : 'unknown',
      stack:   typeof payload?.stack === 'string' ? payload.stack : undefined,
      meta:    payload?.meta && typeof payload.meta === 'object' ? payload.meta : undefined,
    })
    return { ok: true }
  })

  ipcMain.handle('crash:list', async (_e, limit?: number) => {
    const n = typeof limit === 'number' && limit > 0 ? Math.floor(limit) : 50
    return readRecentCrashes(n)
  })
}
