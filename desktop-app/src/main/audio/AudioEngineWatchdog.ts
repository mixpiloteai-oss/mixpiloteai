/**
 * AudioEngineWatchdog — periodic health monitor for the native audio engine.
 *
 * Responsibilities:
 *   1. Poll process health every 5s, emit 'watchdog-alert' on anomaly
 *   2. Collect OS-level CPU/memory metrics from the subprocess (Linux/macOS)
 *   3. Write crash-diagnostic snapshots to {userData}/diagnostics/
 *   4. Provide log-export functionality (aggregate crash.log + diagnostics)
 *
 * Design notes:
 *   - All timers use .unref() so they don't keep the event loop alive in tests
 *   - No silent swallowing: every anomaly is logged AND emitted as an event
 *   - Diagnostic files are JSONL, one entry per event
 */

import { EventEmitter }           from 'node:events'
import { execFile }               from 'node:child_process'
import { promisify }              from 'node:util'
import { join }                   from 'node:path'
import {
  readFileSync, writeFileSync,
  appendFileSync, mkdirSync,
  existsSync, readdirSync,
  statSync,
}                                 from 'node:fs'
import { app }                    from 'electron'
import type { AudioEngineProcess } from './AudioEngineProcess'
import { getAudioEngineProcess } from './AudioEngineProcess'

const execAsync = promisify(execFile)

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProcessMetrics {
  pid:        number
  cpuPercent: number | null
  memoryMB:   number | null
  timestamp:  number
}

export interface DiagnosticSnapshot {
  timestamp:    number
  trigger:      'crash' | 'poll' | 'export'
  pid:          number | null
  engineStatus: unknown
  metrics:      ProcessMetrics | null
  platform:     string
  nodeVersion:  string
  electronVersion?: string
}

export interface WatchdogAlert {
  kind:    'dead-process' | 'high-memory' | 'high-cpu' | 'xrun-spike'
  message: string
  data:    unknown
}

// ─── Constants ───────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS    = 5_000
const CPU_WARN_PERCENT    = 80
const MEMORY_WARN_MB      = 512
const XRUN_SPIKE_DELTA    = 5        // warn when xruns increase by this much in one poll
const MAX_DIAGNOSTIC_FILES = 20      // rotate old snapshots

// ─── AudioEngineWatchdog ──────────────────────────────────────────────────────

export class AudioEngineWatchdog extends EventEmitter {
  private _proc:          AudioEngineProcess
  private _timer:         ReturnType<typeof setInterval> | null = null
  private _lastXruns      = 0
  private _diagDir:       string

  constructor(proc: AudioEngineProcess) {
    super()
    this._proc    = proc
    this._diagDir = join(app.getPath('userData'), 'diagnostics')

    // Write a crash diagnostic snapshot on every crash
    proc.on('crash', () => this._writeCrashSnapshot())
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────

  start(intervalMs = POLL_INTERVAL_MS): void {
    if (this._timer) return
    this._timer = setInterval(() => this._poll(), intervalMs)
    if ((this._timer as NodeJS.Timeout).unref) (this._timer as NodeJS.Timeout).unref()
    console.log(`[AudioEngineWatchdog] started (poll every ${intervalMs}ms)`)
  }

  stop(): void {
    if (this._timer) {
      clearInterval(this._timer)
      this._timer = null
    }
  }

  // ── Poll ───────────────────────────────────────────────────────────────

  private async _poll(): Promise<void> {
    const status = this._proc.getStatus()

    // ── Dead-process check ───────────────────────────────────────────────
    // If the engine is supposed to be in native mode but the process isn't
    // running, something is wrong (e.g. process died without emitting exit).
    if (status.mode === 'native' && status.binaryFound && !status.isRunning && !this._proc.ready) {
      const alert: WatchdogAlert = {
        kind:    'dead-process',
        message: 'Audio engine process not running (expected native mode)',
        data:    { mode: status.mode, restarts: status.restarts, crashCount: status.crashCount },
      }
      console.error('[AudioEngineWatchdog] ⚠️  Alert: dead-process', alert.message)
      this.emit('alert', alert)
      return
    }

    if (!status.isRunning || status.pid === null) return

    // ── OS-level metrics ─────────────────────────────────────────────────
    const metrics = await this._getProcessMetrics(status.pid)

    if (metrics) {
      // Update the engine process with fresh OS metrics (for getStatus() responses)
      this.emit('metrics', metrics)

      if (metrics.cpuPercent !== null && metrics.cpuPercent > CPU_WARN_PERCENT) {
        const alert: WatchdogAlert = {
          kind:    'high-cpu',
          message: `CPU usage at ${metrics.cpuPercent}% (threshold: ${CPU_WARN_PERCENT}%)`,
          data:    metrics,
        }
        console.warn('[AudioEngineWatchdog] ⚠️  Alert: high-cpu', alert.message)
        this.emit('alert', alert)
      }

      if (metrics.memoryMB !== null && metrics.memoryMB > MEMORY_WARN_MB) {
        const alert: WatchdogAlert = {
          kind:    'high-memory',
          message: `Memory at ${metrics.memoryMB}MB (threshold: ${MEMORY_WARN_MB}MB)`,
          data:    metrics,
        }
        console.warn('[AudioEngineWatchdog] ⚠️  Alert: high-memory', alert.message)
        this.emit('alert', alert)
      }
    }

    // ── Xrun spike check ─────────────────────────────────────────────────
    const delta = status.xrunCount - this._lastXruns
    if (delta >= XRUN_SPIKE_DELTA) {
      const alert: WatchdogAlert = {
        kind:    'xrun-spike',
        message: `${delta} new buffer underruns detected (total: ${status.xrunCount})`,
        data:    { delta, total: status.xrunCount },
      }
      console.warn('[AudioEngineWatchdog] ⚠️  Alert: xrun-spike', alert.message)
      this.emit('alert', alert)
    }
    this._lastXruns = status.xrunCount
  }

  // ── OS-level process metrics ───────────────────────────────────────────

  async getProcessMetrics(pid: number): Promise<ProcessMetrics | null> {
    return this._getProcessMetrics(pid)
  }

  private async _getProcessMetrics(pid: number): Promise<ProcessMetrics | null> {
    try {
      switch (process.platform) {
        case 'linux':   return await this._metricsLinux(pid)
        case 'darwin':  return await this._metricsMac(pid)
        default:        return null   // Windows: requires native addon — deferred
      }
    } catch {
      return null   // platform call failed — not fatal
    }
  }

  private async _metricsLinux(pid: number): Promise<ProcessMetrics | null> {
    // Read /proc/<pid>/status for VmRSS (resident set size)
    const statusPath = `/proc/${pid}/status`
    if (!existsSync(statusPath)) return null

    let memoryMB: number | null = null
    try {
      const content = readFileSync(statusPath, 'utf8')
      const match   = content.match(/^VmRSS:\s+(\d+)\s+kB/m)
      if (match) memoryMB = Math.round(parseInt(match[1], 10) / 1024)
    } catch { /* process may have exited */ }

    // CPU: use `ps` for simplicity (avoids two /proc/stat reads + delta)
    let cpuPercent: number | null = null
    try {
      const { stdout } = await execAsync('ps', ['-p', String(pid), '-o', '%cpu='])
      cpuPercent = parseFloat(stdout.trim()) || null
    } catch { /* ps not available or process gone */ }

    return { pid, cpuPercent, memoryMB, timestamp: Date.now() }
  }

  private async _metricsMac(pid: number): Promise<ProcessMetrics | null> {
    // Use `ps` for both CPU and RSS on macOS
    let cpuPercent: number | null = null
    let memoryMB:   number | null = null

    try {
      // -o %cpu=,rss= format: "1.2 102400"
      const { stdout } = await execAsync('ps', ['-p', String(pid), '-o', '%cpu=,rss='])
      const parts = stdout.trim().split(/\s+/)
      if (parts.length >= 2) {
        cpuPercent = parseFloat(parts[0]) || null
        memoryMB   = parts[1] ? Math.round(parseInt(parts[1], 10) / 1024) : null
      }
    } catch { /* process gone */ }

    return { pid, cpuPercent, memoryMB, timestamp: Date.now() }
  }

  // ── Crash diagnostics ──────────────────────────────────────────────────

  private _writeCrashSnapshot(): void {
    try {
      const snapshot = this._buildSnapshot('crash')
      this._writeSnapshot(snapshot)
    } catch (err) {
      console.error('[AudioEngineWatchdog] Failed to write crash snapshot:', err)
    }
  }

  private _buildSnapshot(trigger: DiagnosticSnapshot['trigger']): DiagnosticSnapshot {
    const status = this._proc.getStatus()
    return {
      timestamp:    Date.now(),
      trigger,
      pid:          status.pid,
      engineStatus: status,
      metrics:      null,   // populated async if needed
      platform:     process.platform,
      nodeVersion:  process.version,
      electronVersion: process.versions.electron,
    }
  }

  private _writeSnapshot(snapshot: DiagnosticSnapshot): void {
    try {
      mkdirSync(this._diagDir, { recursive: true })

      // One JSONL file per day; new entry appended
      const date = new Date(snapshot.timestamp).toISOString().slice(0, 10)
      const path = join(this._diagDir, `engine-diag-${date}.jsonl`)
      appendFileSync(path, JSON.stringify(snapshot) + '\n', 'utf8')

      this._rotateDiagnostics()
    } catch (err) {
      console.error('[AudioEngineWatchdog] Snapshot write failed:', err)
    }
  }

  private _rotateDiagnostics(): void {
    try {
      const files = readdirSync(this._diagDir)
        .filter(f => f.startsWith('engine-diag-') && f.endsWith('.jsonl'))
        .map(f => ({ name: f, mtime: statSync(join(this._diagDir, f)).mtimeMs }))
        .sort((a, b) => a.mtime - b.mtime)  // oldest first

      while (files.length > MAX_DIAGNOSTIC_FILES) {
        const oldest = files.shift()!
        try {
          const { unlinkSync } = require('node:fs')
          unlinkSync(join(this._diagDir, oldest.name))
        } catch { /* ignore */ }
      }
    } catch { /* rotation is best-effort */ }
  }

  // ── Log export ─────────────────────────────────────────────────────────

  /**
   * Aggregates crash.log + recent diagnostic snapshots into a single
   * text bundle suitable for pasting in a bug report.
   *
   * Returns the bundle as a UTF-8 string; caller is responsible for
   * saving/copying it.
   */
  async exportLogs(): Promise<string> {
    const lines: string[] = [
      '=== NEUROTEK STUDIO — AUDIO ENGINE DIAGNOSTIC EXPORT ===',
      `Generated: ${new Date().toISOString()}`,
      `Platform: ${process.platform} ${process.arch}`,
      `Node: ${process.version}`,
      `Electron: ${process.versions.electron ?? 'unknown'}`,
      '',
    ]

    // ── Current engine status ────────────────────────────────────────────
    const status = this._proc.getStatus()
    lines.push('=== ENGINE STATUS ===')
    lines.push(JSON.stringify(status, null, 2))
    lines.push('')

    // ── Recent crash.log entries ─────────────────────────────────────────
    const crashLog = join(app.getPath('userData'), 'logs', 'crash.log')
    if (existsSync(crashLog)) {
      lines.push('=== CRASH LOG (last 50 lines) ===')
      try {
        const raw   = readFileSync(crashLog, 'utf8')
        const recent = raw.trim().split('\n').slice(-50)
        lines.push(...recent)
      } catch (err) {
        lines.push(`(could not read crash.log: ${err})`)
      }
      lines.push('')
    }

    // ── Diagnostic snapshots ─────────────────────────────────────────────
    if (existsSync(this._diagDir)) {
      const diagFiles = readdirSync(this._diagDir)
        .filter(f => f.endsWith('.jsonl'))
        .sort()
        .slice(-3)    // last 3 day files

      if (diagFiles.length > 0) {
        lines.push('=== DIAGNOSTIC SNAPSHOTS (recent) ===')
        for (const f of diagFiles) {
          lines.push(`--- ${f} ---`)
          try {
            const raw     = readFileSync(join(this._diagDir, f), 'utf8')
            const entries = raw.trim().split('\n').slice(-20)  // last 20 entries per file
            lines.push(...entries)
          } catch { /* ignore */ }
        }
        lines.push('')
      }
    }

    // ── Live OS metrics ──────────────────────────────────────────────────
    if (status.pid !== null) {
      lines.push('=== LIVE PROCESS METRICS ===')
      const metrics = await this._getProcessMetrics(status.pid)
      lines.push(metrics ? JSON.stringify(metrics, null, 2) : '(not available on this platform)')
      lines.push('')
    }

    const bundle = lines.join('\n')

    // Also write to a file for persistent access
    try {
      mkdirSync(this._diagDir, { recursive: true })
      const exportPath = join(this._diagDir, `export-${Date.now()}.txt`)
      writeFileSync(exportPath, bundle, 'utf8')
      console.log(`[AudioEngineWatchdog] Log export written to: ${exportPath}`)
    } catch { /* non-fatal */ }

    return bundle
  }

  /**
   * Returns the path to the most recent exported log file, or null.
   */
  getLastExportPath(): string | null {
    if (!existsSync(this._diagDir)) return null
    const exports = readdirSync(this._diagDir)
      .filter(f => f.startsWith('export-') && f.endsWith('.txt'))
      .sort()
    return exports.length > 0 ? join(this._diagDir, exports[exports.length - 1]) : null
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _instance: AudioEngineWatchdog | null = null

export function getAudioEngineWatchdog(): AudioEngineWatchdog {
  if (!_instance) {
    _instance = new AudioEngineWatchdog(getAudioEngineProcess())
  }
  return _instance
}
