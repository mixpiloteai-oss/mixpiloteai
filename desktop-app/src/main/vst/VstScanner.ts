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
  // Enhanced fields (optional for backward compatibility)
  cid?: string
  sdkVersion?: string
  subCategories?: string[]
  binaryPath?: string | null
  binaryExists?: boolean
}

// VST3 moduleinfo.json schema (Steinberg SDK 3.7+)
interface ModuleInfoClass {
  CID?: string
  Category?: string
  Name?: string
  Subcategories?: string
  Version?: string
  SDKVersion?: string
}

interface ModuleInfoFactoryInfo {
  Vendor?: string
  URL?: string
  'E-Mail'?: string
}

interface ModuleInfoJson {
  Name?: string
  Version?: string
  'Factory Info'?: ModuleInfoFactoryInfo
  Classes?: ModuleInfoClass[]
}

// Legacy internal shape (used for fallback parsing)
interface LegacyModuleInfo {
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

// Platform binary directory names in order of preference
const PLATFORM_BINARY_DIRS: Record<string, string[]> = {
  win32:  ['x86_64-win', 'x86_64-win32', 'Win64'],
  darwin: ['MacOS', 'macOS'],
  linux:  ['x86_64-linux', 'x86-linux'],
}

function categoryFromString(raw: string | undefined): PluginCategory {
  if (!raw) return 'unknown'
  const lower = raw.toLowerCase()
  if (lower.includes('instrument') || lower.includes('synth')) return 'instrument'
  if (lower.includes('midi')) return 'midi-effect'
  if (lower.includes('analyzer') || lower.includes('analyser')) return 'analyzer'
  if (lower.includes('effect') || lower.includes('fx') || lower.includes('filter') ||
      lower.includes('eq') || lower.includes('compressor') || lower.includes('dynamics')) return 'effect'
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
    // Parallel scan with Promise.allSettled for crash isolation between directories
    const dirResults = await Promise.allSettled(
      paths.map(dir => this.scanDirectory(dir))
    )

    const results: ScannedPlugin[] = []
    for (const result of dirResults) {
      if (result.status === 'fulfilled') {
        results.push(...result.value)
      }
      // Silently skip failed directories (not found, permission denied, etc.)
    }
    return results
  }

  private async scanDirectory(dir: string): Promise<ScannedPlugin[]> {
    let entries: fs.Dirent[]
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true })
    } catch {
      return []
    }

    const pluginPaths = entries
      .filter(e => e.isDirectory() && e.name.endsWith('.vst3'))
      .map(e => path.join(dir, e.name))

    const pluginResults = await Promise.allSettled(
      pluginPaths.map(p => this.scanPlugin(p))
    )

    const plugins: ScannedPlugin[] = []
    for (const result of pluginResults) {
      if (result.status === 'fulfilled' && result.value !== null) {
        plugins.push(result.value)
      }
    }
    return plugins
  }

  async scanPlugin(pluginPath: string): Promise<ScannedPlugin | null> {
    try {
      // Step 1: verify exists and is a directory
      let stat: fs.Stats
      try {
        stat = await fs.promises.stat(pluginPath)
      } catch {
        return null
      }
      if (!stat.isDirectory()) return null

      const contentsPath = path.join(pluginPath, 'Contents')
      // Step 2: require Contents/ directory
      try {
        const contentsStat = await fs.promises.stat(contentsPath)
        if (!contentsStat.isDirectory()) return null
      } catch {
        return null
      }

      const bundleName = path.basename(pluginPath, '.vst3')

      // Step 3: try moduleinfo.json (primary, VST3 SDK 3.7+)
      const moduleInfoPath = path.join(contentsPath, 'moduleinfo.json')
      let partial: Partial<ScannedPlugin> = {}

      try {
        const raw = await fs.promises.readFile(moduleInfoPath, 'utf-8')
        const json = JSON.parse(raw) as unknown
        partial = this.parseModuleInfo(json as object)
      } catch {
        // Step 4: fallback to Info.plist for older macOS bundles
        const plistPath = path.join(contentsPath, 'Info.plist')
        try {
          const plistRaw = await fs.promises.readFile(plistPath, 'utf-8')
          partial = this.parsePlistBasic(plistRaw, bundleName)
        } catch {
          // Step 5: minimal ScannedPlugin from dirname if neither exists
          partial = { name: bundleName, vendor: 'Unknown', category: 'unknown' }
        }
      }

      // Step 6: binary presence check
      const binaryExists = await this.hasPlatformBinary(contentsPath)
      const binaryPath = await this.getPluginBinaryPath(contentsPath)

      const id = `vst3_${bundleName}_${pluginPath.replace(/[^a-zA-Z0-9]/g, '_')}`

      return {
        id,
        name: partial.name ?? bundleName,
        vendor: partial.vendor ?? 'Unknown',
        version: partial.version ?? '1.0.0',
        category: partial.category ?? categoryFromString(undefined),
        path: pluginPath,
        hasEditor: partial.hasEditor ?? false,
        paramCount: partial.paramCount ?? 0,
        inputBusCount: partial.inputBusCount ?? 1,
        outputBusCount: partial.outputBusCount ?? 1,
        supportsMidi: partial.supportsMidi ?? false,
        supportsMultiOut: partial.supportsMultiOut ?? false,
        scanTimestamp: Date.now(),
        cid: partial.cid,
        sdkVersion: partial.sdkVersion,
        subCategories: partial.subCategories,
        binaryPath,
        binaryExists,
      }
    } catch {
      return null
    }
  }

  parseModuleInfo(json: object): Partial<ScannedPlugin> {
    // Handle both real moduleinfo.json (Steinberg schema) and legacy format
    const info = json as Record<string, unknown>

    // Try Steinberg VST3 SDK 3.7+ schema first
    if ('Factory Info' in info || 'Classes' in info) {
      const moduleInfo = info as ModuleInfoJson
      const factoryInfo = moduleInfo['Factory Info']
      const classes = moduleInfo.Classes ?? []
      const firstClass = classes[0]

      const subcatStr = firstClass?.Subcategories ?? ''
      const subCategories = subcatStr ? subcatStr.split('|').map(s => s.trim()).filter(Boolean) : []
      const category = categoryFromString(firstClass?.Category ?? subcatStr)

      return {
        name: firstClass?.Name ?? moduleInfo.Name ?? 'Unknown',
        vendor: factoryInfo?.Vendor ?? 'Unknown',
        version: firstClass?.Version ?? moduleInfo.Version ?? '1.0.0',
        sdkVersion: firstClass?.SDKVersion,
        cid: firstClass?.CID,
        category,
        subCategories,
      }
    }

    // Legacy flat format (used by older scanners / test fixtures)
    const legacy = info as LegacyModuleInfo
    return {
      name: legacy.name,
      vendor: legacy.vendor,
      version: legacy.version,
      category: categoryFromString(legacy.category),
      hasEditor: legacy.hasEditor,
      paramCount: legacy.paramCount,
      inputBusCount: legacy.inputBusCount,
      outputBusCount: legacy.outputBusCount,
      supportsMidi: legacy.supportsMidi,
      supportsMultiOut: legacy.supportsMultiOut,
    }
  }

  private parsePlistBasic(plistContent: string, fallbackName: string): Partial<ScannedPlugin> {
    // Minimal Info.plist parsing (XML plist, no full parser dependency)
    const extract = (key: string): string | undefined => {
      const keyRe = new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`, 'i')
      return keyRe.exec(plistContent)?.[1]
    }

    const name = extract('CFBundleDisplayName') ?? extract('CFBundleName') ?? fallbackName
    const version = extract('CFBundleShortVersionString') ?? extract('CFBundleVersion')
    const vendor = extract('NSHumanReadableCopyright')?.match(/^[^©\d,]+/)?.[0]?.trim()

    return { name, vendor, version }
  }

  async hasPlatformBinary(contentsPath: string): Promise<boolean> {
    const dirs = PLATFORM_BINARY_DIRS[process.platform] ?? PLATFORM_BINARY_DIRS['linux']
    for (const dirName of dirs) {
      try {
        const stat = await fs.promises.stat(path.join(contentsPath, dirName))
        if (stat.isDirectory()) return true
      } catch {
        // Not found, try next
      }
    }
    return false
  }

  async getPluginBinaryPath(contentsPath: string): Promise<string | null> {
    const dirs = PLATFORM_BINARY_DIRS[process.platform] ?? PLATFORM_BINARY_DIRS['linux']
    const exts: Record<string, string> = {
      win32: '.vst3',
      darwin: '',   // macOS: no extension for the Mach-O binary inside the bundle
      linux: '.so',
    }
    const ext = exts[process.platform] ?? '.so'

    for (const dirName of dirs) {
      const binDir = path.join(contentsPath, dirName)
      try {
        const entries = await fs.promises.readdir(binDir)
        const binary = entries.find(e =>
          ext ? e.endsWith(ext) : !e.includes('.')
        )
        if (binary) return path.join(binDir, binary)
      } catch {
        // Not found, try next
      }
    }
    return null
  }
}

export const vstScanner = new VstScanner()
