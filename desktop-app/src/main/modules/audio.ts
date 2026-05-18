import { IpcMain } from 'electron'

const module = {
  register(ipcMain: IpcMain): void {
    ipcMain.handle('get-audio-devices', async () => {
      return { inputs: [], outputs: [], defaultInput: null, defaultOutput: null }
    })

    ipcMain.handle('get-latency-profiles', () => [
      { id: 'low',    label: 'Low Latency',    bufferSize: 128,  latencyMs: 3 },
      { id: 'medium', label: 'Balanced',        bufferSize: 512,  latencyMs: 12 },
      { id: 'high',   label: 'High Stability',  bufferSize: 1024, latencyMs: 24 },
    ])

    ipcMain.handle('get-audio-settings', () => ({ sampleRate: 44100, bufferSize: 512, driver: 'default' }))
    ipcMain.handle('set-audio-settings', (_e, settings) => { console.log('[audio] settings updated', settings) })

    ipcMain.handle('audio-cache-is-cached',  (_e, _url: string)                  => false)
    ipcMain.handle('audio-cache-get-path',   (_e, _url: string)                  => null)
    ipcMain.handle('audio-cache-fetch',      (_e, _url: string)                  => null)
    ipcMain.handle('audio-cache-store',      (_e, _url: string, _fp: string)     => null)
    ipcMain.handle('audio-cache-evict',      (_e, _url: string)                  => null)
    ipcMain.handle('audio-cache-stats',      ()                                => ({ count: 0, totalBytes: 0 }))
    ipcMain.handle('audio-cache-list',       ()                                => [])
    ipcMain.handle('audio-cache-prune',      ()                                => null)
    ipcMain.handle('audio-cache-clear',      ()                                => null)
  }
}

export default module
