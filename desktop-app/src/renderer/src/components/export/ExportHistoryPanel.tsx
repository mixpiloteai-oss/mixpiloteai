// ─── ExportHistoryPanel ────────────────────────────────────────────────────────
// Displays the list of completed/failed/cancelled export jobs.

import { useEngineExportStore } from '../../store/engineExportStore'
import type { ExportJobStatus } from '../../audio/export/ExportQueue'

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString()
}

function formatSize(bytes: number): string {
  if (bytes <= 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function StatusBadge({ status }: { status: ExportJobStatus }) {
  const colors: Record<ExportJobStatus, { bg: string; text: string }> = {
    done:      { bg: '#166534', text: '#4ade80' },
    error:     { bg: '#3d1515', text: '#f87171' },
    cancelled: { bg: '#1e1e1e', text: '#64748b' },
    pending:   { bg: '#1e293b', text: '#94a3b8' },
    rendering: { bg: '#1e1833', text: '#818cf8' },
    encoding:  { bg: '#1e1833', text: '#818cf8' },
    writing:   { bg: '#1e1833', text: '#818cf8' },
  }
  const { bg, text } = colors[status] ?? colors.pending
  return (
    <span style={{
      padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700,
      background: bg, color: text, textTransform: 'uppercase',
    }}>
      {status}
    </span>
  )
}

export function ExportHistoryPanel() {
  const { history, clearHistory } = useEngineExportStore()

  if (history.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 16px', color: '#475569' }}>
        <p style={{ fontSize: '13px', margin: 0 }}>No export history yet.</p>
        <p style={{ fontSize: '11px', marginTop: '8px' }}>
          Completed exports will appear here.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ fontSize: '11px', color: '#475569' }}>
          {history.length} export{history.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={clearHistory}
          style={{
            padding: '4px 10px', borderRadius: '6px',
            background: 'transparent', border: '1px solid #1e293b',
            color: '#64748b', fontSize: '11px', cursor: 'pointer',
          }}
        >
          Clear History
        </button>
      </div>

      {/* History list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {history.map(job => (
          <div
            key={job.id}
            style={{
              padding: '10px 12px',
              background: '#0a0a14',
              borderRadius: '8px',
              border: '1px solid #1c1c2e',
            }}
          >
            {/* Row 1: name + format + status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#e2e8f0', flex: 1 }}>
                {job.name}
              </span>
              <span style={{
                padding: '1px 6px', borderRadius: '3px', fontSize: '10px',
                background: '#1e293b', color: '#818cf8', textTransform: 'uppercase',
              }}>
                {job.format}
              </span>
              <StatusBadge status={job.status} />
            </div>

            {/* Row 2: path / error */}
            {job.status === 'error' && job.error ? (
              <p style={{ margin: 0, fontSize: '10px', color: '#f87171' }}>
                Error: {job.error}
              </p>
            ) : (
              <p style={{ margin: 0, fontSize: '10px', color: '#475569', wordBreak: 'break-all' }}>
                {job.outputPath}
              </p>
            )}

            {/* Row 3: date + size */}
            <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '10px', color: '#334155' }}>
              <span>{job.completedAt ? formatDate(job.completedAt) : '—'}</span>
              <span>{formatSize(job.bytesWritten)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
