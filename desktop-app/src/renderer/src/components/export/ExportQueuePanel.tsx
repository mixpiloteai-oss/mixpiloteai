// ─── ExportQueuePanel ─────────────────────────────────────────────────────────
// Shows all queued/active/completed export jobs with status badges,
// progress bars, and cancel/remove actions.

import { useEngineExportStore } from '../../store/engineExportStore'
import type { ExportJob, ExportJobStatus } from '../../audio/export/ExportQueue'

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<ExportJobStatus, string> = {
  pending:   '#64748b',
  rendering: '#3b82f6',
  encoding:  '#f59e0b',
  writing:   '#8b5cf6',
  done:      '#10b981',
  error:     '#ef4444',
  cancelled: '#64748b',
}

const STATUS_LABELS: Record<ExportJobStatus, string> = {
  pending:   'Pending',
  rendering: 'Rendering…',
  encoding:  'Encoding…',
  writing:   'Writing…',
  done:      'Done',
  error:     'Error',
  cancelled: 'Cancelled',
}

function StatusBadge({ status }: { status: ExportJobStatus }) {
  const color = STATUS_COLORS[status]
  const isSpinning = status === 'rendering' || status === 'encoding' || status === 'writing'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '2px 8px', borderRadius: '999px', fontSize: '10px',
      fontWeight: 600, background: `${color}22`, color,
    }}>
      {isSpinning && <SpinnerIcon />}
      {status === 'done' && '✓ '}
      {status === 'error' && '✗ '}
      {status === 'cancelled' && '✗ '}
      {STATUS_LABELS[status]}
    </span>
  )
}

function SpinnerIcon() {
  return (
    <span style={{
      display: 'inline-block',
      width: '8px', height: '8px',
      border: '1.5px solid currentColor',
      borderTopColor: 'transparent',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
    }} />
  )
}

// ── Job row ───────────────────────────────────────────────────────────────────

function JobRow({ job, onCancel, onRemove }: {
  job: ExportJob
  onCancel: (id: string) => void
  onRemove: (id: string) => void
}) {
  const canCancel = job.status === 'pending' || job.status === 'rendering'
  const canRemove = job.status === 'done' || job.status === 'error' || job.status === 'cancelled'

  return (
    <div style={{
      background: '#0c0c14',
      border: '1px solid #1c1c2e',
      borderRadius: '8px',
      padding: '10px 12px',
      marginBottom: '8px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#e2e8f0' }}>{job.name}</span>
          <span style={{ fontSize: '10px', color: '#475569', textTransform: 'uppercase' }}>{job.format}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <StatusBadge status={job.status} />
          {canCancel && (
            <button
              onClick={() => onCancel(job.id)}
              style={{ fontSize: '10px', color: '#ef4444', cursor: 'pointer', background: 'none', border: 'none', padding: '2px 4px' }}
            >
              Cancel
            </button>
          )}
          {canRemove && (
            <button
              onClick={() => onRemove(job.id)}
              style={{ fontSize: '10px', color: '#64748b', cursor: 'pointer', background: 'none', border: 'none', padding: '2px 4px' }}
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ background: '#1e293b', borderRadius: '4px', height: '4px', overflow: 'hidden' }}>
        <div
          style={{
            width: `${job.progress}%`,
            height: '100%',
            background: job.status === 'error' ? '#ef4444' : '#6366f1',
            transition: 'width 0.2s ease',
          }}
        />
      </div>

      {job.error && (
        <p style={{ fontSize: '10px', color: '#ef4444', marginTop: '4px' }}>{job.error}</p>
      )}
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function ExportQueuePanel() {
  const { jobs, isRunning, cancelJob, removeJob, clearCompleted, startQueue } = useEngineExportStore()

  const hasCompleted = jobs.some(j =>
    j.status === 'done' || j.status === 'error' || j.status === 'cancelled'
  )
  const hasPending = jobs.some(j => j.status === 'pending')

  return (
    <div style={{ padding: '16px', fontFamily: 'system-ui, sans-serif', minWidth: '340px' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
        <button
          onClick={() => void startQueue()}
          disabled={isRunning || !hasPending}
          style={{
            padding: '6px 14px',
            borderRadius: '6px',
            background: isRunning || !hasPending ? '#1e293b' : '#6366f1',
            color: isRunning || !hasPending ? '#475569' : '#fff',
            border: 'none',
            fontSize: '12px',
            fontWeight: 600,
            cursor: isRunning || !hasPending ? 'default' : 'pointer',
          }}
        >
          {isRunning ? 'Running…' : 'Start Queue'}
        </button>

        <button
          onClick={clearCompleted}
          disabled={!hasCompleted}
          style={{
            padding: '6px 14px',
            borderRadius: '6px',
            background: 'transparent',
            color: hasCompleted ? '#64748b' : '#2d3748',
            border: `1px solid ${hasCompleted ? '#334155' : '#1e293b'}`,
            fontSize: '12px',
            cursor: hasCompleted ? 'pointer' : 'default',
          }}
        >
          Clear Completed
        </button>

        <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#475569' }}>
          {jobs.length} job{jobs.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Job list */}
      {jobs.length === 0 ? (
        <p style={{ color: '#475569', fontSize: '12px', textAlign: 'center', padding: '24px 0' }}>
          No export jobs. Configure and start an export above.
        </p>
      ) : (
        jobs.map(job => (
          <JobRow
            key={job.id}
            job={job}
            onCancel={cancelJob}
            onRemove={removeJob}
          />
        ))
      )}

      {/* Inline style for spinner animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
