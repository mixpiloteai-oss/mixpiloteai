// ── Versioned Save Service ─────────────────────────────────────────────────────
// All versions are persisted to PostgreSQL (project_versions table).
// A small in-memory LRU cache accelerates hot reads; DB is the source of truth.

import { saveRepository }     from '../repositories/saveRepository'
import { logger }              from '../utils/logger'

const MAX_VERSIONS_PER_PROJECT = 50
const MEM_CACHE_SIZE = 20   // keep last N versions per project in memory

export interface ProjectVersion {
  id:        string
  projectId: string
  label:     string
  createdAt: number
  sizeBytes: number
  checksum:  string
  data:      unknown
  type:      'manual' | 'auto' | 'pre-action'
}

type VersionMeta = Omit<ProjectVersion, 'data'>

// ── Utilities ─────────────────────────────────────────────────
function djb2(str: string): string {
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i)
    h = h >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

function makeId(): string {
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 8)}`
}

// ── In-memory LRU cache (warm reads, never source of truth) ───
const memCache = new Map<string, ProjectVersion[]>()

function getCached(projectId: string): ProjectVersion[] {
  return memCache.get(projectId) ?? []
}

function setCached(projectId: string, list: ProjectVersion[]): void {
  memCache.set(projectId, list.slice(-MEM_CACHE_SIZE))
}

// ── Service ───────────────────────────────────────────────────
export const saveService = {
  async createVersion(
    projectId: string,
    label:     string,
    data:      unknown,
    type:      ProjectVersion['type'] = 'manual',
  ): Promise<VersionMeta> {
    const json    = JSON.stringify(data)
    const version: ProjectVersion = {
      id:        makeId(),
      projectId,
      label,
      createdAt: Date.now(),
      sizeBytes: Buffer.byteLength(json, 'utf8'),
      checksum:  djb2(json),
      data,
      type,
    }

    // Persist first — never fire-and-forget for critical data
    await saveRepository.insert({
      id:         version.id,
      project_id: projectId,
      label,
      type,
      size_bytes: version.sizeBytes,
      checksum:   version.checksum,
      data,
      created_at: new Date(version.createdAt).toISOString(),
    })

    // Prune old versions beyond limit in DB
    await saveRepository.deleteOldest(projectId, MAX_VERSIONS_PER_PROJECT)
      .catch(e => logger.warn('saveService: pruning failed', { error: e }))

    // Update memory cache
    const list = [...getCached(projectId), version]
    setCached(projectId, list)

    const { data: _d, ...meta } = version
    return meta
  },

  async listVersions(projectId: string): Promise<VersionMeta[]> {
    // When DB is not configured, serve from in-memory cache
    const rows = await saveRepository.listMeta(projectId)
    if (!rows.length) {
      // DB not configured or empty — fall back to memory cache
      return getCached(projectId)
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(v => { const { data: _d, ...meta } = v; return meta })
    }
    const metas: VersionMeta[] = rows.map(r => ({
      id:        r.id,
      projectId: r.project_id,
      label:     r.label,
      type:      r.type as ProjectVersion['type'],
      sizeBytes: r.size_bytes,
      checksum:  r.checksum,
      createdAt: new Date(r.created_at).getTime(),
    }))

    // Warm the cache
    const cached = metas.map(m => ({ ...m, data: null as unknown }))
    setCached(projectId, cached)

    return metas
  },

  async getVersion(projectId: string, versionId: string): Promise<ProjectVersion | null> {
    // Check memory cache first
    const cached = getCached(projectId).find(v => v.id === versionId)
    if (cached?.data !== null && cached?.data !== undefined) return cached

    // Fetch from DB with full data payload
    const row = await saveRepository.getWithData(versionId)
    if (!row || row.project_id !== projectId) return null

    return {
      id:        row.id,
      projectId: row.project_id,
      label:     row.label,
      type:      row.type,
      sizeBytes: row.size_bytes,
      checksum:  row.checksum,
      data:      row.data,
      createdAt: new Date(row.created_at).getTime(),
    }
  },

  async deleteVersion(projectId: string, versionId: string): Promise<boolean> {
    const { supabase, isSupabaseConfigured } = await import('../lib/db')
    if (!isSupabaseConfigured || !supabase) throw new Error('DB not configured')
    const { error } = await supabase.from('project_versions')
      .delete().eq('id', versionId).eq('project_id', projectId)
    if (error) return false
    // Remove from cache
    const list = getCached(projectId).filter(v => v.id !== versionId)
    setCached(projectId, list)
    return true
  },

  clearProjectCache(projectId: string): void {
    memCache.delete(projectId)
  },

  validateData(data: unknown): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    if (typeof data !== 'object' || data === null) {
      errors.push('data must be an object')
      return { valid: false, errors }
    }
    const d = data as Record<string, unknown>
    if (typeof d.version !== 'number')    errors.push('missing numeric field: version')
    if (typeof d.savedAt !== 'number')    errors.push('missing numeric field: savedAt')
    if (typeof d.appVersion !== 'string') errors.push('missing string field: appVersion')
    if (typeof d._checksum === 'string') {
      const { _checksum, ...rest } = d
      if (djb2(JSON.stringify(rest)) !== _checksum) errors.push('checksum mismatch')
    }
    return { valid: errors.length === 0, errors }
  },
}
