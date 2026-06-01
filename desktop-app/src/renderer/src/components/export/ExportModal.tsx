// ─── ExportModal ───────────────────────────────────────────────────────────────
// Full-screen modal overlay showing export progress, ETA, stage, and controls.

import type { ExportJob } from '../../audio/export/ExportQueue'
import { exportQueue } from '../../audio/export/ExportQueue'

interface ExportModalProps {
  job:      ExportJob | null
  onClose:  () => void
  onRetry?: () => void
}

function formatEta(etaMs: number | null): string {
  if (etaMs === null || etaMs < 0) return 'Calculating…'
  if (etaMs < 1000) return '< 1s'
  const secs = Math.round(etaMs / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  const rem  = secs % 60
  return `${mins}m ${rem}s`
}

function StageDot({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  const color = done ? '#22c55e' : active ? '#6366f1' : '#1e293b'
  const textColor = done ? '#22c55e' : active ? '#818cf8' : '#475569'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{
        width: '8px', height: '8px', borderRadius: '50%',
        background: color, transition: 'background 0.3s',
        boxShadow: active ? `0 0 8px ${color}` : 'none',
      }} />
      <span style={{ fontSize: '11px', color: textColor, fontWeight: active ? 700 : 400 }}>
        {label}
      </span>
    </div>
  )
}

export function ExportModal({ job, onClose, onRetry }: ExportModalProps) {
  if (!job) return null

  const isDone       = job.status === 'done'
  const isError      = job.status === 'error'
  const isCancelled  = job.status === 'cancelled'
  const isActive     = !isDone && !isError && !isCancelled

  const handleCancel = () => {
    exportQueue.cancelJob(job.id)
  }

  const handleOpenLocation = () => {
    const dir = job.outputPath.replace(/\/[^/]+$/, '')
    const api = (globalThis as Record<string, unknown>)['electronAPI'] as
      | { openExternal?: (url: string) => Promise<void> }
      | undefined
    void api?.openExternal?.(`file://${dir}`)
  }

  const stage = job.status

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#080810', border: '1px solid #1c1c2e',
        borderRadius: '16px', padding: '32px', width: '400px',
        boxShadow: '0 24px 48px rgba(0,0,0,0.6)',
        fontFamily: 'system-ui, sans-serif', color: '#e2e8f0',
      }}>
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
              {isDone ? 'Export Complete' : isError ? 'Export Failed' : isCancelled ? 'Export Cancelled' : 'Exporting…'}
            </h2>
            <span style={{
              padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700,
              background: '#1e293b', color: '#818cf8', textTransform: 'uppercase',
            }}>
              {job.format}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>{job.name}</p>
        </div>

        {/* Progress bar */}
        <div style={{
          background: '#0f172a', borderRadius: '4px', height: '6px',
          overflow: 'hidden', marginBottom: '16px',
        }}>
          <div style={{
            height: '100%',
            width: `${job.progress}%`,
            background: isError ? '#ef4444' : isDone ? '#22c55e' : '#6366f1',
            transition: 'width 0.3s, background 0.3s',
            borderRadius: '4px',
          }} />
        </div>

        {/* Stats row */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          marginBottom: '20px', fontSize: '11px', color: '#64748b',
        }}>
          <span>{job.progress}%</span>
          {isActive && (
            <>
              <span>ETA: {formatEta(job.etaMs)}</span>
              {job.renderSpeedRatio > 0 && (
                <span>{job.renderSpeedRatio.toFixed(1)}x realtime</span>
              )}
            </>
          )}
          {isDone && job.bytesWritten > 0 && (
            <span>{(job.bytesWritten / 1024 / 1024).toFixed(1)} MB</span>
          )}
        </div>

        {/* Stage indicators */}
        <div style={{
          display: 'flex', gap: '16px', marginBottom: '24px',
          padding: '12px', background: '#0a0a14', borderRadius: '8px',
        }}>
          <StageDot label="Rendering" active={stage === 'rendering'} done={stage !== 'rendering' && stage !== 'pending'} />
          <StageDot label="Encoding"  active={stage === 'encoding'}  done={stage === 'writing' || stage === 'done'} />
          <StageDot label="Writing"   active={stage === 'writing'}   done={stage === 'done'} />
        </div>

        {/* Error message */}
        {isError && job.error && (
          <div style={{
            padding: '10px 12px', background: '#1f0f0f', border: '1px solid #3d1515',
            borderRadius: '8px', marginBottom: '20px', fontSize: '11px', color: '#f87171',
          }}>
            {job.error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {isDone && (
            <button
              onClick={handleOpenLocation}
              style={{
                flex: 1, padding: '10px', borderRadius: '8px',
                background: '#0f172a', border: '1px solid #1e293b',
                color: '#94a3b8', fontSize: '12px', cursor: 'pointer',
              }}
            >
              Open Location
            </button>
          )}

          {isError && onRetry && (
            <button
              onClick={onRetry}
              style={{
                flex: 1, padding: '10px', borderRadius: '8px',
                background: '#1e293b', border: 'none',
                color: '#e2e8f0', fontSize: '12px', cursor: 'pointer',
              }}
            >
              Retry
            </button>
          )}

          {isActive && (
            <button
              onClick={handleCancel}
              style={{
                flex: 1, padding: '10px', borderRadius: '8px',
                background: '#3d1515', border: '1px solid #7f1d1d',
                color: '#f87171', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          )}

          {(isDone || isError || isCancelled) && (
            <button
              onClick={onClose}
              style={{
                flex: 1, padding: '10px', borderRadius: '8px',
                background: isDone ? '#166534' : '#1e293b',
                border: 'none',
                color: isDone ? '#4ade80' : '#e2e8f0',
                fontSize: '12px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              {isDone ? 'Done' : 'Close'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
