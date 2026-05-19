// ─── Offline Sync Queue ───────────────────────────────────────────────────────
// Mutations queued while offline are persisted to IndexedDB and replayed
// automatically when the connection is restored.
// Operations are sent in bulk to POST /api/sync.

const QUEUE_DB    = 'mixpilot-sync-queue-v1'
const QUEUE_STORE = 'queue'
const MAX_RETRIES = 3
const BATCH_MAX   = 50

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QueueItem {
  id:          string
  method:      'POST' | 'PUT' | 'PATCH' | 'DELETE'
  url:         string
  payload:     unknown
  type:        string     // semantic label, e.g. "UPDATE_PROJECT"
  timestamp:   number
  retries:     number
  accessToken: string | null
}

// ─── IndexedDB helpers ────────────────────────────────────────────────────────

let _db: IDBDatabase | null = null

function openQueueDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db)
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(QUEUE_DB, 1)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        const store = db.createObjectStore(QUEUE_STORE, { keyPath: 'id' })
        store.createIndex('timestamp', 'timestamp', { unique: false })
      }
    }
    req.onsuccess  = (e) => { _db = (e.target as IDBOpenDBRequest).result; resolve(_db) }
    req.onerror    = () => reject(req.error)
  })
}

async function idbPut(item: QueueItem): Promise<void> {
  const db = await openQueueDB()
  return new Promise<void>((resolve, reject) => {
    const req = db.transaction(QUEUE_STORE, 'readwrite').objectStore(QUEUE_STORE).put(item)
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
}

async function idbGetAll(): Promise<QueueItem[]> {
  const db = await openQueueDB()
  return new Promise<QueueItem[]>((resolve, reject) => {
    const req = db.transaction(QUEUE_STORE, 'readonly').objectStore(QUEUE_STORE)
      .index('timestamp').getAll()
    req.onsuccess = () => resolve(req.result as QueueItem[])
    req.onerror   = () => reject(req.error)
  })
}

async function idbDelete(id: string): Promise<void> {
  const db = await openQueueDB()
  return new Promise<void>((resolve, reject) => {
    const req = db.transaction(QUEUE_STORE, 'readwrite').objectStore(QUEUE_STORE).delete(id)
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Add a mutation to the queue. */
export async function enqueue(item: Omit<QueueItem, 'id' | 'timestamp' | 'retries'>): Promise<void> {
  const entry: QueueItem = {
    ...item,
    id:        `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
    retries:   0,
  }
  await idbPut(entry)
}

/** Return all pending queue items sorted oldest-first. */
export async function getPending(): Promise<QueueItem[]> {
  try { return await idbGetAll() } catch { return [] }
}

/** Count pending items. */
export async function pendingCount(): Promise<number> {
  const items = await getPending()
  return items.length
}

/** Remove a specific item by id. */
export async function removeItem(id: string): Promise<void> {
  await idbDelete(id)
}

/**
 * Flush the queue to the server.
 * Items that fail after MAX_RETRIES are discarded.
 * Returns { processed, failed, remaining }.
 */
export async function flush(
  apiBaseUrl: string,
  accessToken: string | null,
): Promise<{ processed: number; failed: number; remaining: number }> {
  const items = await getPending()
  if (!items.length) return { processed: 0, failed: 0, remaining: 0 }

  const batch = items.slice(0, BATCH_MAX).map(item => ({
    id:        item.id,
    type:      item.type,
    method:    item.method,
    url:       item.url,
    payload:   item.payload,
    timestamp: item.timestamp,
  }))

  try {
    const res = await fetch(`${apiBaseUrl}/api/sync`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ operations: batch }),
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) throw new Error(`sync HTTP ${res.status}`)

    const { data } = await res.json() as { data: { results: Array<{ operationId: string; success: boolean }> } }

    let processed = 0
    let failed    = 0

    for (const result of data.results) {
      if (result.success) {
        await idbDelete(result.operationId)
        processed++
      } else {
        // Increment retry counter; discard if exhausted
        const item = items.find(i => i.id === result.operationId)
        if (item) {
          if (item.retries + 1 >= MAX_RETRIES) {
            await idbDelete(item.id)
            failed++
          } else {
            await idbPut({ ...item, retries: item.retries + 1 })
          }
        }
      }
    }

    const remaining = (await getPending()).length
    return { processed, failed, remaining }
  } catch {
    // Network still down — leave queue intact
    return { processed: 0, failed: 0, remaining: items.length }
  }
}
