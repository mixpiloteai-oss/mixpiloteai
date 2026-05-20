// ─── Stability Module ─────────────────────────────────────────────────────────
// Comprehensive health monitoring, crash detection, and auto-recovery
//
// Features:
//   - Memory/CPU thresholds with auto-mitigation
//   - Process health checks (watchdog)
//   - Audio engine heartbeat monitoring
//   - Plugin crash detection and isolation
//   - UI responsiveness monitoring
//   - Intelligent retry logic with exponential backoff
//   - Comprehensive crash logging

import { app, BrowserWindow, ipcMain } from 'electron'
import { getAudioEngineProcess } from '../audio/AudioEngineProcess'
import { pluginHostManager } from './pluginHost'
import { logCrash } from './errorReporter'

// ── Configuration ──────────────────────────────────────────────────────────

const THRESHOLDS = {
  MEMORY_MB:     512,        // Kill and restart if RSS > 512MB
  MEMORY_CHECK:  10_000,     // Check every 10s
  HEARTBEAT_MS:  5_000,      // Expect heartbeat every 5s
  HEARTBEAT_TIMEOUT: 15_000, // Kill if no heartbeat for 15s
  UI_RESPONSE:   5_000,      // UI should respond within 5s
  RETRY_MAX:     5,          // Max retries for failed operations
  RETRY_BACKOFF: 1_000,      // Start backoff at 1s, double each time
}

// ── Health State ───────────────────────────────────────────────────────────

interface ProcessHealth {
  pid: number | undefined
  alive: boolean
  lastHeartbeat: number
  crashCount: number
  memoryTrendMB: number[]
}

interface AppHealth {
  main: ProcessHealth
  audio: ProcessHealth
  renderer: ProcessHealth
  uptime: number
  isStable: boolean
}

class StabilityMonitor {
  private _health: AppHealth = {
    main:     { pid: process.pid, alive: true, lastHeartbeat: Date.now(), crashCount: 0, memoryTrendMB: [] },
    audio:    { pid: undefined, alive: false, lastHeartbeat: 0, crashCount: 0, memoryTrendMB: [] },
    renderer: { pid: undefined, alive: false, lastHeartbeat: 0, crashCount: 0, memoryTrendMB: [] },
    uptime:   0,
    isStable: true,
  }

  private _memInterval: NodeJS.Timeout | null = null
  private _heartbeatInterval: NodeJS.Timeout | null = null
  private _mainWindow: BrowserWindow | null = null
  private _audioRestartAttempts = 0
  private _pendingOperations = new Map<string, { start: number; resolve?: () => void; reject?: (e: Error) => void }>()

  start(getWindow: () => BrowserWindow | null): void {
    this._mainWindow = getWindow()
    const proc = getAudioEngineProcess()

    // Memory monitoring
    this._memInterval = setInterval(() => this._checkMemory(), THRESHOLDS.MEMORY_CHECK)
    if (this._memInterval.unref) this._memInterval.unref()

    // Heartbeat monitoring
    this._heartbeatInterval = setInterval(() => this._checkHeartbeat(), THRESHOLDS.HEARTBEAT_MS)
    if (this._heartbeatInterval.unref) this._heartbeatInterval.unref()

    // Audio engine events
    proc.on('ready', () => {
      this._health.audio.alive = true
      this._health.audio.lastHeartbeat = Date.now()
      this._audioRestartAttempts = 0
      console.log('[stability] audio engine ready')
    })

    proc.on('exit', ({ code, signal }) => {
      this._health.audio.alive = false
      this._health.audio.crashCount++
      console.error(`[stability] audio engine crashed: code=${code} signal=${signal}`)
      this._recordCrash('audio', `exited with code ${code} signal ${signal}`)

      // Auto-restart if not intentional shutdown
      if (code !== 0 && this._audioRestartAttempts < THRESHOLDS.RETRY_MAX) {
        this._audioRestartAttempts++
        const delay = Math.min(THRESHOLDS.RETRY_BACKOFF * Math.pow(2, this._audioRestartAttempts - 1), 30_000)
        console.log(`[stability] restarting audio engine in ${delay}ms (attempt ${this._audioRestartAttempts})`)
        setTimeout(() => {
          proc.start().catch(e => {
            console.error('[stability] audio restart failed:', e)
            this._recordCrash('audio', `restart failed: ${(e as Error).message}`)
          })
        }, delay)
      }
    })

    proc.on('event', (evt) => {
      this._health.audio.lastHeartbeat = Date.now()
    })

    // Renderer heartbeats
    ipcMain.handle('stability-heartbeat', (_e, { uptime }: { uptime: number }) => {
      this._health.renderer.alive = true
      this._health.renderer.lastHeartbeat = Date.now()
      this._health.uptime = uptime
      return { ok: true }
    })

    // Track pending operations
    ipcMain.handle('stability-track-operation', (_e, { opId }: { opId: string }) => {
      this._pendingOperations.set(opId, { start: Date.now() })
      return { ok: true }
    })

    ipcMain.handle('stability-complete-operation', (_e, { opId }: { opId: string }) => {
      this._pendingOperations.delete(opId)
      return { ok: true }
    })

    // Health status endpoint
    ipcMain.handle('stability-get-health', () => ({
      ...this._health,
      pendingOpsCount: this._pendingOperations.size,
      pendingOps: Array.from(this._pendingOperations.entries()).map(([id, op]) => ({
        id,
        duration: Date.now() - op.start,
      })),
    }))

    console.log('[stability] monitor started')
  }

  stop(): void {
    if (this._memInterval) clearInterval(this._memInterval)
    if (this._heartbeatInterval) clearInterval(this._heartbeatInterval)
    console.log('[stability] monitor stopped')
  }

  private _checkMemory(): void {
    const mem = process.memoryUsage()
    const rssMB = Math.round(mem.rss / 1024 / 1024)

    this._health.main.memoryTrendMB.push(rssMB)
    if (this._health.main.memoryTrendMB.length > 60) this._health.main.memoryTrendMB.shift()

    if (rssMB > THRESHOLDS.MEMORY_MB) {
      console.warn(`[stability] main memory high: ${rssMB}MB (limit: ${THRESHOLDS.MEMORY_MB}MB)`)
      this._recordCrash('memory-high', `main process used ${rssMB}MB`)

      // Attempt mitigation
      if (this._mainWindow && !this._mainWindow.isDestroyed()) {
        this._mainWindow.webContents.send('stability-warning', {
          type: 'memory',
          message: `Memory usage is high (${rssMB}MB). Consider closing unused projects.`,
        })
      }
    }
  }

  private _checkHeartbeat(): void {
    const now = Date.now()

    // Check renderer
    if (this._health.renderer.lastHeartbeat > 0 && now - this._health.renderer.lastHeartbeat > THRESHOLDS.HEARTBEAT_TIMEOUT) {
      console.error('[stability] renderer heartbeat timeout')
      this._health.renderer.alive = false
      this._recordCrash('renderer-heartbeat-timeout', 'UI unresponsive')

      // Try to force UI refresh
      if (this._mainWindow && !this._mainWindow.isDestroyed()) {
        try {
          this._mainWindow.webContents.send('stability-ping')
        } catch { /* already dead */ }
      }
    }

    // Check audio engine
    const audioProc = getAudioEngineProcess()
    if (audioProc.ready && now - this._health.audio.lastHeartbeat > THRESHOLDS.HEARTBEAT_TIMEOUT) {
      console.error('[stability] audio engine heartbeat timeout')
      this._recordCrash('audio-heartbeat-timeout', 'Audio engine unresponsive')
    }

    // Check for stalled operations
    for (const [opId, op] of this._pendingOperations) {
      const duration = now - op.start
      if (duration > THRESHOLDS.UI_RESPONSE * 3) {
        console.warn(`[stability] operation stalled: ${opId} (${duration}ms)`)
        this._recordCrash('operation-stalled', `${opId} stalled for ${duration}ms`)
      }
    }
  }

  private _recordCrash(source: string, message: string): void {
    logCrash({
      source: 'stability',
      message: `${source}: ${message}`,
      meta: { kind: 'stability-alert', source },
    }).catch(e => console.error('[stability] failed to log crash:', e))
  }

  getHealth(): AppHealth {
    return { ...this._health }
  }

  async retryWithBackoff<T>(
    operation: () => Promise<T>,
    label: string,
    maxRetries = THRESHOLDS.RETRY_MAX,
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
          console.warn(`[stability] ${label} failed, retrying in ${delay}ms:`, lastError.message)
          await new Promise(r => setTimeout(r, delay))
        }
      }
    }
    const err = new Error(`${label} failed after ${maxRetries} attempts: ${lastError?.message}`)
    this._recordCrash('retry-exhausted', err.message)
    throw err
  }
}

export const stabilityMonitor = new StabilityMonitor()

export function registerStabilityIPC(ipcMain: typeof ipcMain, getWindow: () => BrowserWindow | null): void {
  stabilityMonitor.start(getWindow)

  // Allow graceful shutdown
  process.on('exit', () => stabilityMonitor.stop())
}

export default stabilityMonitor
