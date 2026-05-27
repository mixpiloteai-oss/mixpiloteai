// ── Collab Ops Repository ──────────────────────────────────────────────────────
// Persistent operation log. Every committed op is written here before broadcast.
// On room recovery (restart), ops are replayed from this log.

import { supabase, isSupabaseConfigured } from '../lib/db'
import type { CommittedOp } from '../services/collaborationService'

// In-memory fallback
const memOps: CommittedOp[] = []

export const collabOpsRepository = {
  /** Append a committed op to the persistent log */
  async append(op: CommittedOp, projectId: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) {
      memOps.push(op)
      if (memOps.length > 10_000) memOps.splice(0, memOps.length - 10_000)
      return
    }
    try {
      await supabase.from('collab_ops').insert({
        room_id:    op.roomId,
        project_id: projectId,
        op_id:      op.id,
        rev:        op.committedRev,
        op_type:    op.type,
        payload:    op.payload,
        user_id:    op.userId,
        user_name:  op.userName,
        user_color: op.userColor,
        client_rev: op.rev,
        timestamp:  op.timestamp,
      })
    } catch { /* fire-and-forget: op already in memory, DB write failing is non-fatal */ }
  },

  /** Load ops for a room since a given rev (for recovery) */
  async loadSinceRev(roomId: string, sinceRev: number, limit = 500): Promise<CommittedOp[]> {
    if (!isSupabaseConfigured || !supabase) {
      return memOps
        .filter(o => o.roomId === roomId && o.committedRev > sinceRev)
        .slice(-limit)
    }
    const { data } = await supabase.from('collab_ops')
      .select('*')
      .eq('room_id', roomId)
      .gt('rev', sinceRev)
      .order('rev', { ascending: true })
      .limit(limit)
    if (!data) return []
    return (data as Record<string, unknown>[]).map(row => ({
      id:           String(row['op_id'] ?? row['id']),
      roomId:       String(row['room_id']),
      userId:       String(row['user_id']),
      userName:     String(row['user_name']),
      userColor:    String(row['user_color']),
      type:         row['op_type'] as CommittedOp['type'],
      payload:      (row['payload'] as Record<string, unknown>) ?? {},
      rev:          Number(row['client_rev'] ?? 0),
      timestamp:    Number(row['timestamp']),
      committedRev: Number(row['rev']),
    }))
  },

  /** Load the N most recent ops for a room */
  async loadRecent(roomId: string, limit = 50): Promise<CommittedOp[]> {
    if (!isSupabaseConfigured || !supabase) {
      return memOps.filter(o => o.roomId === roomId).slice(-limit)
    }
    const { data } = await supabase.from('collab_ops')
      .select('*')
      .eq('room_id', roomId)
      .order('rev', { ascending: false })
      .limit(limit)
    if (!data) return []
    return (data as Record<string, unknown>[]).reverse().map(row => ({
      id:           String(row['op_id'] ?? row['id']),
      roomId:       String(row['room_id']),
      userId:       String(row['user_id']),
      userName:     String(row['user_name']),
      userColor:    String(row['user_color']),
      type:         row['op_type'] as CommittedOp['type'],
      payload:      (row['payload'] as Record<string, unknown>) ?? {},
      rev:          Number(row['client_rev'] ?? 0),
      timestamp:    Number(row['timestamp']),
      committedRev: Number(row['rev']),
    }))
  },

  /** Delete all ops for a room (called when room is evicted) */
  async deleteByRoom(roomId: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) {
      memOps.splice(0, memOps.length, ...memOps.filter(o => o.roomId !== roomId))
      return
    }
    try {
      await supabase.from('collab_ops').delete().eq('room_id', roomId)
    } catch { /* fire-and-forget */ }
  },

  /** Purge ops older than cutoffMs (maintenance) */
  async purgeOld(cutoffMs = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    if (!isSupabaseConfigured || !supabase) return 0
    const cutoff = new Date(Date.now() - cutoffMs).toISOString()
    const { data } = await supabase.from('collab_ops')
      .delete().lt('committed_at', cutoff).select('id')
    return (data as unknown[] | null)?.length ?? 0
  },
}
