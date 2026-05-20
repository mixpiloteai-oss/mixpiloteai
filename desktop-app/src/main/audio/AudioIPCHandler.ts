/**
 * AudioIPCHandler — wires Electron IPC to the native audio engine process
 *
 * Renderer → IPC → AudioIPCHandler → AudioEngineProcess → native engine
 * native engine → AudioEngineProcess → IPC push → renderer window
 */

import type { IpcMain, BrowserWindow } from 'electron'
import { getAudioEngineProcess }        from './AudioEngineProcess'
import { DriverDetector }               from './DriverDetector'
import type { EngineEvent }             from './AudioEngineProcess'

export function registerAudioIPCHandlers(ipcMain: IpcMain, getWindow: () => BrowserWindow | null): void {
  const proc     = getAudioEngineProcess()
  const detector = new DriverDetector()

  // ── Forward native engine events to renderer ─────────────────────────────

  proc.on('event', (evt: EngineEvent) => {
    const win = getWindow()
    if (!win) return
    win.webContents.send('native-audio-event', evt)
  })

  proc.on('exit', ({ code, signal }: { code: number | null; signal: string | null }) => {
    const win = getWindow()
    win?.webContents.send('native-audio-event', {
      event: 'engine_exit', code, signal,
    })
  })

  // ── Driver / device detection ─────────────────────────────────────────────

  ipcMain.handle('audio-detect-drivers', async () => {
    return detector.detectDrivers()
  })

  ipcMain.handle('audio-detect-devices', async () => {
    return detector.detectDevices()
  })

  ipcMain.handle('audio-preferred-driver', () => {
    return detector.getPreferredDriver()
  })

  // ── Engine lifecycle ──────────────────────────────────────────────────────

  ipcMain.handle('audio-engine-start', async (_e, opts: {
    driver?: string; device?: string; sampleRate?: number; bufferSize?: number
  } = {}) => {
    await proc.start(opts.driver, opts.device, opts.sampleRate, opts.bufferSize)
    return { ok: true }
  })

  ipcMain.handle('audio-engine-stop', () => {
    proc.stop()
    return { ok: true }
  })

  ipcMain.handle('audio-engine-ready', () => proc.ready)

  // ── Transport ─────────────────────────────────────────────────────────────

  ipcMain.handle('audio-play',  () => { proc.play();  return true })
  ipcMain.handle('audio-stop',  () => { proc.stopPlayback();  return true })
  ipcMain.handle('audio-pause', () => { proc.pause(); return true })

  ipcMain.handle('audio-seek', (_e, bar: number, beat = 1) => {
    proc.seek(bar, beat); return true
  })

  ipcMain.handle('audio-set-bpm', (_e, bpm: number) => {
    proc.setBpm(bpm); return true
  })

  ipcMain.handle('audio-set-time-sig', (_e, numerator: number, denominator: number) => {
    proc.setTimeSig(numerator, denominator); return true
  })

  ipcMain.handle('audio-set-loop', (_e, enabled: boolean, startBar: number, endBar: number) => {
    proc.setLoop(enabled, startBar, endBar); return true
  })

  ipcMain.handle('audio-get-state', () => {
    proc.getState(); return true
  })

  // ── Master ────────────────────────────────────────────────────────────────

  ipcMain.handle('audio-set-master-gain', (_e, db: number) => {
    proc.setMasterGain(db); return true
  })

  // ── Tracks ────────────────────────────────────────────────────────────────

  ipcMain.handle('audio-add-track', (_e, id: string, type: string, name: string, color?: string) => {
    proc.addTrack(id, type, name, color); return true
  })

  ipcMain.handle('audio-remove-track', (_e, id: string) => {
    proc.removeTrack(id); return true
  })

  ipcMain.handle('audio-set-track-gain', (_e, id: string, db: number) => {
    proc.setTrackGain(id, db); return true
  })

  ipcMain.handle('audio-set-track-pan', (_e, id: string, pan: number) => {
    proc.setTrackPan(id, pan); return true
  })

  ipcMain.handle('audio-mute-track', (_e, id: string, muted: boolean) => {
    proc.muteTrack(id, muted); return true
  })

  ipcMain.handle('audio-solo-track', (_e, id: string, soloed: boolean) => {
    proc.soloTrack(id, soloed); return true
  })

  ipcMain.handle('audio-arm-track', (_e, id: string, armed: boolean) => {
    proc.armTrack(id, armed); return true
  })

  // ── Routing / sends ───────────────────────────────────────────────────────

  ipcMain.handle('audio-add-send', (_e, fromId: string, toId: string, gainDb: number, preFader: boolean) => {
    proc.addSend(fromId, toId, gainDb, preFader); return true
  })

  // ── Driver settings ───────────────────────────────────────────────────────

  ipcMain.handle('audio-set-driver', (_e, driver: string, device: string) => {
    proc.setDriver(driver, device); return true
  })

  ipcMain.handle('audio-set-buffer-size', (_e, frames: number) => {
    proc.setBufferSize(frames); return true
  })

  ipcMain.handle('audio-set-sample-rate', (_e, rate: number) => {
    proc.setSampleRate(rate); return true
  })

  ipcMain.handle('audio-query-devices', () => {
    proc.queryDevices(); return true
  })
}
