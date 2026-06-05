// ─── CloudSyncService ─────────────────────────────────────────────────────────
// Server-side project sync with conflict detection (in-memory store).

export interface SyncVersion {
  projectId: string
  version: number
  checksum: string
  savedAt: number
  data: unknown
}

export interface ConflictInfo {
  type: 'version-mismatch'
  localVersion: number
  serverVersion: number
  serverData: unknown
}

export type PushResult =
  | { ok: true; version: SyncVersion }
  | { ok: false; conflict: ConflictInfo }
  | { ok: false; error: string }

// ── Utilities ─────────────────────────────────────────────────────────────────

function djb2(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i)
    h = h >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

// ── Service ───────────────────────────────────────────────────────────────────

export class CloudSyncService {
  private _versions = new Map<string, SyncVersion[]>()

  push(
    projectId: string,
    data: unknown,
    baseVersion: number,
    label?: string,
  ): PushResult {
    const existing = this._versions.get(projectId) ?? []
    const latest = existing.length > 0 ? existing[existing.length - 1]! : null
    const latestVersion = latest?.version ?? 0

    // Conflict check (baseVersion === -1 means force push — bypass conflict)
    if (baseVersion !== -1 && latest !== null && latestVersion !== baseVersion) {
      return {
        ok: false,
        conflict: {
          type: 'version-mismatch',
          localVersion: baseVersion,
          serverVersion: latestVersion,
          serverData: latest.data,
        },
      }
    }

    const newVersion: SyncVersion = {
      projectId,
      version: latestVersion + 1,
      checksum: djb2(JSON.stringify(data)),
      savedAt: Date.now(),
      data,
    }
    // Store with label annotation unused but accepted for extensibility
    void label
    const updated = [...existing, newVersion]
    this._versions.set(projectId, updated)
    return { ok: true, version: newVersion }
  }

  pull(projectId: string): { version: SyncVersion | null } {
    const versions = this._versions.get(projectId) ?? []
    const latest = versions.length > 0 ? versions[versions.length - 1]! : null
    return { version: latest }
  }

  listVersions(projectId: string): SyncVersion[] {
    return [...(this._versions.get(projectId) ?? [])]
  }

  getVersion(projectId: string, version: number): SyncVersion | null {
    const versions = this._versions.get(projectId) ?? []
    return versions.find((v) => v.version === version) ?? null
  }

  forcePush(projectId: string, data: unknown, label?: string): PushResult {
    return this.push(projectId, data, -1, label)
  }

  clear(): void {
    this._versions.clear()
  }
}

export const cloudSyncService = new CloudSyncService()
