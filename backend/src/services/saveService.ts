// ─── Versioned Save Service ───────────────────────────────────────────────────

import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { logger } from '../utils/logger'

const MAX_VERSIONS_PER_PROJECT = 50

interface ProjectVersion {
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

// In-memory store: projectId → versions (oldest first)
const store = new Map<string, ProjectVersion[]>()

function getList(projectId: string): ProjectVersion[] {
  if (!store.has(projectId)) store.set(projectId, [])
  return store.get(projectId)!
}

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

export const saveService = {
  createVersion(
    projectId: string,
    label: string,
    data: unknown,
    type: ProjectVersion['type'] = 'manual',
  ): VersionMeta {
    const json = JSON.stringify(data)
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
    const list = getList(projectId)
    list.push(version)
    // Prune oldest beyond limit
    while (list.length > MAX_VERSIONS_PER_PROJECT) list.shift()
    const { data: _d, ...meta } = version

    // Persist to Supabase when configured (fire-and-forget — don't block response)
    if (isSupabaseConfigured && supabase) {
      const row = {
        id:         meta.id,
        project_id: projectId,
        label:      meta.label,
        type:       meta.type,
        size_bytes: meta.sizeBytes,
        checksum:   meta.checksum,
        data:       JSON.stringify(version.data),
        created_at: new Date(meta.createdAt).toISOString(),
      }
      Promise.resolve(supabase.from('project_versions').insert([row])).then(({ error }) => {
        if (error) logger.warn('project_versions insert failed', { error: error.message })
      }).catch(() => {})
    }

    return meta
  },

  listVersions(projectId: string): VersionMeta[] {
    if ((!store.has(projectId) || getList(projectId).length === 0) && isSupabaseConfigured && supabase) {
      // Async load from Supabase — non-blocking, returns in-memory data immediately
      // The next request will benefit from the loaded data
      Promise.resolve(
        supabase
          .from('project_versions')
          .select('id, project_id, label, type, size_bytes, checksum, created_at')
          .eq('project_id', projectId)
          .order('created_at', { ascending: true })
          .limit(MAX_VERSIONS_PER_PROJECT)
      ).then(({ data, error }) => {
        if (!error && data && data.length > 0 && !store.has(projectId)) {
          // Reconstruct in-memory list (without data payload to save RAM)
          const versions: ProjectVersion[] = data.map(row => ({
            id:        row.id as string,
            projectId: row.project_id as string,
            label:     row.label as string,
            type:      (row.type as 'manual' | 'auto' | 'pre-action') ?? 'manual',
            createdAt: new Date(row.created_at as string).getTime(),
            sizeBytes: row.size_bytes as number,
            checksum:  row.checksum as string,
            data:      null,  // data not loaded into RAM — fetched on demand
          }))
          store.set(projectId, versions)
        }
      }).catch(() => {})
    }

    return getList(projectId)
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(({ data: _d, ...meta }) => meta)
  },

  getVersion(projectId: string, versionId: string): ProjectVersion | null {
    return getList(projectId).find(v => v.id === versionId) ?? null
  },

  deleteVersion(projectId: string, versionId: string): boolean {
    const list = getList(projectId)
    const idx  = list.findIndex(v => v.id === versionId)
    if (idx < 0) return false
    list.splice(idx, 1)
    return true
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
    // Verify checksum if provided
    if (typeof d._checksum === 'string') {
      const { _checksum, ...rest } = d
      if (djb2(JSON.stringify(rest)) !== _checksum) errors.push('checksum mismatch')
    }
    return { valid: errors.length === 0, errors }
  },
}
