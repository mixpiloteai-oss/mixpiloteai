import { IpcMain } from 'electron'
import Store from 'electron-store'
import { join } from 'path'
import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'

const settings = new Store({ name: 'neurotek-settings' })

const module = {
  register(ipcMain: IpcMain): void {
    ipcMain.handle('settings-get',     (_e, key: string)        => settings.get(key))
    ipcMain.handle('settings-set',     (_e, key: string, val)   => settings.set(key, val))
    ipcMain.handle('settings-get-all', ()                        => settings.store)
    ipcMain.handle('settings-reset',   (_e, key: string)        => settings.delete(key))
    ipcMain.handle('save-setting',     (_e, key: string, val)   => settings.set(key, val))
    ipcMain.handle('load-setting',     (_e, key: string)        => settings.get(key))

    const offlineDir = join(app.getPath('userData'), 'offline-projects')
    if (!existsSync(offlineDir)) mkdirSync(offlineDir, { recursive: true })

    ipcMain.handle('offline-save',   (_e, id: string, data) => {
      writeFileSync(join(offlineDir, `${id}.json`), JSON.stringify(data))
    })
    ipcMain.handle('offline-load',   (_e, id: string) => {
      const p = join(offlineDir, `${id}.json`)
      return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null
    })
    ipcMain.handle('offline-list',   () =>
      existsSync(offlineDir)
        ? require('fs').readdirSync(offlineDir).filter((f: string) => f.endsWith('.json')).map((f: string) => f.replace('.json', ''))
        : []
    )
    ipcMain.handle('offline-delete', (_e, id: string) => {
      const p = join(offlineDir, `${id}.json`)
      if (existsSync(p)) require('fs').unlinkSync(p)
    })

    ipcMain.handle('read-file',  (_e, p: string)                => existsSync(p) ? readFileSync(p, 'utf8') : null)
    ipcMain.handle('write-file', (_e, p: string, content: string) => writeFileSync(p, content))

    ipcMain.handle('save-project', async (_e, data) => {
      const { dialog } = await import('electron')
      const result = await dialog.showSaveDialog({ filters: [{ name: 'Neurotek Project', extensions: ['ntai'] }] })
      if (!result.canceled && result.filePath) {
        writeFileSync(result.filePath, JSON.stringify(data, null, 2))
        return result.filePath
      }
      return null
    })
    ipcMain.handle('load-project', async () => {
      const { dialog } = await import('electron')
      const result = await dialog.showOpenDialog({ filters: [{ name: 'Neurotek Project', extensions: ['ntai'] }], properties: ['openFile'] })
      if (!result.canceled && result.filePaths[0]) {
        return JSON.parse(readFileSync(result.filePaths[0], 'utf8'))
      }
      return null
    })

    ipcMain.handle('debug-get-app-paths', () => ({
      userData:  app.getPath('userData'),
      documents: app.getPath('documents'),
      temp:      app.getPath('temp'),
      logs:      app.getPath('logs'),
    }))
  }
}

export default module
