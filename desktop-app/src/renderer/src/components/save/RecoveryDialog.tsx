import { useState, useEffect } from 'react'
import { getProjectSerializer } from '../../audio/save/ProjectSerializer'
import type { ProjectSnapshot } from '../../audio/save/types'

interface CrashInfo {
  hadCrash:   boolean
  checkpoint: ProjectSnapshot | null
}

// ─── RecoveryDialog ───────────────────────────────────────────────────────────
// Shown once on startup when the main process detects an unclean shutdown.

export default function RecoveryDialog() {
  const [info,    setInfo]    = useState<CrashInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    // Active poll — in case main process sends the event before listeners register
    window.electronAPI?.crashCheck()
      .then(raw => {
        const ci = raw as CrashInfo
        if (ci.hadCrash) setInfo(ci)
      })
      .catch(() => {})

    // Passive listener — sent after window ready-to-show
    window.electronAPI?.onCrashRecoveryAvailable(raw => {
      const ci = raw as CrashInfo
      if (ci.hadCrash) setInfo(ci)
    })

    return () => window.electronAPI?.removeAllListeners('crash-recovery-available')
  }, [])

  async function recover() {
    if (!info?.checkpoint) { await dismiss(); return }
    setLoading(true)
    setError(null)
    try {
      const ser   = getProjectSerializer()
      const valid = ser.verify(info.checkpoint)
      if (!valid) throw new Error('Snapshot integrity check failed (checksum mismatch)')
      ser.restore(info.checkpoint.data)
      await window.electronAPI?.crashClearCheckpoint()
      setInfo(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restore failed')
      setLoading(false)
    }
  }

  async function dismiss() {
    await window.electronAPI?.crashClearCheckpoint().catch(() => {})
    setInfo(null)
  }

  if (!info) return null

  const cp      = info.checkpoint
  const savedAt = cp ? new Date(cp.createdAt).toLocaleString() : null
  const sizeKB  = cp ? Math.round(cp.sizeBytes / 1024) : 0

  return (
    <div style={{
      position:       'fixed',
      inset:          0,
      zIndex:         9999,
      background:     'rgba(0,0,0,0.75)',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
    }}>
      <div style={{
        background:   '#0e0e1c',
        border:       '1px solid rgba(239,68,68,0.3)',
        borderRadius: 14,
        padding:      28,
        width:        380,
        boxShadow:    '0 0 60px rgba(239,68,68,0.12)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <div style={{
            width:          34,
            height:         34,
            borderRadius:   8,
            background:     'rgba(239,68,68,0.12)',
            border:         '1px solid rgba(239,68,68,0.25)',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            fontSize:       16,
            color:          '#ef4444',
            flexShrink:     0,
          }}>
            !
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>
              Session Recovery
            </p>
            <p style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
              Neurotek Studio did not close cleanly last time
            </p>
          </div>
        </div>

        {/* Checkpoint info */}
        {cp ? (
          <div style={{
            background:   'rgba(255,255,255,0.03)',
            border:       '1px solid #1c1c2e',
            borderRadius: 8,
            padding:      '10px 14px',
            marginBottom: 18,
          }}>
            <p style={{ fontSize: 10, color: '#64748b', marginBottom: 6 }}>Recovery point found</p>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>
              {cp.label}
            </p>
            <p style={{ fontSize: 10, color: '#475569' }}>
              {savedAt} · {sizeKB} KB
            </p>
          </div>
        ) : (
          <p style={{ fontSize: 11, color: '#64748b', marginBottom: 18 }}>
            No recovery point found — the last session state could not be saved before the crash.
          </p>
        )}

        {/* Error */}
        {error && (
          <p style={{ fontSize: 10, color: '#ef4444', marginBottom: 12, padding: '6px 10px', background: 'rgba(239,68,68,0.08)', borderRadius: 6 }}>
            {error}
          </p>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          {cp && (
            <button
              onClick={recover}
              disabled={loading}
              style={{
                flex:         1,
                padding:      '9px 0',
                borderRadius: 7,
                fontSize:     12,
                fontWeight:   600,
                background:   loading
                  ? 'rgba(255,255,255,0.05)'
                  : 'linear-gradient(135deg, #7c3aed, #a855f7)',
                border:       'none',
                color:        loading ? '#475569' : '#fff',
                cursor:       loading ? 'default' : 'pointer',
                transition:   'opacity 0.1s',
              }}
            >
              {loading ? 'Restoring…' : 'Recover Session'}
            </button>
          )}
          <button
            onClick={dismiss}
            disabled={loading}
            style={{
              flex:         cp ? undefined : 1,
              padding:      '9px 18px',
              borderRadius: 7,
              fontSize:     12,
              background:   'transparent',
              border:       '1px solid #1c1c2e',
              color:        '#64748b',
              cursor:       loading ? 'default' : 'pointer',
              whiteSpace:   'nowrap',
            }}
          >
            Start Fresh
          </button>
        </div>
      </div>
    </div>
  )
}
