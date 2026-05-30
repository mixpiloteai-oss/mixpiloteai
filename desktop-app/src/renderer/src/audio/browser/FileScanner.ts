import type { SampleEntry, FolderNode, ScanProgress } from './types'
import { getAudioCache } from './AudioCache'

const AUDIO_EXTENSIONS = new Set(['.wav', '.mp3', '.flac', '.aif', '.aiff', '.ogg', '.m4a', '.weba', '.opus'])

export type ProgressCallback = (progress: ScanProgress) => void

export class FileScanner {
  private cache   = getAudioCache()
  private aborted = false

  async pickAndScan(onProgress?: ProgressCallback): Promise<SampleEntry[]> {
    const dirHandle = await window.showDirectoryPicker({ mode: 'read' })
    return this.scanDirectory(dirHandle, onProgress)
  }

  async scanDirectory(
    dirHandle: FileSystemDirectoryHandle,
    onProgress?: ProgressCallback,
    basePath = '',
  ): Promise<SampleEntry[]> {
    const results: SampleEntry[]  = []
    const toCache: SampleEntry[]  = []
    let scanned = 0

    const walk = async (handle: FileSystemDirectoryHandle, currentPath: string): Promise<void> => {
      for await (const [name, entry] of handle.entries()) {
        if (this.aborted) return
        if (entry.kind === 'directory') {
          await walk(entry as FileSystemDirectoryHandle, currentPath ? `${currentPath}/${name}` : name)
        } else {
          const ext = name.slice(name.lastIndexOf('.')).toLowerCase()
          if (!AUDIO_EXTENSIONS.has(ext)) continue

          const fileHandle = entry as FileSystemFileHandle
          const file       = await fileHandle.getFile()
          const path       = currentPath ? `${currentPath}/${name}` : name
          const id         = this.makeId(path, file.size)

          const sample: SampleEntry = {
            id,
            name:        name.slice(0, name.lastIndexOf('.')),
            ext,
            path,
            size:        file.size,
            duration:    0,
            sampleRate:  0,
            channels:    0,
            bpm:         null,
            key:         null,
            style:       [],
            userTags:    [],
            favorite:    false,
            dateAdded:   file.lastModified || Date.now(),
            analyzed:    false,
            waveformData: null,
            fileHandle,
          }

          results.push(sample)
          toCache.push(sample)
          scanned++

          onProgress?.({ scanned, total: scanned, current: name, done: false })

          if (toCache.length >= 100) {
            await this.cache.putMany(toCache.splice(0))
          }
        }
      }
    }

    await this.cache.open()
    await walk(dirHandle, basePath)
    if (toCache.length > 0) await this.cache.putMany(toCache)
    onProgress?.({ scanned, total: scanned, current: '', done: true })
    return results
  }

  abort(): void {
    this.aborted = true
  }

  buildFolderTree(entries: SampleEntry[]): FolderNode {
    const root: FolderNode = { name: 'root', path: '', children: [], count: 0 }
    const nodeMap = new Map<string, FolderNode>()
    nodeMap.set('', root)

    for (const entry of entries) {
      const parts = entry.path.split('/')
      parts.pop() // remove filename
      let currentPath = ''
      let parent      = root
      for (const part of parts) {
        const childPath = currentPath ? `${currentPath}/${part}` : part
        if (!nodeMap.has(childPath)) {
          const node: FolderNode = { name: part, path: childPath, children: [], count: 0 }
          nodeMap.set(childPath, node)
          parent.children.push(node)
        }
        parent      = nodeMap.get(childPath)!
        currentPath = childPath
      }
    }

    // Count samples per node (bottom-up)
    const countNode = (node: FolderNode): void => {
      node.count = entries.filter(e =>
        e.path.startsWith(node.path ? node.path + '/' : '')
      ).length
      node.children.forEach(countNode)
    }
    root.count = entries.length
    root.children.forEach(countNode)
    return root
  }

  private makeId(path: string, size: number): string {
    const str = `${path}:${size}`
    let h = 5381
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) + h) ^ str.charCodeAt(i)
      h = h >>> 0
    }
    return h.toString(16).padStart(8, '0')
  }
}

export function getFileScanner(): FileScanner {
  return new FileScanner()
}
