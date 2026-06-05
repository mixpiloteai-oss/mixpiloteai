// ── Snapshot Service ──────────────────────────────────────────────────────────
// Creates and restores room state snapshots for fast recovery.
// Snapshots allow recovery without replaying hundreds of ops.

import { supabase, isSupabaseConfigured } from '../lib/db'
import type { CommittedOp } from './collaborationService'

const SNAPSHOT_INTERVAL_OPS = 100   // Take snapshot every 100 ops

export interface RoomSnapshot {
  rev:       number
  ops:       CommittedOp[]  // ops since last snapshot
  state:     Record<string, unknown>  // denormalized project state
  opsCount:  number
  createdAt: number
}

const memSnapshots = new Map<string, RoomSnapshot>()

export const snapshotService = {
  /** Check if a snapshot is needed based on op count since last snapshot */
  shouldSnapshot(lastSnapshotRev: number, currentRev: number): boolean {
    return (currentRev - lastSnapshotRev) >= SNAPSHOT_INTERVAL_OPS
  },

  /** Create a snapshot of the current room state */
  async create(
    roomId: string,
    projectId: string,
    rev: number,
    ops: CommittedOp[],
    state: Record<string, unknown> = {},
  ): Promise<void> {
    const snap: RoomSnapshot = {
      rev,
      ops: ops.slice(-SNAPSHOT_INTERVAL_OPS),  // keep only recent ops in snapshot
      state,
      opsCount: ops.length,
      createdAt: Date.now(),
    }
    memSnapshots.set(roomId, snap)

    if (!isSupabaseConfigured || !supabase) return
    try {
      await supabase.from('collab_snapshots').insert({
        room_id:    roomId,
        project_id: projectId,
        rev,
        state:      { ...state, ops: snap.ops },
        ops_count:  ops.length,
      })
      // Keep only last 3 snapshots per room
      const { data: old } = await supabase.from('collab_snapshots')
        .select('id, rev')
        .eq('room_id', roomId)
        .order('rev', { ascending: false })
        .range(3, 1000)
      if (old && (old as { id: string }[]).length > 0) {
        const ids = (old as { id: string }[]).map(r => r.id)
        await supabase.from('collab_snapshots').delete().in('id', ids)
      }
    } catch { /* fire-and-forget */ }
  },

  /** Load the latest snapshot for a room */
  async loadLatest(roomId: string): Promise<RoomSnapshot | null> {
    const mem = memSnapshots.get(roomId)
    if (mem) return mem

    if (!isSupabaseConfigured || !supabase) return null
    const { data } = await supabase.from('collab_snapshots')
      .select('*')
      .eq('room_id', roomId)
      .order('rev', { ascending: false })
      .limit(1)
      .single()
    if (!data) return null
    const row = data as Record<string, unknown>
    const statePayload = (row['state'] as Record<string, unknown>) ?? {}
    return {
      rev:       Number(row['rev']),
      ops:       (statePayload['ops'] as CommittedOp[]) ?? [],
      state:     statePayload,
      opsCount:  Number(row['ops_count'] ?? 0),
      createdAt: new Date(String(row['created_at'])).getTime(),
    }
  },

  /** Delete all snapshots for a room */
  async deleteByRoom(roomId: string): Promise<void> {
    memSnapshots.delete(roomId)
    if (!isSupabaseConfigured || !supabase) return
    try {
      await supabase.from('collab_snapshots').delete().eq('room_id', roomId)
    } catch { /* fire-and-forget */ }
  },
}
