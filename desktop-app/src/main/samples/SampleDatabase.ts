import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import type { SampleFileEntry } from './FileScanner.ts'

export interface SampleRecord extends SampleFileEntry {
  id:         string     // hash of path
  tags:       string[]
  favorite:   boolean
  userLabel:  string     // custom name override
  bpm:        number | null
  key:        string | null   // musical key e.g. 'Am', 'C#'
  indexedAt:  number     // unix ms
}

export interface SampleDatabase {
  version:    number
  indexedAt:  number
  rootDirs:   string[]
  records:    Record<string, SampleRecord>   // keyed by id
}

function pathToId(path: string): string {
  // Simple deterministic hash: use path chars
  let h = 0
  for (let i = 0; i < path.length; i++) {
    h = (Math.imul(31, h) + path.charCodeAt(i)) | 0
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

export class SampleDatabaseManager {
  private _db:   SampleDatabase
  private _path: string
  private _dirty = false

  constructor(opts?: { dir?: string }) {
    let dir: string
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { app } = require('electron') as { app: { getPath(n: string): string } }
      dir = opts?.dir ?? join(app.getPath('userData'), 'sample-db')
    } catch {
      dir = opts?.dir ?? join(process.cwd(), 'sample-db')
    }
    this._path = join(dir, 'samples.json')
    this._db   = { version: 1, indexedAt: 0, rootDirs: [], records: {} }
  }

  async load(): Promise<void> {
    try {
      const raw = await fs.readFile(this._path, 'utf8')
      this._db = JSON.parse(raw) as SampleDatabase
    } catch { /* first run */ }
  }

  async save(): Promise<void> {
    if (!this._dirty) return
    const dir = join(this._path, '..')
    await fs.mkdir(dir, { recursive: true })
    const tmp = this._path + '.tmp'
    await fs.writeFile(tmp, JSON.stringify(this._db), 'utf8')
    await fs.rename(tmp, this._path)
    this._dirty = false
  }

  // Index entries from a scan result
  indexEntries(rootDir: string, entries: SampleFileEntry[]): number {
    if (!this._db.rootDirs.includes(rootDir)) this._db.rootDirs.push(rootDir)
    let added = 0
    for (const entry of entries) {
      const id = pathToId(entry.path)
      if (!this._db.records[id]) {
        this._db.records[id] = { ...entry, id, tags: [], favorite: false, userLabel: '', bpm: null, key: null, indexedAt: Date.now() }
        added++
      } else {
        // Update mutable fields
        this._db.records[id] = { ...this._db.records[id], ...entry }
      }
    }
    this._db.indexedAt = Date.now()
    this._dirty = true
    return added
  }

  // Remove records whose paths no longer exist (stale entries)
  pruneStale(existingPaths: Set<string>): number {
    let removed = 0
    for (const [id, rec] of Object.entries(this._db.records)) {
      if (!existingPaths.has(rec.path)) { delete this._db.records[id]; removed++ }
    }
    if (removed > 0) this._dirty = true
    return removed
  }

  search(query: string, opts?: { type?: string; favorite?: boolean; tags?: string[] }): SampleRecord[] {
    const q = query.toLowerCase().trim()
    return Object.values(this._db.records).filter(r => {
      if (opts?.type && r.type !== opts.type) return false
      if (opts?.favorite && !r.favorite) return false
      if (opts?.tags?.length) {
        if (!opts.tags.every(t => r.tags.includes(t))) return false
      }
      if (!q) return true
      const haystack = (r.name + ' ' + r.dirPath + ' ' + r.tags.join(' ')).toLowerCase()
      return q.split(/\s+/).every(word => haystack.includes(word))
    })
  }

  getRecord(id: string): SampleRecord | null {
    return this._db.records[id] ?? null
  }

  setFavorite(id: string, on: boolean): void {
    if (this._db.records[id]) { this._db.records[id].favorite = on; this._dirty = true }
  }

  addTag(id: string, tag: string): void {
    const r = this._db.records[id]
    if (r && !r.tags.includes(tag)) { r.tags.push(tag); this._dirty = true }
  }

  removeTag(id: string, tag: string): void {
    const r = this._db.records[id]
    if (r) { r.tags = r.tags.filter(t => t !== tag); this._dirty = true }
  }

  getAllTags(): string[] {
    const tags = new Set<string>()
    for (const r of Object.values(this._db.records)) r.tags.forEach(t => tags.add(t))
    return [...tags].sort()
  }

  getRootDirs(): string[] { return [...this._db.rootDirs] }

  removeRootDir(dir: string): void {
    this._db.rootDirs = this._db.rootDirs.filter(d => d !== dir)
    // Remove records from this dir
    for (const [id, rec] of Object.entries(this._db.records)) {
      if (rec.path.startsWith(dir + '/') || rec.path.startsWith(dir + '\\')) {
        delete this._db.records[id]
      }
    }
    this._dirty = true
  }

  getStats(): { totalRecords: number; favorites: number; rootDirs: number; indexedAt: number } {
    const records = Object.values(this._db.records)
    return {
      totalRecords: records.length,
      favorites:    records.filter(r => r.favorite).length,
      rootDirs:     this._db.rootDirs.length,
      indexedAt:    this._db.indexedAt,
    }
  }
}
