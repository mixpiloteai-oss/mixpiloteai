// ── Sync Dedup Repository ──────────────────────────────────────────────────────
// Persistent deduplication for offline sync operations.
// Replaces the in-memory Set in sync.ts that resets on server restart.

import { supabase, isSupabaseConfigured } from '../lib/db'

// Bounded in-memory cache for hot path (DB is ground truth)
const memCache = new Set<string>()
const MEM_MAX = 50_000

function addToCache(id: string): void {
  if (memCache.size >= MEM_MAX) {
    const first = memCache.values().next().value
    if (first) memCache.delete(first)
  }
  memCache.add(id)
}

export const syncDedupRepository = {
  /** Check if an operation ID has been seen before (idempotency check) */
  async hasSeen(opId: string): Promise<boolean> {
    if (memCache.has(opId)) return true
    if (!isSupabaseConfigured || !supabase) return false
    const { data } = await supabase.from('sync_dedup')
      .select('op_id')
      .eq('op_id', opId)
      .limit(1)
      .single()
    if (data) {
      addToCache(opId)
      return true
    }
    return false
  },

  /** Mark an operation as seen */
  async markSeen(opId: string): Promise<void> {
    addToCache(opId)
    if (!isSupabaseConfigured || !supabase) return
    try {
      await supabase.from('sync_dedup').upsert({ op_id: opId })
    } catch { /* fire-and-forget */ }
  },

  /** Purge entries older than cutoffMs */
  async purgeOld(cutoffMs = 72 * 60 * 60 * 1000): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return
    const cutoff = new Date(Date.now() - cutoffMs).toISOString()
    try {
      await supabase.from('sync_dedup').delete().lt('processed_at', cutoff)
    } catch { /* fire-and-forget */ }
  },

  /** Number of seen IDs in memory cache */
  get cacheSize(): number { return memCache.size },
}
