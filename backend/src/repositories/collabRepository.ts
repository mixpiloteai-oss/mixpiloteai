// ── Collab Repository ──────────────────────────────────────────────────────────
// Persists room metadata so the project→room mapping survives server restarts.
// The actual OT operation log is kept in-memory for sub-ms latency.
import { supabase, isSupabaseConfigured } from '../lib/db'

export const collabRepository = {
  /** Create or update room metadata */
  async upsertRoom(roomId: string, projectId: string, rev: number): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return
    try { await supabase.from('collab_rooms').upsert([{
      id:          roomId,
      project_id:  projectId,
      rev,
      last_active: new Date().toISOString(),
    }]) } catch { /* fire-and-forget */ }
  },

  /** Find the most recent active room for a project */
  async findRoomByProject(projectId: string): Promise<{ id: string; rev: number } | null> {
    if (!isSupabaseConfigured || !supabase) return null
    const { data } = await supabase.from('collab_rooms')
      .select('id,rev')
      .eq('project_id', projectId)
      .order('last_active', { ascending: false })
      .limit(1)
      .single()
    return (data as { id: string; rev: number } | null) ?? null
  },

  /** Update last_active and current revision */
  async touchRoom(roomId: string, rev: number): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return
    try { await supabase.from('collab_rooms')
      .update({ last_active: new Date().toISOString(), rev })
      .eq('id', roomId) } catch { /* fire-and-forget */ }
  },

  /** Remove room record when evicted */
  async deleteRoom(roomId: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return
    try { await supabase.from('collab_rooms').delete().eq('id', roomId) } catch { /* fire-and-forget */ }
  },

  /** Purge rooms not active for > cutoffMs (called on startup) */
  async purgeStaleRooms(cutoffMs = 24 * 60 * 60 * 1000): Promise<number> {
    if (!isSupabaseConfigured || !supabase) return 0
    const cutoff = new Date(Date.now() - cutoffMs).toISOString()
    const { data } = await supabase.from('collab_rooms')
      .delete().lt('last_active', cutoff).select('id')
    return (data as any[] | null)?.length ?? 0
  },
}
