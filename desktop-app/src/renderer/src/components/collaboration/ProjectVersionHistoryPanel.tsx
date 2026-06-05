// ─── ProjectVersionHistoryPanel ───────────────────────────────────────────────
// Panel showing cloud version history from the backend save service.

import React, { useState, useEffect, useCallback } from 'react'
import { collaborationClient } from '../../services/CollaborationClient'
import { getProjectSerializer } from '../../audio/save/ProjectSerializer'

interface VersionMeta {
  id: string
  projectId: string
  label: string
  type: 'manual' | 'auto' | 'pre-action'
  createdAt: number
  sizeBytes: number
  checksum: string
}

interface VersionFull extends VersionMeta {
  data: unknown
}

interface Props {
  projectId: string
  onClose: () => void
}

const PAGE_SIZE = 20

function getApiUrl(): string {
  if (typeof window !== 'undefined') {
    const w = window as typeof window & { __APP_CONFIG__?: { apiUrl?: string } }
    return w.__APP_CONFIG__?.apiUrl ?? 'http://localhost:4000'
  }
  return 'http://localhost:4000'
}

function authFetch(url: string, opts: RequestInit = {}): Promise<Response> {
  const token = (collaborationClient as unknown as { authToken?: string }).authToken
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(opts.headers as Record<string, string> | undefined),
  }
  if (token) headers['authorization'] = `Bearer ${token}`
  return fetch(url, { ...opts, headers })
}

function relativeTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const typeBadgeColors: Record<string, string> = {
  manual: '#89b4fa',
  auto: '#a6e3a1',
  'pre-action': '#f9e2af',
}

export function ProjectVersionHistoryPanel({ projectId, onClose }: Props): React.ReactElement {
  const [versions, setVersions] = useState<VersionMeta[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [creatingBackup, setCreatingBackup] = useState(false)

  const apiUrl = getApiUrl()

  const loadVersions = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const res = await authFetch(`${apiUrl}/api/save/${projectId}/versions`)
      if (!res.ok) {
        const body = await res.json() as { error?: string }
        setError(body.error ?? 'Failed to load versions')
        return
      }
      const body = await res.json() as { data?: VersionMeta[] }
      const list = (body.data ?? []).sort((a, b) => b.createdAt - a.createdAt)
      setVersions(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load versions')
    } finally {
      setLoading(false)
    }
  }, [projectId, apiUrl])

  useEffect(() => {
    void loadVersions()
  }, [loadVersions])

  const handleRestore = async (version: VersionMeta): Promise<void> => {
    setRestoringId(version.id)
    setError(null)
    try {
      const serializer = getProjectSerializer()
      const currentData = serializer.collect()
      const res = await authFetch(
        `${apiUrl}/api/save/${projectId}/versions/${version.id}/restore`,
        {
          method: 'POST',
          body: JSON.stringify({ currentData }),
        },
      )
      if (!res.ok) {
        const body = await res.json() as { error?: string }
        setError(body.error ?? 'Restore failed')
        return
      }
      const body = await res.json() as { data?: VersionFull }
      const versionData = body.data?.data
      if (versionData !== undefined) {
        serializer.restore(versionData as Parameters<typeof serializer.restore>[0])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Restore failed')
    } finally {
      setRestoringId(null)
    }
  }

  const handleCreateBackup = async (): Promise<void> => {
    setCreatingBackup(true)
    setError(null)
    try {
      const serializer = getProjectSerializer()
      const data = serializer.collect()
      const res = await authFetch(`${apiUrl}/api/save/${projectId}/versions`, {
        method: 'POST',
        body: JSON.stringify({ label: 'Manual backup', data, type: 'manual' }),
      })
      if (!res.ok) {
        const body = await res.json() as { error?: string }
        setError(body.error ?? 'Backup failed')
        return
      }
      await loadVersions()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Backup failed')
    } finally {
      setCreatingBackup(false)
    }
  }

  const displayed = versions.slice(0, page * PAGE_SIZE)
  const hasMore = displayed.length < versions.length

  return (
    <div
      style={{
        background: '#1e1e2e',
        borderRadius: 12,
        padding: 24,
        color: '#cdd6f4',
        minWidth: 480,
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Version History</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => void handleCreateBackup()}
            disabled={creatingBackup}
            style={{
              background: '#313244',
              border: '1px solid #45475a',
              borderRadius: 6,
              color: '#cdd6f4',
              cursor: creatingBackup ? 'not-allowed' : 'pointer',
              padding: '6px 14px',
              fontSize: 13,
            }}
          >
            {creatingBackup ? 'Saving…' : 'Create backup'}
          </button>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#cdd6f4', cursor: 'pointer', fontSize: 20 }}
          >
            ×
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#45475a', color: '#f38ba8', padding: '8px 12px', borderRadius: 6, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {loading && versions.length === 0 && (
        <p style={{ color: '#6c7086' }}>Loading versions…</p>
      )}

      <div style={{ overflowY: 'auto', flex: 1 }}>
        {versions.length === 0 && !loading && (
          <p style={{ color: '#6c7086', fontSize: 13 }}>No versions yet. Create a backup to get started.</p>
        )}

        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {displayed.map((v) => (
            <li
              key={v.id}
              style={{
                background: '#313244',
                borderRadius: 8,
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{v.label || 'Untitled'}</div>
                <div style={{ fontSize: 11, color: '#6c7086', marginTop: 2 }}>
                  {relativeTime(v.createdAt)} · {formatBytes(v.sizeBytes)}
                </div>
              </div>
              <span
                style={{
                  background: typeBadgeColors[v.type] ?? '#45475a',
                  color: '#1e1e2e',
                  borderRadius: 9999,
                  padding: '2px 8px',
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'capitalize',
                }}
              >
                {v.type}
              </span>
              <button
                onClick={() => void handleRestore(v)}
                disabled={restoringId === v.id}
                style={{
                  background: '#89b4fa',
                  border: 'none',
                  borderRadius: 6,
                  color: '#1e1e2e',
                  cursor: restoringId === v.id ? 'not-allowed' : 'pointer',
                  padding: '5px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {restoringId === v.id ? 'Restoring…' : 'Restore'}
              </button>
            </li>
          ))}
        </ul>

        {hasMore && (
          <button
            onClick={() => setPage((p) => p + 1)}
            style={{
              marginTop: 12,
              background: '#313244',
              border: '1px solid #45475a',
              borderRadius: 6,
              color: '#cdd6f4',
              cursor: 'pointer',
              padding: '8px 16px',
              width: '100%',
              fontSize: 13,
            }}
          >
            Load more
          </button>
        )}
      </div>
    </div>
  )
}

export default ProjectVersionHistoryPanel
