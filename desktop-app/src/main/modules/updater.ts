import { BrowserWindow } from 'electron'
import type { IpcMain } from 'electron'

const module = {
  register(_ipcMain: IpcMain, _win: BrowserWindow | null): void {
    // auto-updater wired up when publish config is set
  }
}

export default module
