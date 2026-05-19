// ─── Versioned Save Service ───────────────────────────────────────────────────

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
    return meta
  },

  listVersions(projectId: string): VersionMeta[] {
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
