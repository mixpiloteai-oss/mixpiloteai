// ── VST Window Manager ────────────────────────────────────────────────────────
// Manages Electron BrowserWindow instances for plugin UI.
// Plugin editor windows are separate OS windows parented to the main window.
//
// NOTE: This file is main-process only. The renderer only knows about
// PluginWindowInfo via IPC responses.

import * as path from 'path'
import { vst3Adapter } from './native/IVst3Adapter'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PluginWindowInfo {
  instanceId: string
  windowId: number
  width: number
  height: number
  pinned: boolean
  pluginName: string
}

// BrowserWindow type — imported lazily to allow running in test environments
// where Electron is not available. Use dynamic require inside methods.
type BrowserWindowType = {
  id: number
  loadFile(p: string): Promise<void>
  setTitle(t: string): void
  setAlwaysOnTop(v: boolean): void
  setSize(w: number, h: number): void
  getSize(): [number, number]
  isDestroyed(): boolean
  close(): void
  on(event: string, cb: () => void): void
}

type BrowserWindowConstructor = new (opts: Record<string, unknown>) => BrowserWindowType

// ── VstWindowManager ─────────────────────────────────────────────────────────

export class VstWindowManager {
  private windows: Map<string, BrowserWindowType> = new Map()
  private windowMeta: Map<string, PluginWindowInfo> = new Map()
  private mainWindow: BrowserWindowType | null = null

  /** Set the main application window so plugin windows can be parented to it. */
  setMainWindow(win: BrowserWindowType): void {
    this.mainWindow = win
  }

  // ── Window operations ─────────────────────────────────────────────────────

  async openPluginWindow(
    instanceId: string,
    pluginName: string,
    nativeWindowHandle?: Buffer,
  ): Promise<PluginWindowInfo> {
    // Return existing window if already open
    const existing = this.windowMeta.get(instanceId)
    if (existing) {
      const win = this.windows.get(instanceId)
      if (win && !win.isDestroyed()) {
        return existing
      }
    }

    // Dynamically import BrowserWindow to allow testing without Electron
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { BrowserWindow } = require('electron') as { BrowserWindow: BrowserWindowConstructor }

    const defaultWidth = 800
    const defaultHeight = 600

    const winOptions: Record<string, unknown> = {
      title: pluginName,
      width: defaultWidth,
      height: defaultHeight,
      resizable: true,
      frame: true,
      backgroundColor: '#1a1a2e',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    }

    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      winOptions['parent'] = this.mainWindow
    }

    const win = new BrowserWindow(winOptions)

    const pluginWindowHtml = path.join(
      __dirname,
      '..',
      '..',
      'renderer',
      'plugin-window',
      'index.html',
    )

    await win.loadFile(pluginWindowHtml)

    // Attach native editor if handle provided
    if (nativeWindowHandle) {
      try {
        // NATIVE-ADDON: plug in vst3-node addon here — interface defined in src/main/vst/native/IVst3Adapter.ts
        const { width, height } = await vst3Adapter.attachEditor(instanceId, nativeWindowHandle)
        win.setSize(width, height)
      } catch {
        // Native addon not available — plugin window shows placeholder HTML
      }
    }

    const [w, h] = win.getSize()

    const info: PluginWindowInfo = {
      instanceId,
      windowId: win.id,
      width: w,
      height: h,
      pinned: false,
      pluginName,
    }

    this.windows.set(instanceId, win)
    this.windowMeta.set(instanceId, info)

    win.on('closed', () => {
      this.windows.delete(instanceId)
      this.windowMeta.delete(instanceId)
    })

    return info
  }

  closePluginWindow(instanceId: string): void {
    const win = this.windows.get(instanceId)
    if (win && !win.isDestroyed()) {
      // Detach native editor before closing
      try {
        void vst3Adapter.detachEditor(instanceId)
      } catch {
        // Native addon not available
      }
      win.close()
    }
    this.windows.delete(instanceId)
    this.windowMeta.delete(instanceId)
  }

  resizePluginWindow(instanceId: string, width: number, height: number): void {
    const win = this.windows.get(instanceId)
    if (win && !win.isDestroyed()) {
      win.setSize(width, height)
      const meta = this.windowMeta.get(instanceId)
      if (meta) {
        meta.width = width
        meta.height = height
      }
    }
  }

  pinPluginWindow(instanceId: string, alwaysOnTop: boolean): void {
    const win = this.windows.get(instanceId)
    if (win && !win.isDestroyed()) {
      win.setAlwaysOnTop(alwaysOnTop)
      const meta = this.windowMeta.get(instanceId)
      if (meta) {
        meta.pinned = alwaysOnTop
      }
    }
  }

  getAllOpenWindows(): PluginWindowInfo[] {
    return Array.from(this.windowMeta.values())
  }

  isWindowOpen(instanceId: string): boolean {
    const win = this.windows.get(instanceId)
    if (!win) return false
    return !win.isDestroyed()
  }

  closeAllWindows(): void {
    for (const instanceId of Array.from(this.windows.keys())) {
      this.closePluginWindow(instanceId)
    }
  }
}

export const vstWindowManager = new VstWindowManager()
