// ─── Plugin Scanner ───────────────────────────────────────────────────────────
// Discovers VST3 and AU plugins on disk, extracts metadata, checks architecture.
// Respects the blacklist — blacklisted plugins are included but flagged.

import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { join, basename, extname } from 'path'
import os from 'os'
import { isBlacklisted, getEntry } from './pluginBlacklist'

export type PluginFormat   = 'VST3' | 'AU' | 'VST2' | 'CLAP'
export type PluginCategory = 'instrument' | 'effect' | 'analyzer' | 'utility' | 'unknown'
export type PluginArch     = '64bit' | '32bit' | 'unknown'

export interface ScannedPlugin {
  id:           string          // stable: sha-like from path
  name:         string
  vendor:       string
  path:         string
  format:       PluginFormat
  category:     PluginCategory
  architecture: PluginArch
  isBlacklisted: boolean
  crashCount:   number
  isFavorite:   boolean
  hasEditor:    boolean
  paramCount:   number
  version:      string
  scannedAt:    number
}

// ── Platform scan paths ───────────────────────────────────────────────────────

const SCAN_PATHS: Record<string, { path: string; format: PluginFormat }[]> = {
  win32: [
    { path: 'C:\\Program Files\\Common Files\\VST3',                   format: 'VST3' },
    { path: 'C:\\Program Files\\VSTPlugins',                           format: 'VST2' },
    { path: 'C:\\Program Files\\Steinberg\\VSTPlugins',                format: 'VST2' },
    { path: join(os.homedir(), 'Documents', 'VST Plugins'),            format: 'VST2' },
    { path: join(os.homedir(), 'AppData', 'Local', 'Programs', 'VST3'),format: 'VST3' },
  ],
  darwin: [
    { path: '/Library/Audio/Plug-Ins/VST3',                                        format: 'VST3' },
    { path: '/Library/Audio/Plug-Ins/Components',                                  format: 'AU'   },
    { path: join(os.homedir(), 'Library', 'Audio', 'Plug-Ins', 'VST3'),            format: 'VST3' },
    { path: join(os.homedir(), 'Library', 'Audio', 'Plug-Ins', 'Components'),      format: 'AU'   },
  ],
  linux: [
    { path: '/usr/lib/vst3',                 format: 'VST3' },
    { path: '/usr/local/lib/vst3',           format: 'VST3' },
    { path: join(os.homedir(), '.vst3'),     format: 'VST3' },
    { path: join(os.homedir(), '.vst'),      format: 'VST2' },
  ],
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function stableId(path: string): string {
  let h = 5381
  for (let i = 0; i < path.length; i++) { h = ((h << 5) + h) ^ path.charCodeAt(i); h >>>= 0 }
  return `p-${h.toString(16).padStart(8, '0')}`
}

function detectCategory(name: string): PluginCategory {
  const n = name.toLowerCase()
  if (/eq|comp|limiter|reverb|delay|chorus|flanger|gate|saturator|distortion|exciter/.test(n)) return 'effect'
  if (/synth|sampler|piano|organ|guitar|bass|drum|kontakt|serum|vital|massive/.test(n))        return 'instrument'
  if (/analyzer|analyser|spectrum|meter|correlation/.test(n))                                   return 'analyzer'
  if (/utility|tuner|tool|converter|midi/.test(n))                                              return 'utility'
  return 'unknown'
}

function tryReadVST3Manifest(pluginPath: string): Partial<ScannedPlugin> {
  // VST3 bundles have a moduleinfo.json in Contents/Resources/
  const jsonPath = join(pluginPath, 'Contents', 'Resources', 'moduleinfo.json')
  if (existsSync(jsonPath)) {
    try {
      const m = JSON.parse(readFileSync(jsonPath, 'utf8')) as {
        Name?: string; Vendor?: string; Version?: string; Classes?: { name?: string; category?: string }[]
      }
      const cls = m.Classes?.[0]
      return {
        name:    m.Name   ?? cls?.name    ?? '',
        vendor:  m.Vendor ?? '',
        version: m.Version ?? '1.0.0',
        category: cls?.category?.toLowerCase().includes('inst') ? 'instrument' : 'effect',
      }
    } catch { /* fall through */ }
  }
  return {}
}

function detectArchitecture(pluginPath: string): PluginArch {
  // VST3 bundles: check Contents directory names (x86_64-win, arm64-mac, i386-win)
  const contentsDir = join(pluginPath, 'Contents')
  if (existsSync(contentsDir)) {
    try {
      const dirs = readdirSync(contentsDir)
      if (dirs.some(d => /x86_64|aarch64|arm64/.test(d))) return '64bit'
      if (dirs.some(d => /i386|x86(?!_64)/.test(d)))       return '32bit'
    } catch { /* */ }
  }
  return 'unknown'
}

function scanDir(dir: string, format: PluginFormat): ScannedPlugin[] {
  if (!existsSync(dir)) return []
  const results: ScannedPlugin[] = []
  const ext = format === 'VST3' ? '.vst3' : format === 'AU' ? '.component' : format === 'CLAP' ? '.clap' : (process.platform === 'win32' ? '.dll' : '.so')

  let entries: string[]
  try { entries = readdirSync(dir) } catch { return [] }

  for (const entry of entries) {
    if (!entry.endsWith(ext)) continue
    const fullPath = join(dir, entry)
    try {
      const stat = statSync(fullPath)
      if (!stat.isDirectory() && !stat.isFile()) continue
    } catch { continue }

    const name    = basename(entry, extname(entry))
    const id      = stableId(fullPath)
    const meta    = format === 'VST3' ? tryReadVST3Manifest(fullPath) : {}
    const blEntry = getEntry(fullPath)

    results.push({
      id,
      name:         meta.name     || name,
      vendor:       meta.vendor   || '',
      path:         fullPath,
      format,
      category:     meta.category || detectCategory(name),
      architecture: detectArchitecture(fullPath),
      isBlacklisted: isBlacklisted(fullPath),
      crashCount:   blEntry?.crashCount ?? 0,
      isFavorite:   false,
      hasEditor:    true,
      paramCount:   meta.paramCount ?? 0,
      version:      meta.version ?? '1.0.0',
      scannedAt:    Date.now(),
    })
  }
  return results
}

// ── Public API ────────────────────────────────────────────────────────────────

export function scanAllPlugins(): ScannedPlugin[] {
  const platform = process.platform
  const paths    = SCAN_PATHS[platform] ?? []
  const all:     ScannedPlugin[] = []
  const seen     = new Set<string>()

  for (const { path, format } of paths) {
    for (const plugin of scanDir(path, format)) {
      if (seen.has(plugin.id)) continue
      seen.add(plugin.id)
      all.push(plugin)
    }
  }
  return all
}

// Detect if a standalone .dll / .so is 32-bit (quick PE/ELF header check)
export function is32Bit(filePath: string): boolean {
  if (!existsSync(filePath)) return false
  try {
    const buf = Buffer.alloc(6)
    const fd  = require('fs').openSync(filePath, 'r')
    require('fs').readSync(fd, buf, 0, 6, 0)
    require('fs').closeSync(fd)
    // PE: MZ magic at 0, then e_lfanew at 0x3c, then PE\0\0, then machine
    if (buf[0] === 0x4d && buf[1] === 0x5a) {
      // Windows PE — read machine type
      const peOffBuf = Buffer.alloc(4)
      const fdPe = require('fs').openSync(filePath, 'r')
      require('fs').readSync(fdPe, peOffBuf, 0, 4, 0x3c)
      const peOff = peOffBuf.readUInt32LE(0)
      const machineBuf = Buffer.alloc(2)
      require('fs').readSync(fdPe, machineBuf, 0, 2, peOff + 4)
      require('fs').closeSync(fdPe)
      const machine = machineBuf.readUInt16LE(0)
      return machine === 0x014c  // IMAGE_FILE_MACHINE_I386
    }
    // ELF: check e_machine
    if (buf[0] === 0x7f && buf[1] === 0x45 && buf[2] === 0x4c && buf[3] === 0x46) {
      return buf[4] === 1  // ELFCLASS32
    }
    return false
  } catch {
    return false
  }
}
