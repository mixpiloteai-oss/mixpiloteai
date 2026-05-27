// ── Presence Repository ────────────────────────────────────────────────────────
// Persists last-known cursor state. Written on cursor updates, read on recovery.

import { supabase, isSupabaseConfigured } from '../lib/db'
import type { RoomPresence } from '../services/collaborationService'

const memPresence = new Map<string, RoomPresence & { roomId: string }>()

export const presenceRepository = {
  async upsert(roomId: string, p: RoomPresence): Promise<void> {
    const key = `${roomId}:${p.userId}`
    memPresence.set(key, { ...p, roomId })
    if (!isSupabaseConfigured || !supabase) return
    try {
      await supabase.from('collab_presence').upsert({
        room_id:     roomId,
        user_id:     p.userId,
        user_name:   p.userName,
        user_color:  p.userColor,
        cursor_bar:  p.cursor?.bar ?? null,
        cursor_track: p.cursor?.track ?? null,
        last_seen:   new Date(p.lastSeen).toISOString(),
      })
    } catch { /* fire-and-forget */ }
  },

  async loadByRoom(roomId: string): Promise<RoomPresence[]> {
    const recent = Date.now() - 5 * 60 * 1000 // last 5 minutes
    if (!isSupabaseConfigured || !supabase) {
      return [...memPresence.values()]
        .filter(p => p.roomId === roomId && p.lastSeen > recent)
        .map(({ roomId: _rid, ...p }) => p)
    }
    const { data } = await supabase.from('collab_presence')
      .select('*')
      .eq('room_id', roomId)
      .gt('last_seen', new Date(recent).toISOString())
    if (!data) return []
    return (data as Record<string, unknown>[]).map(row => ({
      userId:    String(row['user_id']),
      userName:  String(row['user_name']),
      userColor: String(row['user_color']),
      cursor: row['cursor_bar'] != null
        ? { bar: Number(row['cursor_bar']), track: String(row['cursor_track'] ?? '') }
        : undefined,
      lastSeen: new Date(String(row['last_seen'])).getTime(),
    }))
  },

  async delete(roomId: string, userId: string): Promise<void> {
    memPresence.delete(`${roomId}:${userId}`)
    if (!isSupabaseConfigured || !supabase) return
    try {
      await supabase.from('collab_presence').delete()
        .eq('room_id', roomId).eq('user_id', userId)
    } catch { /* fire-and-forget */ }
  },

  async purgeStale(cutoffMinutes = 30): Promise<void> {
    const cutoff = Date.now() - cutoffMinutes * 60 * 1000
    for (const [k, v] of memPresence) {
      if (v.lastSeen < cutoff) memPresence.delete(k)
    }
    if (!isSupabaseConfigured || !supabase) return
    try {
      await supabase.from('collab_presence').delete()
        .lt('last_seen', new Date(cutoff).toISOString())
    } catch { /* fire-and-forget */ }
  },
}
