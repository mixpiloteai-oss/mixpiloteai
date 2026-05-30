// ─── ShareProjectDialog ───────────────────────────────────────────────────────
// Modal dialog for project sharing — invite by email, manage members, access level.

import React, { useState, useEffect, useCallback } from 'react'
import { collaborationClient } from '../../services/CollaborationClient'

type Role = 'editor' | 'commenter' | 'viewer'
type Visibility = 'private' | 'team'

interface Member {
  userId: string
  name: string
  email: string
  role: Role
}

interface Props {
  projectId: string
  isOpen: boolean
  onClose: () => void
}

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

export function ShareProjectDialog({ projectId, isOpen, onClose }: Props): React.ReactElement | null {
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<Role>('editor')
  const [members, setMembers] = useState<Member[]>([])
  const [visibility, setVisibility] = useState<Visibility>('private')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const apiUrl = getApiUrl()

  const loadData = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const [permRes, teamsRes] = await Promise.all([
        authFetch(`${apiUrl}/api/collab/permissions/${projectId}`),
        authFetch(`${apiUrl}/api/teams`),
      ])
      if (permRes.ok) {
        const body = await permRes.json() as { data?: { members?: Member[]; visibility?: Visibility } }
        setMembers(body.data?.members ?? [])
        setVisibility(body.data?.visibility ?? 'private')
      }
      if (teamsRes.ok) {
        const body = await teamsRes.json() as { data?: { members?: Member[] } }
        const teamMembers = body.data?.members ?? []
        setMembers((prev) => {
          const existing = new Set(prev.map((m) => m.userId))
          const merged = [...prev, ...teamMembers.filter((m) => !existing.has(m.userId))]
          return merged
        })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [projectId, apiUrl])

  useEffect(() => {
    if (isOpen) {
      void loadData()
    } else {
      // Reset form on close
      setInviteEmail('')
      setInviteRole('editor')
      setMembers([])
      setVisibility('private')
      setError(null)
      setSuccessMsg(null)
    }
  }, [isOpen, loadData])

  const handleInvite = async (): Promise<void> => {
    if (!inviteEmail.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await authFetch(`${apiUrl}/api/collab/invite`, {
        method: 'POST',
        body: JSON.stringify({ projectId, email: inviteEmail, role: inviteRole }),
      })
      if (!res.ok) {
        const body = await res.json() as { error?: string }
        setError(body.error ?? 'Invitation failed')
        return
      }
      const msg = `Invitation sent to ${inviteEmail}`
      setSuccessMsg(msg)
      setInviteEmail('')
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invitation failed')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveMember = async (memberId: string): Promise<void> => {
    setError(null)
    try {
      const res = await authFetch(`${apiUrl}/api/teams/${projectId}/members/${memberId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setMembers((prev) => prev.filter((m) => m.userId !== memberId))
      } else {
        const body = await res.json() as { error?: string }
        setError(body.error ?? 'Remove failed')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Remove failed')
    }
  }

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background: '#1e1e2e',
          borderRadius: 12,
          padding: 24,
          minWidth: 480,
          maxWidth: 600,
          color: '#cdd6f4',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Share Project</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#cdd6f4', cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>

        {error && (
          <div style={{ background: '#45475a', color: '#f38ba8', padding: '8px 12px', borderRadius: 6, marginBottom: 12 }}>
            {error}
          </div>
        )}

        {successMsg && (
          <div style={{ background: '#313244', color: '#a6e3a1', padding: '8px 12px', borderRadius: 6, marginBottom: 12 }}>
            {successMsg}
          </div>
        )}

        {/* Section 1: Invite */}
        <section style={{ marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 14, color: '#89b4fa' }}>Share via invite</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="email"
              placeholder="Email address"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              style={{
                flex: 1,
                background: '#313244',
                border: '1px solid #45475a',
                borderRadius: 6,
                padding: '8px 12px',
                color: '#cdd6f4',
                fontSize: 14,
              }}
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as Role)}
              style={{
                background: '#313244',
                border: '1px solid #45475a',
                borderRadius: 6,
                padding: '8px 12px',
                color: '#cdd6f4',
                fontSize: 14,
              }}
            >
              <option value="editor">Editor</option>
              <option value="commenter">Commenter</option>
              <option value="viewer">Viewer</option>
            </select>
            <button
              onClick={() => void handleInvite()}
              disabled={loading || !inviteEmail.trim()}
              style={{
                background: '#89b4fa',
                color: '#1e1e2e',
                border: 'none',
                borderRadius: 6,
                padding: '8px 16px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Invite
            </button>
          </div>
        </section>

        {/* Section 2: Current members */}
        <section style={{ marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 14, color: '#89b4fa' }}>Current members</h3>
          {members.length === 0 && <p style={{ color: '#6c7086', fontSize: 13 }}>No members yet</p>}
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {members.map((m) => (
              <li
                key={m.userId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: '#313244',
                  borderRadius: 8,
                  padding: '8px 12px',
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: '#89b4fa',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 14,
                    color: '#1e1e2e',
                    flexShrink: 0,
                  }}
                >
                  {(m.name?.[0] ?? m.email[0] ?? '?').toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{m.name || m.email}</div>
                  <div style={{ fontSize: 11, color: '#6c7086' }}>{m.email}</div>
                </div>
                <span
                  style={{
                    background: '#45475a',
                    borderRadius: 9999,
                    padding: '2px 8px',
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: 'capitalize',
                  }}
                >
                  {m.role}
                </span>
                <button
                  onClick={() => void handleRemoveMember(m.userId)}
                  style={{
                    background: 'none',
                    border: '1px solid #f38ba8',
                    borderRadius: 4,
                    color: '#f38ba8',
                    cursor: 'pointer',
                    fontSize: 11,
                    padding: '2px 8px',
                  }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* Section 3: Access level */}
        <section>
          <h3 style={{ margin: '0 0 12px', fontSize: 14, color: '#89b4fa' }}>Access level</h3>
          <div style={{ display: 'flex', gap: 16 }}>
            {(['private', 'team'] as Visibility[]).map((v) => (
              <label
                key={v}
                style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14 }}
              >
                <input
                  type="radio"
                  name="visibility"
                  value={v}
                  checked={visibility === v}
                  onChange={() => setVisibility(v)}
                />
                {v === 'private' ? 'Private' : 'Team only'}
              </label>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

export default ShareProjectDialog
