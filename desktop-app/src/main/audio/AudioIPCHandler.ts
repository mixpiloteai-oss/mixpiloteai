/**
 * AudioIPCHandler — wires Electron IPC to the native audio engine process
 *
 * Renderer → IPC → AudioIPCHandler → AudioEngineProcess → native engine
 * native engine → AudioEngineProcess → IPC push → renderer window
 *
 * Features:
 *   - All handlers wrapped with error logging + crash reporting
 *   - All handlers have a configurable timeout (default 8s)
 *   - Payload validation on every write-path call
 *   - Watchdog alerts forwarded to renderer
 *   - Export-logs handler for diagnostics
 */

import type { IpcMain, BrowserWindow } from 'electron'
import { getAudioEngineProcess }        from './AudioEngineProcess'
import { getAudioEngineWatchdog }        from './AudioEngineWatchdog'
import { DriverDetector }               from './DriverDetector'
import { logCrash }                     from '../modules/errorReporter'
import type { EngineEvent }             from './AudioEngineProcess'

// ─── IPC timeout ─────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 8_000

function withIpcTimeout<T>(promise: Promise<T>, channel: string, ms = DEFAULT_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      const t = setTimeout(
        () => reject(new Error(`[audio-ipc] Timeout after ${ms}ms on channel: ${channel}`)),
        ms,
      )
      if ((t as NodeJS.Timeout).unref) (t as NodeJS.Timeout).unref()
    }),
  ])
}

// ─── Payload validation ───────────────────────────────────────────────────────

function requireString(val: unknown, name: string): string {
  if (typeof val !== 'string' || val.trim() === '') {
    throw new Error(`[audio-ipc] Validation: ${name} must be a non-empty string`)
  }
  return val
}

function requireNumber(val: unknown, name: string, min?: number, max?: number): number {
  if (typeof val !== 'number' || !isFinite(val)) {
    throw new Error(`[audio-ipc] Validation: ${name} must be a finite number`)
  }
  if (min !== undefined && val < min) throw new Error(`[audio-ipc] ${name} must be >= ${min}`)
  if (max !== undefined && val > max) throw new Error(`[audio-ipc] ${name} must be <= ${max}`)
  return val
}

function requireBoolean(val: unknown, name: string): boolean {
  if (typeof val !== 'boolean') throw new Error(`[audio-ipc] Validation: ${name} must be a boolean`)
  return val
}

function optString(val: unknown, fallback = ''): string {
  return typeof val === 'string' ? val : fallback
}

function optNumber(val: unknown, fallback: number, min?: number, max?: number): number {
  if (typeof val !== 'number' || !isFinite(val)) return fallback
  if (min !== undefined && val < min) return fallback
  if (max !== undefined && val > max) return fallback
  return val
}

// ─── Handler wrapper ──────────────────────────────────────────────────────────

function safeHandle<T extends unknown[], R>(
  ipc:       IpcMain,
  channel:   string,
  fn:        (...args: T) => Promise<R> | R,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): void {
  ipc.handle(channel, async (_event, ...args) => {
    try {
      return await withIpcTimeout(
        Promise.resolve(fn(...(args as T))),
        channel,
        timeoutMs,
      )
    } catch (err) {
      const msg = (err instanceof Error ? err.message : String(err))
      console.error(`[audio-ipc] ${channel} error: ${msg}`)
      await logCrash({
        source:  'audio',
        message: `IPC handler ${channel} failed: ${msg}`,
        stack:   err instanceof Error ? err.stack : undefined,
        meta:    { kind: 'audio-ipc-error', channel },
      }).catch(() => { /* never throw from error handler */ })
      throw err
    }
  })
}

// ─── Send helper ──────────────────────────────────────────────────────────────

function sendToWindow(getWindow: () => BrowserWindow | null, channel: string, data: unknown): void {
  try {
    const win = getWindow()
    if (!win || win.isDestroyed()) return
    win.webContents.send(channel, data)
  } catch (err) {
    console.warn(`[audio-ipc] Failed to send ${channel}:`, err)
  }
}

// ─── Registration ─────────────────────────────────────────────────────────────

export function registerAudioIPCHandlers(ipcMain: IpcMain, getWindow: () => BrowserWindow | null): void {
  const proc     = getAudioEngineProcess()
  const watchdog = getAudioEngineWatchdog()
  const detector = new DriverDetector()

  // ── Forward native engine events to renderer ─────────────────────────

  proc.on('event', (evt: EngineEvent) => {
    sendToWindow(getWindow, 'native-audio-event', evt)
  })

  proc.on('exit', ({ code, signal }) => {
    sendToWindow(getWindow, 'native-audio-event', { event: 'engine_exit', code, signal })
    // Also send a fresh status snapshot so the UI updates immediately
    sendToWindow(getWindow, 'audio-engine-status-update', proc.getStatus())
  })

  proc.on('crash', ({ code, signal, crashCount }: { code: number | null; signal: string | null; crashCount: number }) => {
    console.error(`[audio-ipc] Engine crash #${crashCount} — code=${code} signal=${signal}`)
    sendToWindow(getWindow, 'audio-engine-crash', { code, signal, crashCount, status: proc.getStatus() })
  })

  proc.on('engine-mode', (status) => {
    sendToWindow(getWindow, 'audio-engine-mode', status)
  })

  proc.on('error', (err: Error) => {
    logCrash({
      source:  'audio',
      message: `Engine error: ${err.message}`,
      stack:   err.stack,
      meta:    { kind: 'audio-engine-error' },
    }).catch(() => { /* ignore */ })
    sendToWindow(getWindow, 'native-audio-event', { event: 'engine_error', message: err.message })
  })

  proc.on('max-restarts-exceeded', () => {
    console.error('[audio-ipc] Max restarts exceeded — engine in permanent fallback')
    sendToWindow(getWindow, 'audio-engine-max-restarts', { status: proc.getStatus() })
  })

  // ── Watchdog alerts ──────────────────────────────────────────────────

  watchdog.on('alert', (alert) => {
    console.warn('[audio-ipc] Watchdog alert:', alert.kind, alert.message)
    sendToWindow(getWindow, 'audio-engine-watchdog-alert', alert)
  })

  watchdog.on('metrics', (metrics) => {
    sendToWindow(getWindow, 'audio-engine-metrics', metrics)
  })

  // ── Driver / device detection ────────────────────────────────────────

  safeHandle(ipcMain, 'audio-detect-drivers',   async () => detector.detectDrivers())
  safeHandle(ipcMain, 'audio-detect-devices',   async () => detector.detectDevices())
  safeHandle(ipcMain, 'audio-preferred-driver', ()       => detector.getPreferredDriver())

  // ── Engine lifecycle ─────────────────────────────────────────────────

  safeHandle(ipcMain, 'audio-engine-start', async (opts: Record<string, unknown> = {}) => {
    const driver     = optString(opts.driver,     'default')
    const device     = optString(opts.device,     '')
    const sampleRate = optNumber(opts.sampleRate, 44100, 8000, 192000)
    const bufferSize = optNumber(opts.bufferSize, 512,   64,   4096)
    await proc.start(driver, device, sampleRate, bufferSize)
    return { ok: true, status: proc.getStatus() }
  })

  safeHandle(ipcMain, 'audio-engine-stop', () => {
    proc.stop()
    return { ok: true }
  })

  safeHandle(ipcMain, 'audio-engine-ready', () => proc.ready)

  /**
   * Returns the full engine status — mode, binary, PID, crash count, metrics.
   * Renderer calls this on mount and on reconnect.
   */
  safeHandle(ipcMain, 'audio-engine-status', () => proc.getStatus())

  /**
   * Returns a diagnostic snapshot including OS-level metrics.
   * Slightly heavier than audio-engine-status (may shell out to `ps`).
   */
  safeHandle(ipcMain, 'audio-engine-diagnostics', async () => {
    const status  = proc.getStatus()
    const metrics = status.pid !== null
      ? await watchdog.getProcessMetrics(status.pid)
      : null
    return { status, metrics, timestamp: Date.now() }
  }, 15_000)  // longer timeout — ps may take a moment

  /**
   * Aggregates crash.log + diagnostic snapshots into an exportable bundle.
   * Returns the bundle text; also writes to {userData}/diagnostics/export-*.txt.
   */
  safeHandle(ipcMain, 'audio-engine-export-logs', async () => {
    const bundle   = await watchdog.exportLogs()
    const filePath = watchdog.getLastExportPath()
    return { bundle, filePath }
  }, 30_000)  // allow time for async OS calls

  // ── Transport ────────────────────────────────────────────────────────

  safeHandle(ipcMain, 'audio-play',  () => { proc.play();          return true })
  safeHandle(ipcMain, 'audio-stop',  () => { proc.stopPlayback();  return true })
  safeHandle(ipcMain, 'audio-pause', () => { proc.pause();         return true })

  safeHandle(ipcMain, 'audio-seek', (bar: unknown, beat: unknown) => {
    proc.seek(requireNumber(bar, 'bar', 0), optNumber(beat, 1, 1))
    return true
  })

  safeHandle(ipcMain, 'audio-set-bpm', (bpm: unknown) => {
    proc.setBpm(requireNumber(bpm, 'bpm', 20, 999))
    return true
  })

  safeHandle(ipcMain, 'audio-set-time-sig', (numerator: unknown, denominator: unknown) => {
    proc.setTimeSig(
      requireNumber(numerator,   'numerator',   1, 32),
      requireNumber(denominator, 'denominator', 1, 32),
    )
    return true
  })

  safeHandle(ipcMain, 'audio-set-loop', (enabled: unknown, startBar: unknown, endBar: unknown) => {
    proc.setLoop(
      requireBoolean(enabled,  'enabled'),
      requireNumber(startBar,  'startBar',  0),
      requireNumber(endBar,    'endBar',    0),
    )
    return true
  })

  safeHandle(ipcMain, 'audio-get-state', () => { proc.getState(); return true })

  // ── Master ───────────────────────────────────────────────────────────

  safeHandle(ipcMain, 'audio-set-master-gain', (db: unknown) => {
    proc.setMasterGain(requireNumber(db, 'db', -120, 12))
    return true
  })

  // ── Tracks ───────────────────────────────────────────────────────────

  safeHandle(ipcMain, 'audio-add-track', (id: unknown, type: unknown, name: unknown, color?: unknown) => {
    proc.addTrack(
      requireString(id,   'id'),
      requireString(type, 'type'),
      requireString(name, 'name'),
      typeof color === 'string' ? color : undefined,
    )
    return true
  })

  safeHandle(ipcMain, 'audio-remove-track',   (id: unknown) => { proc.removeTrack(requireString(id, 'id'));               return true })
  safeHandle(ipcMain, 'audio-set-track-gain', (id: unknown, db: unknown) => { proc.setTrackGain(requireString(id, 'id'), requireNumber(db, 'db', -120, 12)); return true })
  safeHandle(ipcMain, 'audio-set-track-pan',  (id: unknown, pan: unknown) => { proc.setTrackPan(requireString(id, 'id'), requireNumber(pan, 'pan', -1, 1));   return true })
  safeHandle(ipcMain, 'audio-mute-track',     (id: unknown, m: unknown)   => { proc.muteTrack(requireString(id, 'id'), requireBoolean(m, 'muted'));           return true })
  safeHandle(ipcMain, 'audio-solo-track',     (id: unknown, s: unknown)   => { proc.soloTrack(requireString(id, 'id'), requireBoolean(s, 'soloed'));          return true })
  safeHandle(ipcMain, 'audio-arm-track',      (id: unknown, a: unknown)   => { proc.armTrack(requireString(id, 'id'), requireBoolean(a, 'armed'));            return true })

  // ── Routing ──────────────────────────────────────────────────────────

  safeHandle(ipcMain, 'audio-add-send', (fromId: unknown, toId: unknown, gainDb: unknown, preFader: unknown) => {
    proc.addSend(
      requireString(fromId,   'fromId'),
      requireString(toId,     'toId'),
      requireNumber(gainDb,   'gainDb', -120, 12),
      requireBoolean(preFader, 'preFader'),
    )
    return true
  })

  // ── Driver settings ──────────────────────────────────────────────────

  safeHandle(ipcMain, 'audio-set-driver', (driver: unknown, device: unknown) => {
    proc.setDriver(requireString(driver, 'driver'), optString(device))
    return true
  })

  safeHandle(ipcMain, 'audio-set-buffer-size', (frames: unknown) => {
    proc.setBufferSize(requireNumber(frames, 'frames', 64, 4096))
    return true
  })

  safeHandle(ipcMain, 'audio-set-sample-rate', (rate: unknown) => {
    proc.setSampleRate(requireNumber(rate, 'rate', 8000, 192000))
    return true
  })

  safeHandle(ipcMain, 'audio-query-devices', () => { proc.queryDevices(); return true })
}
