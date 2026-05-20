/**
 * AudioIPCHandler — wires Electron IPC to the native audio engine process
 *
 * Renderer → IPC → AudioIPCHandler → AudioEngineProcess → native engine
 * native engine → AudioEngineProcess → IPC push → renderer window
 *
 * All handlers include error reporting and graceful degradation.
 */

import type { IpcMain, BrowserWindow } from 'electron'
import { getAudioEngineProcess }        from './AudioEngineProcess'
import { DriverDetector }               from './DriverDetector'
import { logCrash }                     from '../modules/errorReporter'
import type { EngineEvent }             from './AudioEngineProcess'

// ── Helper: wrap handlers with error logging ────────────────────────────────

function safeHandle<T extends any[], R>(
  ipc: typeof ipcMain,
  channel: string,
  fn: (...args: T) => Promise<R> | R,
): void {
  ipc.handle(channel, async (e, ...args) => {
    try {
      return await fn(...(args as T))
    } catch (err) {
      console.error(`[audio-ipc] ${channel} error:`, err)
      await logCrash({
        source: 'audio',
        message: `IPC handler ${channel} failed: ${(err as Error).message}`,
        stack: (err as Error).stack,
        meta: { kind: 'audio-ipc-error', channel },
      }).catch(() => { /* ignore */ })
      throw err
    }
  })
}

export function registerAudioIPCHandlers(ipcMain: IpcMain, getWindow: () => BrowserWindow | null): void {
  const proc     = getAudioEngineProcess()
  const detector = new DriverDetector()

  // ── Forward native engine events to renderer ─────────────────────────────

  proc.on('event', (evt: EngineEvent) => {
    try {
      const win = getWindow()
      if (!win || win.isDestroyed()) return
      win.webContents.send('native-audio-event', evt)
    } catch (err) {
      console.warn('[audio-ipc] failed to send event:', err)
    }
  })

  proc.on('exit', ({ code, signal }) => {
    try {
      const win = getWindow()
      if (win && !win.isDestroyed()) {
        win.webContents.send('native-audio-event', {
          event: 'engine_exit', code, signal,
        })
      }
    } catch { /* already dead */ }
  })

  proc.on('error', (err: Error) => {
    console.error('[audio-ipc] engine error:', err.message)
    logCrash({
      source: 'audio',
      message: `Engine error: ${err.message}`,
      stack: err.stack,
      meta: { kind: 'audio-engine-error' },
    }).catch(() => { /* ignore */ })
  })

  // ── Driver / device detection ─────────────────────────────────────────────

  safeHandle(ipcMain, 'audio-detect-drivers', async () => detector.detectDrivers())
  safeHandle(ipcMain, 'audio-detect-devices', async () => detector.detectDevices())
  safeHandle(ipcMain, 'audio-preferred-driver', () => detector.getPreferredDriver())

  // ── Engine lifecycle ──────────────────────────────────────────────────────

  safeHandle(ipcMain, 'audio-engine-start', async (opts: {
    driver?: string; device?: string; sampleRate?: number; bufferSize?: number
  } = {}) => {
    await proc.start(opts.driver, opts.device, opts.sampleRate, opts.bufferSize)
    return { ok: true }
  })

  safeHandle(ipcMain, 'audio-engine-stop', () => {
    proc.stop()
    return { ok: true }
  })

  safeHandle(ipcMain, 'audio-engine-ready', () => proc.ready)

  // ── Transport ─────────────────────────────────────────────────────────────

  safeHandle(ipcMain, 'audio-play', () => { proc.play(); return true })
  safeHandle(ipcMain, 'audio-stop', () => { proc.stopPlayback(); return true })
  safeHandle(ipcMain, 'audio-pause', () => { proc.pause(); return true })

  safeHandle(ipcMain, 'audio-seek', (bar: number, beat = 1) => {
    proc.seek(bar, beat); return true
  })

  safeHandle(ipcMain, 'audio-set-bpm', (bpm: number) => {
    proc.setBpm(bpm); return true
  })

  safeHandle(ipcMain, 'audio-set-time-sig', (numerator: number, denominator: number) => {
    proc.setTimeSig(numerator, denominator); return true
  })

  safeHandle(ipcMain, 'audio-set-loop', (enabled: boolean, startBar: number, endBar: number) => {
    proc.setLoop(enabled, startBar, endBar); return true
  })

  safeHandle(ipcMain, 'audio-get-state', () => {
    proc.getState(); return true
  })

  // ── Master ────────────────────────────────────────────────────────────────

  safeHandle(ipcMain, 'audio-set-master-gain', (db: number) => {
    proc.setMasterGain(db); return true
  })

  // ── Tracks ────────────────────────────────────────────────────────────────

  safeHandle(ipcMain, 'audio-add-track', (id: string, type: string, name: string, color?: string) => {
    proc.addTrack(id, type, name, color); return true
  })

  safeHandle(ipcMain, 'audio-remove-track', (id: string) => {
    proc.removeTrack(id); return true
  })

  safeHandle(ipcMain, 'audio-set-track-gain', (id: string, db: number) => {
    proc.setTrackGain(id, db); return true
  })

  safeHandle(ipcMain, 'audio-set-track-pan', (id: string, pan: number) => {
    proc.setTrackPan(id, pan); return true
  })

  safeHandle(ipcMain, 'audio-mute-track', (id: string, muted: boolean) => {
    proc.muteTrack(id, muted); return true
  })

  safeHandle(ipcMain, 'audio-solo-track', (id: string, soloed: boolean) => {
    proc.soloTrack(id, soloed); return true
  })

  safeHandle(ipcMain, 'audio-arm-track', (id: string, armed: boolean) => {
    proc.armTrack(id, armed); return true
  })

  // ── Routing / sends ───────────────────────────────────────────────────────

  safeHandle(ipcMain, 'audio-add-send', (fromId: string, toId: string, gainDb: number, preFader: boolean) => {
    proc.addSend(fromId, toId, gainDb, preFader); return true
  })

  // ── Driver settings ───────────────────────────────────────────────────────

  safeHandle(ipcMain, 'audio-set-driver', (driver: string, device: string) => {
    proc.setDriver(driver, device); return true
  })

  safeHandle(ipcMain, 'audio-set-buffer-size', (frames: number) => {
    proc.setBufferSize(frames); return true
  })

  safeHandle(ipcMain, 'audio-set-sample-rate', (rate: number) => {
    proc.setSampleRate(rate); return true
  })

  safeHandle(ipcMain, 'audio-query-devices', () => {
    proc.queryDevices(); return true
  })
}
