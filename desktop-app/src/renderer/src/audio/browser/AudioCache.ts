import type { SampleEntry } from './types'

const DB_NAME    = 'mixpilot-sample-cache'
const DB_VERSION = 1
const STORE_NAME = 'samples'

type StoredSampleEntry = Omit<SampleEntry, 'fileHandle'>

function toStorable(entry: SampleEntry): StoredSampleEntry {
  const { fileHandle: _fileHandle, ...rest } = entry
  return rest
}

export class AudioCache {
  private db: IDBDatabase | null = null

  open(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const database = (event.target as IDBOpenDBRequest).result
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' })
          store.createIndex('path', 'path', { unique: true })
        }
      }

      request.onsuccess = (event: Event) => {
        this.db = (event.target as IDBOpenDBRequest).result
        resolve()
      }

      request.onerror = (event: Event) => {
        reject((event.target as IDBOpenDBRequest).error)
      }
    })
  }

  get(id: string): Promise<SampleEntry | null> {
    return new Promise<SampleEntry | null>((resolve, reject) => {
      if (!this.db) { reject(new Error('DB not open')); return }
      const tx      = this.db.transaction(STORE_NAME, 'readonly')
      const store   = tx.objectStore(STORE_NAME)
      const request = store.get(id)

      request.onsuccess = (event: Event) => {
        const result = (event.target as IDBRequest<StoredSampleEntry | undefined>).result
        resolve(result ?? null)
      }
      request.onerror = (event: Event) => {
        reject((event.target as IDBRequest).error)
      }
    })
  }

  put(entry: SampleEntry): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.db) { reject(new Error('DB not open')); return }
      const tx      = this.db.transaction(STORE_NAME, 'readwrite')
      const store   = tx.objectStore(STORE_NAME)
      const request = store.put(toStorable(entry))

      request.onsuccess = () => resolve()
      request.onerror   = (event: Event) => {
        reject((event.target as IDBRequest).error)
      }
    })
  }

  getAll(): Promise<SampleEntry[]> {
    return new Promise<SampleEntry[]>((resolve, reject) => {
      if (!this.db) { reject(new Error('DB not open')); return }
      const tx      = this.db.transaction(STORE_NAME, 'readonly')
      const store   = tx.objectStore(STORE_NAME)
      const request = store.getAll()

      request.onsuccess = (event: Event) => {
        const result = (event.target as IDBRequest<StoredSampleEntry[]>).result
        resolve(result)
      }
      request.onerror = (event: Event) => {
        reject((event.target as IDBRequest).error)
      }
    })
  }

  delete(id: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.db) { reject(new Error('DB not open')); return }
      const tx      = this.db.transaction(STORE_NAME, 'readwrite')
      const store   = tx.objectStore(STORE_NAME)
      const request = store.delete(id)

      request.onsuccess = () => resolve()
      request.onerror   = (event: Event) => {
        reject((event.target as IDBRequest).error)
      }
    })
  }

  clear(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.db) { reject(new Error('DB not open')); return }
      const tx      = this.db.transaction(STORE_NAME, 'readwrite')
      const store   = tx.objectStore(STORE_NAME)
      const request = store.clear()

      request.onsuccess = () => resolve()
      request.onerror   = (event: Event) => {
        reject((event.target as IDBRequest).error)
      }
    })
  }

  count(): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      if (!this.db) { reject(new Error('DB not open')); return }
      const tx      = this.db.transaction(STORE_NAME, 'readonly')
      const store   = tx.objectStore(STORE_NAME)
      const request = store.count()

      request.onsuccess = (event: Event) => {
        resolve((event.target as IDBRequest<number>).result)
      }
      request.onerror = (event: Event) => {
        reject((event.target as IDBRequest).error)
      }
    })
  }

  putMany(entries: SampleEntry[]): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.db) { reject(new Error('DB not open')); return }
      const tx    = this.db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)

      for (const entry of entries) {
        store.put(toStorable(entry))
      }

      tx.oncomplete = () => resolve()
      tx.onerror    = (event: Event) => {
        reject((event.target as IDBTransaction).error)
      }
    })
  }

  getByPaths(paths: string[]): Promise<Map<string, SampleEntry>> {
    return new Promise<Map<string, SampleEntry>>((resolve, reject) => {
      if (!this.db) { reject(new Error('DB not open')); return }
      const tx      = this.db.transaction(STORE_NAME, 'readonly')
      const store   = tx.objectStore(STORE_NAME)
      const index   = store.index('path')
      const result  = new Map<string, SampleEntry>()
      let pending   = paths.length

      if (pending === 0) { resolve(result); return }

      for (const path of paths) {
        const request = index.get(path)
        request.onsuccess = (event: Event) => {
          const entry = (event.target as IDBRequest<StoredSampleEntry | undefined>).result
          if (entry) result.set(path, entry)
          pending--
          if (pending === 0) resolve(result)
        }
        request.onerror = (event: Event) => {
          reject((event.target as IDBRequest).error)
        }
      }
    })
  }
}

let _instance: AudioCache | null = null

export function getAudioCache(): AudioCache {
  if (!_instance) _instance = new AudioCache()
  return _instance
}
