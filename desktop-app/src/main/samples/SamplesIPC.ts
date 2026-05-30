import type { IpcMain, BrowserWindow } from 'electron'
import { dialog } from 'electron'
import { FileScanner } from './FileScanner.ts'
import { SampleDatabaseManager } from './SampleDatabase.ts'

export function registerSamplesIPC(
  ipcMain: IpcMain,
  db: SampleDatabaseManager,
  getWindow: () => BrowserWindow | null,
): void {
  const scanner = new FileScanner()

  // Initialize on startup
  void db.load()

  ipcMain.handle('samples:get-root-dirs', () => db.getRootDirs())

  ipcMain.handle('samples:add-root-dir', async () => {
    const win = getWindow()
    const result = await dialog.showOpenDialog(win ?? undefined as unknown as BrowserWindow, {
      properties: ['openDirectory'],
      title: 'Add Sample Folder',
    })
    if (result.canceled || !result.filePaths[0]) return null
    const dir = result.filePaths[0]
    // Scan and index in background, send progress events
    const win2 = getWindow()
    void (async () => {
      const scan = await scanner.scan(dir, {
        onProgress: (found, currentDir) => {
          win2?.webContents.send('samples:scan-progress', { found, currentDir })
        },
      })
      db.indexEntries(dir, scan.entries)
      await db.save()
      win2?.webContents.send('samples:scan-complete', {
        dir,
        totalFiles: scan.totalFiles,
        durationMs: scan.durationMs,
      })
    })()
    return dir
  })

  ipcMain.handle('samples:remove-root-dir', async (_e, dir: string) => {
    db.removeRootDir(dir)
    await db.save()
  })

  ipcMain.handle('samples:rescan', async (_e, dir: string) => {
    const win = getWindow()
    const scan = await scanner.scan(dir, {
      onProgress: (found, currentDir) => {
        win?.webContents.send('samples:scan-progress', { found, currentDir })
      },
    })
    const existingPaths = new Set(scan.entries.map(e => e.path))
    db.pruneStale(existingPaths)
    db.indexEntries(dir, scan.entries)
    await db.save()
    win?.webContents.send('samples:scan-complete', { dir, totalFiles: scan.totalFiles, durationMs: scan.durationMs })
    return scan.totalFiles
  })

  ipcMain.handle('samples:search', (_e, query: string, opts?: { type?: string; favorite?: boolean; tags?: string[] }) => {
    return db.search(query, opts).slice(0, 500)   // cap at 500 results
  })

  ipcMain.handle('samples:list-dir', (_e, dir: string) => scanner.listDir(dir))

  ipcMain.handle('samples:get-record', (_e, id: string) => db.getRecord(id))

  ipcMain.handle('samples:set-favorite', async (_e, id: string, on: boolean) => {
    db.setFavorite(id, on)
    await db.save()
  })

  ipcMain.handle('samples:add-tag', async (_e, id: string, tag: string) => {
    db.addTag(id, tag)
    await db.save()
  })

  ipcMain.handle('samples:remove-tag', async (_e, id: string, tag: string) => {
    db.removeTag(id, tag)
    await db.save()
  })

  ipcMain.handle('samples:get-all-tags', () => db.getAllTags())

  ipcMain.handle('samples:get-stats', () => db.getStats())
}
