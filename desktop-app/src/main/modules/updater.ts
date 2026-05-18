import { IpcMain, BrowserWindow } from 'electron'

const module = {
  register(ipcMain: IpcMain, _win: BrowserWindow | null): void {
    // auto-updater wired up when publish config is set
  }
}

export default module
