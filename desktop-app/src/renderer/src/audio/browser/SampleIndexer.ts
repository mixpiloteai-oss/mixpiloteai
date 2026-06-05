import type { SampleEntry, SampleFilter, SampleSort, SortDir } from './types'

export class SampleIndexer {
  private entries:   SampleEntry[]              = []
  private nameIndex: Map<string, SampleEntry[]> = new Map()  // first 3 chars → entries
  private idIndex:   Map<string, SampleEntry>   = new Map()

  load(entries: SampleEntry[]): void {
    this.entries = [...entries]
    this.buildIndexes()
  }

  add(entry: SampleEntry): void {
    this.entries.push(entry)
    this.idIndex.set(entry.id, entry)

    const key = entry.name.toLowerCase().slice(0, 3)
    const bucket = this.nameIndex.get(key)
    if (bucket) {
      bucket.push(entry)
    } else {
      this.nameIndex.set(key, [entry])
    }
  }

  update(id: string, patch: Partial<SampleEntry>): void {
    const existing = this.idIndex.get(id)
    if (!existing) return

    const updated = { ...existing, ...patch, id }
    this.idIndex.set(id, updated)

    const idx = this.entries.findIndex(e => e.id === id)
    if (idx !== -1) this.entries[idx] = updated

    // Rebuild nameIndex entry if name changed
    if (patch.name !== undefined) {
      this.buildIndexes()
    }
  }

  remove(id: string): void {
    const entry = this.idIndex.get(id)
    if (!entry) return

    this.idIndex.delete(id)
    this.entries = this.entries.filter(e => e.id !== id)

    const key    = entry.name.toLowerCase().slice(0, 3)
    const bucket = this.nameIndex.get(key)
    if (bucket) {
      const filtered = bucket.filter(e => e.id !== id)
      if (filtered.length === 0) {
        this.nameIndex.delete(key)
      } else {
        this.nameIndex.set(key, filtered)
      }
    }
  }

  getById(id: string): SampleEntry | null {
    return this.idIndex.get(id) ?? null
  }

  getAll(): SampleEntry[] {
    return this.entries
  }

  search(filter: SampleFilter, sort: SampleSort, dir: SortDir): SampleEntry[] {
    const lowerSearch = filter.search.toLowerCase().split(/\s+/).filter(Boolean)
    const filtered    = this.entries.filter(e => this.matchesFilter(e, filter, lowerSearch))
    return this.sortEntries(filtered, sort, dir)
  }

  count(filter: SampleFilter): number {
    const lowerSearch = filter.search.toLowerCase().split(/\s+/).filter(Boolean)
    return this.entries.filter(e => this.matchesFilter(e, filter, lowerSearch)).length
  }

  getUniqueKeys(): string[] {
    const keys = new Set<string>()
    for (const e of this.entries) {
      if (e.key !== null) keys.add(e.key)
    }
    return [...keys].sort()
  }

  getUniqueStyles(): string[] {
    const styles = new Set<string>()
    for (const e of this.entries) {
      for (const s of e.style) styles.add(s)
    }
    return [...styles].sort()
  }

  getUniqueExts(): string[] {
    const exts = new Set<string>()
    for (const e of this.entries) exts.add(e.ext)
    return [...exts].sort()
  }

  private buildIndexes(): void {
    this.idIndex   = new Map()
    this.nameIndex = new Map()

    for (const entry of this.entries) {
      this.idIndex.set(entry.id, entry)

      const key    = entry.name.toLowerCase().slice(0, 3)
      const bucket = this.nameIndex.get(key)
      if (bucket) {
        bucket.push(entry)
      } else {
        this.nameIndex.set(key, [entry])
      }
    }
  }

  private matchesFilter(e: SampleEntry, f: SampleFilter, words: string[]): boolean {
    if (words.length > 0) {
      const haystack = (e.name + ' ' + e.path + ' ' + e.userTags.join(' ')).toLowerCase()
      if (!words.every(w => haystack.includes(w))) return false
    }
    if (f.extensions.length > 0 && !f.extensions.includes(e.ext)) return false
    if (f.bpmMin !== null && (e.bpm === null || e.bpm < f.bpmMin)) return false
    if (f.bpmMax !== null && (e.bpm === null || e.bpm > f.bpmMax)) return false
    if (f.keys.length > 0 && !f.keys.includes(e.key ?? '')) return false
    if (f.styles.length > 0 && !f.styles.some(s => e.style.includes(s))) return false
    if (f.favoritesOnly && !e.favorite) return false
    if (f.minDuration !== null && e.duration < f.minDuration) return false
    if (f.maxDuration !== null && e.duration > f.maxDuration) return false
    return true
  }

  private sortEntries(entries: SampleEntry[], sort: SampleSort, dir: SortDir): SampleEntry[] {
    const mult = dir === 'asc' ? 1 : -1
    return [...entries].sort((a, b) => {
      let v = 0
      switch (sort) {
        case 'name':     v = a.name.localeCompare(b.name);               break
        case 'date':     v = a.dateAdded - b.dateAdded;                   break
        case 'duration': v = a.duration - b.duration;                     break
        case 'bpm':      v = (a.bpm ?? 0) - (b.bpm ?? 0);                break
        case 'key':      v = (a.key ?? '').localeCompare(b.key ?? '');    break
        case 'size':     v = a.size - b.size;                             break
      }
      return v * mult
    })
  }
}

let _instance: SampleIndexer | null = null

export function getSampleIndexer(): SampleIndexer {
  if (!_instance) _instance = new SampleIndexer()
  return _instance
}
