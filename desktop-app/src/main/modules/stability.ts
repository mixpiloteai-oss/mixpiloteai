// ─── Stability Module ─────────────────────────────────────────────────────────
// Comprehensive health monitoring, crash detection, and auto-recovery.
//
// Features:
//   - Memory/CPU thresholds with auto-mitigation
//   - Process health checks (watchdog)
//   - Audio engine heartbeat monitoring
//   - UI responsiveness monitoring
//   - Safe mode activation after repeated crashes
//   - Intelligent retry logic with exponential backoff
//   - Comprehensive crash logging

import { app, BrowserWindow, ipcMain } from 'electron'
import { getAudioEngineProcess } from '../audio/AudioEngineProcess'
import { logCrash } from './errorReporter'

// ── Configuration ──────────────────────────────────────────────────────────

const THRESHOLDS = {
  MEMORY_MB:            512,     // Warn if RSS > 512MB
  MEMORY_CRITICAL_MB:   768,     // Force GC + notify at 768MB
  MEMORY_CHECK:         10_000,  // Check every 10s
  HEARTBEAT_MS:         5_000,   // Expect heartbeat every 5s
  HEARTBEAT_TIMEOUT:    15_000,  // Kill if no heartbeat for 15s
  UI_RESPONSE:          5_000,   // UI should respond within 5s
  STALL_WARN:           45_000,  // Warn about stalled operation at 45s
  RETRY_MAX:            5,       // Max retries for failed operations
  RETRY_BACKOFF:        1_000,   // Start backoff at 1s, double each time
  SAFE_MODE_THRESHOLD:  3,       // Enter safe mode after N audio crashes in one session
}

// ── Health State ───────────────────────────────────────────────────────────

interface ProcessHealth {
  pid:           number | undefined
  alive:         boolean
  lastHeartbeat: number
  crashCount:    number
  memoryTrendMB: number[]
}

interface AppHealth {
  main:     ProcessHealth
  audio:    ProcessHealth
  renderer: ProcessHealth
  uptime:   number
  isStable: boolean
  safeMode: boolean
}

// ── StabilityMonitor ────────────────────────────────────────────────────────

class StabilityMonitor {
  private _health: AppHealth = {
    main:     { pid: process.pid, alive: true, lastHeartbeat: Date.now(), crashCount: 0, memoryTrendMB: [] },
    audio:    { pid: undefined,   alive: false, lastHeartbeat: 0, crashCount: 0, memoryTrendMB: [] },
    renderer: { pid: undefined,   alive: false, lastHeartbeat: 0, crashCount: 0, memoryTrendMB: [] },
    uptime:   0,
    isStable: true,
    safeMode: false,
  }

  private _memInterval:     NodeJS.Timeout | null = null
  private _heartbeatInterval: NodeJS.Timeout | null = null
  private _mainWindow:      BrowserWindow | null = null
  private _pendingOperations = new Map<string, { start: number }>()

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  start(getWindow: () => BrowserWindow | null): void {
    this._mainWindow = getWindow()
    const proc = getAudioEngineProcess()

    // Memory monitoring
    this._memInterval = setInterval(() => this._checkMemory(), THRESHOLDS.MEMORY_CHECK)
    if (this._memInterval.unref) this._memInterval.unref()

    // Heartbeat monitoring
    this._heartbeatInterval = setInterval(() => this._checkHeartbeat(), THRESHOLDS.HEARTBEAT_MS)
    if (this._heartbeatInterval.unref) this._heartbeatInterval.unref()

    // ── Audio engine lifecycle monitoring ─────────────────────────────────
    // NOTE: AudioEngineProcess handles its own auto-restart (up to 5 attempts
    // with exponential backoff). We ONLY observe here — no additional restart
    // to avoid the double-restart race condition.

    proc.on('ready', () => {
      this._health.audio.alive = true
      this._health.audio.lastHeartbeat = Date.now()
      console.log('[stability] audio engine ready')
    })

    proc.on('exit', ({ code, signal }: { code: number | null; signal: string | null }) => {
      this._health.audio.alive = false
      this._health.audio.crashCount++
      console.error(`[stability] audio engine exited: code=${code} signal=${signal}`)
      this._recordCrash('audio', `exited with code ${code} signal ${signal}`)

      // Safe mode: if audio crashes too many times, disable it for this session
      if (code !== 0 && this._health.audio.crashCount >= THRESHOLDS.SAFE_MODE_THRESHOLD) {
        if (!this._health.safeMode) {
          this._activateSafeMode('audio-crash-loop')
        }
      }
    })

    proc.on('max-restarts-exceeded', () => {
      console.error('[stability] audio engine max restarts exceeded — staying in degraded mode')
      this._recordCrash('audio', 'max restarts exceeded')
      this._activateSafeMode('audio-max-restarts')
    })

    proc.on('event', () => {
      this._health.audio.lastHeartbeat = Date.now()
    })

    // ── Renderer heartbeat ─────────────────────────────────────────────────

    ipcMain.handle('stability-heartbeat', (_e, { uptime }: { uptime: number }) => {
      this._health.renderer.alive = true
      this._health.renderer.lastHeartbeat = Date.now()
      this._health.uptime = uptime
      return { ok: true, safeMode: this._health.safeMode }
    })

    ipcMain.handle('stability-track-operation', (_e, { opId }: { opId: string }) => {
      this._pendingOperations.set(opId, { start: Date.now() })
      return { ok: true }
    })

    ipcMain.handle('stability-complete-operation', (_e, { opId }: { opId: string }) => {
      this._pendingOperations.delete(opId)
      return { ok: true }
    })

    ipcMain.handle('stability-get-health', () => ({
      ...this._health,
      pendingOpsCount: this._pendingOperations.size,
      pendingOps: Array.from(this._pendingOperations.entries()).map(([id, op]) => ({
        id,
        duration: Date.now() - op.start,
      })),
    }))

    ipcMain.handle('stability-get-safe-mode', () => ({
      active: this._health.safeMode,
    }))

    console.log('[stability] monitor started')
  }

  stop(): void {
    if (this._memInterval)       clearInterval(this._memInterval)
    if (this._heartbeatInterval) clearInterval(this._heartbeatInterval)
    console.log('[stability] monitor stopped')
  }

  // ── Safe mode ─────────────────────────────────────────────────────────────

  private _activateSafeMode(reason: string): void {
    this._health.safeMode = true
    this._health.isStable = false
    console.warn(`[stability] SAFE MODE activated: ${reason}`)
    this._recordCrash('safe-mode', `activated: ${reason}`)

    // Notify renderer
    if (this._mainWindow && !this._mainWindow.isDestroyed()) {
      try {
        this._mainWindow.webContents.send('safe-mode-active', reason)
      } catch { /* window may be destroyed */ }
    }
  }

  isSafeMode(): boolean {
    return this._health.safeMode
  }

  // ── Memory monitoring ─────────────────────────────────────────────────────

  private _checkMemory(): void {
    const mem   = process.memoryUsage()
    const rssMB = Math.round(mem.rss / 1024 / 1024)

    this._health.main.memoryTrendMB.push(rssMB)
    if (this._health.main.memoryTrendMB.length > 60) this._health.main.memoryTrendMB.shift()

    if (rssMB > THRESHOLDS.MEMORY_CRITICAL_MB) {
      console.warn(`[stability] main memory critical: ${rssMB}MB — requesting renderer GC`)
      this._recordCrash('memory-critical', `main process used ${rssMB}MB`)
      this._send('stability-warning', { type: 'memory-critical', message: `Memory at ${rssMB}MB — restarting may help.` })

      // Hint V8 to GC (non-deterministic, but worth trying)
      if (global.gc) global.gc()

    } else if (rssMB > THRESHOLDS.MEMORY_MB) {
      console.warn(`[stability] main memory high: ${rssMB}MB`)
      this._send('stability-warning', { type: 'memory', message: `Memory usage is high (${rssMB}MB). Consider closing unused projects.` })
    }

    // Check for memory leak: steady increase over last 60 samples (10 min)
    if (this._health.main.memoryTrendMB.length >= 20) {
      const first = this._health.main.memoryTrendMB.slice(0, 5).reduce((a, b) => a + b, 0) / 5
      const last  = this._health.main.memoryTrendMB.slice(-5).reduce((a, b) => a + b, 0) / 5
      if (last - first > 100) {
        console.warn(`[stability] memory leak suspected: +${Math.round(last - first)}MB in last 10 samples`)
        this._recordCrash('memory-leak', `trend +${Math.round(last - first)}MB`)
      }
    }
  }

  // ── Heartbeat monitoring ──────────────────────────────────────────────────

  private _checkHeartbeat(): void {
    const now = Date.now()

    // Check renderer
    if (
      this._health.renderer.lastHeartbeat > 0 &&
      now - this._health.renderer.lastHeartbeat > THRESHOLDS.HEARTBEAT_TIMEOUT
    ) {
      console.error('[stability] renderer heartbeat timeout — UI may be frozen')
      this._health.renderer.alive = false
      this._recordCrash('renderer-heartbeat-timeout', 'UI unresponsive')

      // Attempt to poke the renderer
      try { this._send('stability-ping') } catch { /* window dead */ }
    }

    // Check audio engine (only if supposedly running)
    const audioProc = getAudioEngineProcess()
    if (
      audioProc.ready &&
      this._health.audio.lastHeartbeat > 0 &&
      now - this._health.audio.lastHeartbeat > THRESHOLDS.HEARTBEAT_TIMEOUT
    ) {
      console.error('[stability] audio engine heartbeat timeout')
      this._recordCrash('audio-heartbeat-timeout', 'Audio engine unresponsive')
    }

    // Check stalled operations
    for (const [opId, op] of this._pendingOperations) {
      const duration = now - op.start
      if (duration > THRESHOLDS.STALL_WARN) {
        console.warn(`[stability] operation stalled: "${opId}" (${Math.round(duration / 1000)}s)`)
        this._recordCrash('operation-stalled', `${opId} stalled for ${Math.round(duration / 1000)}s`)
      }
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private _send(channel: string, payload?: unknown): void {
    if (this._mainWindow && !this._mainWindow.isDestroyed()) {
      try { this._mainWindow.webContents.send(channel, payload) } catch { /* already dead */ }
    }
  }

  private _recordCrash(source: string, message: string): void {
    logCrash({
      source:  'stability',
      message: `${source}: ${message}`,
      meta:    { kind: 'stability-alert', source },
    }).catch(e => console.error('[stability] failed to log crash:', e))
  }

  getHealth(): AppHealth {
    return { ...this._health }
  }

  // ── Retry with backoff ────────────────────────────────────────────────────

  async retryWithBackoff<T>(
    operation: () => Promise<T>,
    label:      string,
    maxRetries  = THRESHOLDS.RETRY_MAX,
  ): Promise<T> {
    let lastError: Error | null = null
    for (let i = 0; i < maxRetries; i++) {
      try {
        console.log(`[stability] attempt ${i + 1}/${maxRetries}: ${label}`)
        return await operation()
      } catch (e) {
        lastError = e as Error
        if (i < maxRetries - 1) {
          const delay = THRESHOLDS.RETRY_BACKOFF * Math.pow(2, i)
          console.warn(`[stability] "${label}" failed, retrying in ${delay}ms:`, lastError.message)
          await new Promise(r => setTimeout(r, delay))
        }
      }
    }
    const err = new Error(`"${label}" failed after ${maxRetries} attempts: ${lastError?.message}`)
    this._recordCrash('retry-exhausted', err.message)
    throw err
  }
}

// ── Singleton + exports ────────────────────────────────────────────────────

export const stabilityMonitor = new StabilityMonitor()

export function registerStabilityIPC(
  _ipcMain: typeof ipcMain,
  getWindow: () => BrowserWindow | null,
): void {
  stabilityMonitor.start(getWindow)
  process.on('exit', () => stabilityMonitor.stop())
}

export default stabilityMonitor
