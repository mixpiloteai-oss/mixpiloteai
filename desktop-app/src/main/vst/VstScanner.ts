import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

export type PluginCategory = 'instrument' | 'effect' | 'midi-effect' | 'analyzer' | 'unknown'

export interface ScannedPlugin {
  id: string
  name: string
  vendor: string
  version: string
  category: PluginCategory
  path: string
  hasEditor: boolean
  paramCount: number
  inputBusCount: number
  outputBusCount: number
  supportsMidi: boolean
  supportsMultiOut: boolean
  scanTimestamp: number
}

interface ModuleInfo {
  name?: string
  vendor?: string
  version?: string
  category?: string
  hasEditor?: boolean
  paramCount?: number
  inputBusCount?: number
  outputBusCount?: number
  supportsMidi?: boolean
  supportsMultiOut?: boolean
}

function categoryFromString(raw: string | undefined): PluginCategory {
  if (!raw) return 'unknown'
  const lower = raw.toLowerCase()
  if (lower.includes('instrument') || lower.includes('synth')) return 'instrument'
  if (lower.includes('midi')) return 'midi-effect'
  if (lower.includes('analyzer') || lower.includes('analyser')) return 'analyzer'
  if (lower.includes('effect') || lower.includes('fx') || lower.includes('filter') || lower.includes('eq') || lower.includes('compressor')) return 'effect'
  return 'unknown'
}

export class VstScanner {
  getPlatformVstPaths(): string[] {
    const platform = process.platform
    if (platform === 'win32') {
      const appdata = process.env['APPDATA'] ?? path.join(os.homedir(), 'AppData', 'Roaming')
      return [
        'C:/Program Files/Common Files/VST3',
        path.join(appdata, 'VST3'),
      ]
    } else if (platform === 'darwin') {
      return [
        '/Library/Audio/Plug-Ins/VST3',
        path.join(os.homedir(), 'Library', 'Audio', 'Plug-Ins', 'VST3'),
      ]
    } else {
      // Linux
      return [
        '/usr/lib/vst3',
        path.join(os.homedir(), '.vst3'),
        '/usr/local/lib/vst3',
      ]
    }
  }

  async scanDirectories(paths: string[]): Promise<ScannedPlugin[]> {
    const results: ScannedPlugin[] = []
    for (const dir of paths) {
      let entries: fs.Dirent[]
      try {
        entries = await fs.promises.readdir(dir, { withFileTypes: true })
      } catch {
        continue
      }
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory() && entry.name.endsWith('.vst3')) {
          const plugin = await this.scanPlugin(fullPath)
          if (plugin) results.push(plugin)
        }
      }
    }
    return results
  }

  async scanPlugin(pluginPath: string): Promise<ScannedPlugin | null> {
    try {
      const stat = await fs.promises.stat(pluginPath)
      if (!stat.isDirectory()) return null

      const bundleName = path.basename(pluginPath, '.vst3')
      const moduleInfoPath = path.join(pluginPath, 'Contents', 'moduleinfo.json')

      let info: ModuleInfo = {}
      try {
        const raw = await fs.promises.readFile(moduleInfoPath, 'utf-8')
        info = JSON.parse(raw) as ModuleInfo
      } catch {
        // Falls back gracefully if moduleinfo.json missing
      }

      const id = `vst3_${bundleName}_${pluginPath.replace(/[^a-zA-Z0-9]/g, '_')}`
      return {
        id,
        name: info.name ?? bundleName,
        vendor: info.vendor ?? 'Unknown',
        version: info.version ?? '1.0.0',
        category: categoryFromString(info.category),
        path: pluginPath,
        hasEditor: info.hasEditor ?? false,
        paramCount: info.paramCount ?? 0,
        inputBusCount: info.inputBusCount ?? 1,
        outputBusCount: info.outputBusCount ?? 1,
        supportsMidi: info.supportsMidi ?? false,
        supportsMultiOut: info.supportsMultiOut ?? false,
        scanTimestamp: Date.now(),
      }
    } catch {
      return null
    }
  }
}

export const vstScanner = new VstScanner()
