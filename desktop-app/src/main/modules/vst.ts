import { IpcMain } from 'electron'
import { existsSync, readdirSync } from 'fs'
import { join } from 'path'
import os from 'os'

interface VSTPlugin {
  name: string
  path: string
  type: 'vst2' | 'vst3'
  vendor?: string
}

const VST_SCAN_PATHS: Record<string, string[]> = {
  win32: [
    'C:\\Program Files\\VSTPlugins',
    'C:\\Program Files\\Steinberg\\VSTPlugins',
    'C:\\Program Files\\Common Files\\VST3',
    join(os.homedir(), 'Documents', 'VST Plugins'),
  ],
  darwin: [
    '/Library/Audio/Plug-Ins/VST',
    '/Library/Audio/Plug-Ins/VST3',
    join(os.homedir(), 'Library', 'Audio', 'Plug-Ins', 'VST3'),
  ],
  linux: [
    '/usr/lib/vst',
    join(os.homedir(), '.vst'),
    join(os.homedir(), '.vst3'),
  ],
}

function scanDirectory(dir: string, type: 'vst2' | 'vst3'): VSTPlugin[] {
  if (!existsSync(dir)) return []
  const ext = type === 'vst3' ? '.vst3' : (process.platform === 'win32' ? '.dll' : '.so')
  try {
    return readdirSync(dir)
      .filter(f => f.endsWith(ext))
      .map(f => ({ name: f.replace(ext, ''), path: join(dir, f), type }))
  } catch {
    return []
  }
}

const module = {
  register(ipcMain: IpcMain): void {
    const plugins: VSTPlugin[] = []

    ipcMain.handle('scan-vst-plugins', async () => {
      plugins.length = 0
      const paths = VST_SCAN_PATHS[process.platform] ?? []
      for (const dir of paths) {
        plugins.push(...scanDirectory(dir, 'vst2'))
        plugins.push(...scanDirectory(dir, 'vst3'))
      }
      return plugins
    })

    ipcMain.handle('get-vst-plugins', () => plugins)
  }
}

export default module
