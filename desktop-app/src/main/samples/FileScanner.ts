import { promises as fs, Dirent } from 'node:fs'
import { join, extname, basename } from 'node:path'

export type SampleFileType = 'wav' | 'mp3' | 'flac' | 'ogg' | 'aiff' | 'midi' | 'mid' | 'preset' | 'sfz' | 'unknown'

export interface SampleFileEntry {
  path:       string      // absolute path
  name:       string      // basename without extension
  ext:        string      // lowercase extension without dot
  type:       SampleFileType
  sizeBytes:  number
  modifiedAt: number      // unix timestamp ms
  dirPath:    string      // parent directory
}

export interface ScanResult {
  entries:      SampleFileEntry[]
  totalFiles:   number
  scannedDirs:  number
  durationMs:   number
  errors:       string[]
}

export interface ScanOptions {
  maxDepth?:       number    // default 8
  maxFiles?:       number    // default 100_000
  onProgress?:     (found: number, currentDir: string) => void
}

const AUDIO_EXTENSIONS = new Set(['wav','mp3','flac','ogg','aiff','aif','mp4','m4a'])
const MIDI_EXTENSIONS  = new Set(['mid','midi'])
const PRESET_EXTENSIONS = new Set(['fxp','fxb','vstpreset','nmsv','sfz','sf2','preset'])

function classifyExt(ext: string): SampleFileType {
  if (AUDIO_EXTENSIONS.has(ext)) return ext as SampleFileType
  if (MIDI_EXTENSIONS.has(ext))  return ext === 'midi' ? 'midi' : 'mid'
  if (PRESET_EXTENSIONS.has(ext)) return 'preset'
  return 'unknown'
}

export class FileScanner {
  async scan(rootDir: string, options: ScanOptions = {}): Promise<ScanResult> {
    const { maxDepth = 8, maxFiles = 100_000, onProgress } = options
    const entries: SampleFileEntry[] = []
    const errors: string[] = []
    let scannedDirs = 0
    const t0 = Date.now()

    async function recurse(dir: string, depth: number): Promise<void> {
      if (depth > maxDepth || entries.length >= maxFiles) return
      scannedDirs++
      onProgress?.(entries.length, dir)

      let dirents: Dirent[]
      try { dirents = await fs.readdir(dir, { withFileTypes: true }) }
      catch (e) { errors.push(`${dir}: ${(e as Error).message}`); return }

      // Dirs first for consistent ordering
      const subdirs = dirents.filter(d => d.isDirectory() && !d.name.startsWith('.'))
      const files   = dirents.filter(d => d.isFile())

      for (const file of files) {
        if (entries.length >= maxFiles) break
        const ext = extname(file.name).slice(1).toLowerCase()
        const type = classifyExt(ext)
        if (type === 'unknown') continue

        const fullPath = join(dir, file.name)
        let stat: { size: number; mtimeMs: number }
        try { stat = await fs.stat(fullPath) } catch { continue }

        entries.push({
          path:       fullPath,
          name:       basename(file.name, '.' + ext),
          ext,
          type,
          sizeBytes:  stat.size,
          modifiedAt: Math.round(stat.mtimeMs),
          dirPath:    dir,
        })
      }

      await Promise.all(subdirs.map(d => recurse(join(dir, d.name), depth + 1)))
    }

    await recurse(rootDir, 0)
    return { entries, totalFiles: entries.length, scannedDirs, durationMs: Date.now() - t0, errors }
  }

  // Get just the immediate children of a directory (for folder tree navigation)
  async listDir(dir: string): Promise<{ name: string; isDir: boolean; hasChildren: boolean }[]> {
    let dirents: Dirent[]
    try { dirents = await fs.readdir(dir, { withFileTypes: true }) }
    catch { return [] }

    const result: { name: string; isDir: boolean; hasChildren: boolean }[] = []
    for (const d of dirents) {
      if (d.name.startsWith('.')) continue
      if (d.isDirectory()) {
        let hasChildren = false
        try {
          const children = await fs.readdir(join(dir, d.name), { withFileTypes: true })
          hasChildren = children.some(c => c.isDirectory() && !c.name.startsWith('.'))
        } catch { /* ignore */ }
        result.push({ name: d.name, isDir: true, hasChildren })
      } else {
        const ext = extname(d.name).slice(1).toLowerCase()
        if (classifyExt(ext) !== 'unknown') {
          result.push({ name: d.name, isDir: false, hasChildren: false })
        }
      }
    }
    return result.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  }
}
