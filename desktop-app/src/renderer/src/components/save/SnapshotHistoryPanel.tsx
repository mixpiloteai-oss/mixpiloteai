import { useState, useEffect, useCallback } from 'react'
import { getAutoSaveEngine }    from '../../audio/save/AutoSaveEngine'
import { getProjectSerializer } from '../../audio/save/ProjectSerializer'
import type { ProjectSnapshot } from '../../audio/save/types'

// ─── SnapshotHistoryPanel ─────────────────────────────────────────────────────

interface Props { onClose: () => void }

const TYPE_COLOR: Record<ProjectSnapshot['type'], string> = {
  auto:         '#64748b',
  manual:       '#7c3aed',
  crash:        '#ef4444',
  backup:       '#06b6d4',
  'pre-action': '#f59e0b',
}

const TYPE_LABEL: Record<ProjectSnapshot['type'], string> = {
  auto:         'auto',
  manual:       'manual',
  crash:        'crash',
  backup:       'backup',
  'pre-action': 'pre-action',
}

export default function SnapshotHistoryPanel({ onClose }: Props) {
  const [snapshots, setSnapshots] = useState<ProjectSnapshot[]>([])
  const [saving,    setSaving]    = useState(false)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [error,     setError]     = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const snaps = await getAutoSaveEngine().listSnapshots()
      setSnapshots(snaps)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  async function handleSaveNow() {
    setSaving(true)
    setError(null)
    try {
      await getAutoSaveEngine().saveNow('Manual save')
      await refresh()
    } finally {
      setSaving(false)
    }
  }

  async function handleRestore(snap: ProjectSnapshot) {
    setError(null)
    const ser   = getProjectSerializer()
    const valid = ser.verify(snap)
    if (!valid) {
      setError(`Snapshot "${snap.label}" failed integrity check — may be corrupted.`)
      return
    }
    setRestoring(snap.id)
    try {
      await getAutoSaveEngine().saveNow('Pre-restore backup')
      ser.restore(snap.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restore failed')
    } finally {
      setRestoring(null)
    }
  }

  async function handleDelete(snap: ProjectSnapshot) {
    await getAutoSaveEngine().deleteSnapshot(snap.id)
    await refresh()
  }

  return (
    <div style={{
      position:      'fixed',
      top:           36,     // below TitleBar
      right:         0,
      width:         300,
      height:        'calc(100% - 36px - 24px)',  // minus TitleBar + StatusBar
      background:    '#0b0b14',
      borderLeft:    '1px solid #1c1c2e',
      zIndex:        500,
      display:       'flex',
      flexDirection: 'column',
      boxShadow:     '-8px 0 24px rgba(0,0,0,0.4)',
    }}>
      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        '10px 14px',
        borderBottom:   '1px solid #1c1c2e',
        flexShrink:     0,
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#94a3b8' }}>
          SAVE HISTORY
        </span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            onClick={handleSaveNow}
            disabled={saving}
            style={{
              padding:      '3px 9px',
              borderRadius: 4,
              fontSize:     10,
              background:   'rgba(124,58,237,0.12)',
              border:       '1px solid rgba(124,58,237,0.25)',
              color:        '#a78bfa',
              cursor:       saving ? 'default' : 'pointer',
            }}
          >
            {saving ? '…' : '+ Save Now'}
          </button>
          <button
            onClick={onClose}
            style={{
              width:          22,
              height:         22,
              borderRadius:   4,
              background:     'transparent',
              border:         '1px solid #1c1c2e',
              color:          '#475569',
              fontSize:       11,
              cursor:         'pointer',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* ── Error banner ──────────────────────────────────────────────────────── */}
      {error && (
        <div style={{ padding: '8px 14px', background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid rgba(239,68,68,0.2)' }}>
          <p style={{ fontSize: 10, color: '#ef4444' }}>{error}</p>
          <button onClick={() => setError(null)} style={{ fontSize: 9, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Dismiss</button>
        </div>
      )}

      {/* ── Snapshot list ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {snapshots.length === 0 ? (
          <p style={{ fontSize: 10, color: '#334155', textAlign: 'center', marginTop: 40 }}>
            No snapshots yet — save your project to create one.
          </p>
        ) : (
          snapshots.map(snap => {
            const d   = new Date(snap.createdAt)
            const ts  = d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            const kb  = Math.round(snap.sizeBytes / 1024)
            const col = TYPE_COLOR[snap.type]
            const busy = restoring === snap.id

            return (
              <div
                key={snap.id}
                style={{
                  display:      'flex',
                  alignItems:   'flex-start',
                  gap:          10,
                  padding:      '9px 14px',
                  borderBottom: '1px solid rgba(255,255,255,0.03)',
                  transition:   'background 0.1s',
                }}
              >
                {/* Type indicator */}
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: col, marginTop: 5, flexShrink: 0 }} />

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize:     11,
                    color:        '#94a3b8',
                    marginBottom: 2,
                    overflow:     'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace:   'nowrap',
                  }}>
                    {snap.label}
                  </p>
                  <p style={{ fontSize: 9, color: '#334155' }}>
                    {ts} · {kb} KB · <span style={{ color: col }}>{TYPE_LABEL[snap.type]}</span>
                  </p>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' }}>
                  <button
                    onClick={() => handleRestore(snap)}
                    disabled={!!restoring}
                    title="Restore this snapshot"
                    style={{
                      padding:      '2px 7px',
                      borderRadius: 3,
                      fontSize:     9,
                      background:   busy ? '#1c1c2e' : 'rgba(124,58,237,0.12)',
                      border:       '1px solid rgba(124,58,237,0.25)',
                      color:        busy ? '#334155' : '#a78bfa',
                      cursor:       restoring ? 'default' : 'pointer',
                    }}
                  >
                    {busy ? '…' : 'Restore'}
                  </button>
                  <button
                    onClick={() => handleDelete(snap)}
                    disabled={!!restoring}
                    title="Delete this snapshot"
                    style={{
                      width:          20,
                      height:         20,
                      borderRadius:   3,
                      background:     'transparent',
                      border:         '1px solid #1c1c2e',
                      color:          '#475569',
                      fontSize:       10,
                      cursor:         restoring ? 'default' : 'pointer',
                      display:        'flex',
                      alignItems:     'center',
                      justifyContent: 'center',
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* ── Footer stats ──────────────────────────────────────────────────────── */}
      <div style={{
        padding:      '8px 14px',
        borderTop:    '1px solid #1c1c2e',
        fontSize:     9,
        color:        '#334155',
        flexShrink:   0,
      }}>
        {snapshots.length} snapshot{snapshots.length !== 1 ? 's' : ''} · max 20 stored locally
      </div>
    </div>
  )
}
