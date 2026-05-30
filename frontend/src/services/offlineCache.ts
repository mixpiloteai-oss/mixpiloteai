// ─── Offline Cache — IndexedDB persistence layer ─────────────────────────────
// Stores projects, templates, packs and generic API responses so the app
// stays fully functional when the network is unavailable.

const DB_NAME    = 'mixpilot-offline-v2'
const DB_VERSION = 1

type StoreName = 'projects' | 'templates' | 'packs' | 'apiCache' | 'settings'

const STORE_CONFIGS: Record<StoreName, { keyPath: string }> = {
  projects:  { keyPath: 'id' },
  templates: { keyPath: 'id' },
  packs:     { keyPath: 'id' },
  apiCache:  { keyPath: 'cacheKey' },
  settings:  { keyPath: 'key' },
}

// ── API cache entry ───────────────────────────────────────────────────────────

export interface ApiCacheEntry {
  cacheKey:  string    // method + url, e.g. "GET:/api/projects"
  data:      unknown
  cachedAt:  number
  expiresAt: number    // ms timestamp; 0 = never expires
}

// ── Cached GET response TTLs (ms) ────────────────────────────────────────────

const CACHE_TTL: Partial<Record<string, number>> = {
  '/api/projects':   5 * 60 * 1000,    // 5 min
  '/api/templates':  10 * 60 * 1000,   // 10 min
  '/api/packs':      30 * 60 * 1000,   // 30 min
  '/api/subscriptions/plans': 60 * 60 * 1000,
}

function getTTL(url: string): number {
  for (const [prefix, ttl] of Object.entries(CACHE_TTL)) {
    if (url.startsWith(prefix)) return ttl!
  }
  return 5 * 60 * 1000  // 5 min default
}

// ── DB wrapper ────────────────────────────────────────────────────────────────

class OfflineCacheDB {
  private dbPromise: Promise<IDBDatabase> | null = null

  private open(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise
    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result
        for (const [name, cfg] of Object.entries(STORE_CONFIGS)) {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name, { keyPath: cfg.keyPath })
          }
        }
      }
      req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result)
      req.onerror   = () => reject(req.error)
    })
    return this.dbPromise
  }

  async get<T>(store: StoreName, key: string): Promise<T | null> {
    try {
      const db  = await this.open()
      return new Promise<T | null>((resolve, reject) => {
        const req = db.transaction(store, 'readonly').objectStore(store).get(key)
        req.onsuccess = () => resolve((req.result as T) ?? null)
        req.onerror   = () => reject(req.error)
      })
    } catch { return null }
  }

  async put<T>(store: StoreName, value: T): Promise<void> {
    try {
      const db = await this.open()
      await new Promise<void>((resolve, reject) => {
        const req = db.transaction(store, 'readwrite').objectStore(store).put(value)
        req.onsuccess = () => resolve()
        req.onerror   = () => reject(req.error)
      })
    } catch { /* best effort */ }
  }

  async getAll<T>(store: StoreName): Promise<T[]> {
    try {
      const db = await this.open()
      return new Promise<T[]>((resolve, reject) => {
        const req = db.transaction(store, 'readonly').objectStore(store).getAll()
        req.onsuccess = () => resolve((req.result as T[]) ?? [])
        req.onerror   = () => reject(req.error)
      })
    } catch { return [] }
  }

  async delete(store: StoreName, key: string): Promise<void> {
    try {
      const db = await this.open()
      await new Promise<void>((resolve, reject) => {
        const req = db.transaction(store, 'readwrite').objectStore(store).delete(key)
        req.onsuccess = () => resolve()
        req.onerror   = () => reject(req.error)
      })
    } catch { /* best effort */ }
  }
}

const db = new OfflineCacheDB()

// ── Public API ────────────────────────────────────────────────────────────────

/** Cache a successful API GET response */
export async function cacheApiResponse(url: string, data: unknown): Promise<void> {
  const ttl = getTTL(url)
  const entry: ApiCacheEntry = {
    cacheKey:  `GET:${url}`,
    data,
    cachedAt:  Date.now(),
    expiresAt: Date.now() + ttl,
  }
  await db.put('apiCache', entry)
}

/** Return cached API response if still fresh, or null */
export async function getCachedApiResponse(url: string): Promise<unknown | null> {
  const entry = await db.get<ApiCacheEntry>('apiCache', `GET:${url}`)
  if (!entry) return null
  if (entry.expiresAt > 0 && Date.now() > entry.expiresAt) {
    await db.delete('apiCache', `GET:${url}`)
    return null
  }
  return entry.data
}

/** Persist a full list of projects locally */
export async function cacheProjects(projects: unknown[]): Promise<void> {
  await Promise.all(projects.map(p => db.put('projects', p)))
}

/** Return all cached projects */
export async function getCachedProjects(): Promise<unknown[]> {
  return db.getAll('projects')
}

/** Persist a single project update locally */
export async function cacheProject(project: unknown & { id: string }): Promise<void> {
  await db.put('projects', project)
}

/** Remove a cached project */
export async function deleteCachedProject(id: string): Promise<void> {
  await db.delete('projects', id)
}

/** Generic typed setters/getters for templates and packs */
export async function cacheList(store: StoreName, items: unknown[]): Promise<void> {
  await Promise.all(items.map(item => db.put(store, item)))
}
export async function getList<T>(store: StoreName): Promise<T[]> {
  return db.getAll<T>(store)
}

/** Persist a setting value */
export async function cacheSetting(key: string, value: unknown): Promise<void> {
  await db.put('settings', { key, value })
}
export async function getSetting<T>(key: string): Promise<T | null> {
  const row = await db.get<{ key: string; value: T }>('settings', key)
  return row?.value ?? null
}
