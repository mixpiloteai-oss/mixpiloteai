// ─── AIActionHistoryPanel.tsx ─────────────────────────────────────────────────
// List of applied/rejected/undone AI actions with undo support.

import { useAIHubStore } from '../../store/aiHubStore'
import { aiActionManager } from '../../audio/ai/AIActionManager'

const ACTION_TYPE_LABELS: Record<string, string> = {
  'add-midi-notes':       'MIDI Add',
  'replace-midi-notes':   'MIDI Replace',
  'delete-midi-notes':    'MIDI Delete',
  'add-automation':       'Automation',
  'modify-automation':    'Auto Edit',
  'add-clip':             'Clip',
  'modify-track-settings':'Track Settings',
  'reorder-tracks':       'Reorder',
  'suggest-only':         'Suggestion',
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function AIActionHistoryPanel() {
  const { actionHistory, syncActions } = useAIHubStore()
  const totalApplied = aiActionManager.totalApplied
  const totalRejected = aiActionManager.totalRejected
  const rate = aiActionManager.acceptanceRate

  function handleUndo(id: string) {
    aiActionManager.undoAction(id)
    syncActions()
  }

  function handleClearHistory() {
    aiActionManager.clearHistory()
    syncActions()
  }

  return (
    <div
      style={{
        backgroundColor: '#12121e',
        borderRadius: '8px',
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ color: '#f1f5f9', fontSize: '13px', fontWeight: 700, margin: 0 }}>
            Action History
          </h3>
          {(totalApplied + totalRejected) > 0 && (
            <p style={{ color: '#64748b', fontSize: '11px', margin: '2px 0 0' }}>
              Accepted {Math.round(rate * 100)}% of suggestions
              {' '}({totalApplied} applied, {totalRejected} rejected)
            </p>
          )}
        </div>
        {actionHistory.length > 0 && (
          <button
            onClick={handleClearHistory}
            style={{
              background: 'none',
              border: '1px solid #374151',
              borderRadius: '4px',
              color: '#64748b',
              fontSize: '11px',
              padding: '3px 8px',
              cursor: 'pointer',
            }}
            type="button"
          >
            Clear history
          </button>
        )}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {actionHistory.length === 0 ? (
          <p style={{ color: '#475569', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>
            No action history yet.
          </p>
        ) : (
          actionHistory.map(action => {
            const statusColor =
              action.status === 'applied' ? '#22c55e' :
              action.status === 'rejected' ? '#ef4444' : '#64748b'

            return (
              <div
                key={action.id}
                style={{
                  backgroundColor: '#1a1a2e',
                  border: `1px solid ${statusColor}33`,
                  borderRadius: '6px',
                  padding: '8px 10px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ color: '#d1d5db', fontSize: '12px', fontWeight: 600 }}>
                      {action.title}
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '1px 6px',
                        borderRadius: '9999px',
                        backgroundColor: '#1e293b',
                        color: '#94a3b8',
                      }}
                    >
                      {ACTION_TYPE_LABELS[action.type] ?? action.type}
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '1px 6px',
                        borderRadius: '9999px',
                        backgroundColor: statusColor + '22',
                        color: statusColor,
                        fontWeight: 600,
                        textTransform: 'capitalize',
                      }}
                    >
                      {action.status}
                    </span>
                  </div>
                  <p style={{ color: '#64748b', fontSize: '11px', margin: '3px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {formatTime(action.createdAt)}
                    {action.appliedAt ? ` · Applied ${formatTime(action.appliedAt)}` : ''}
                  </p>
                </div>

                {action.status === 'applied' && (
                  <button
                    onClick={() => handleUndo(action.id)}
                    style={{
                      flexShrink: 0,
                      padding: '4px 10px',
                      borderRadius: '4px',
                      border: '1px solid #374151',
                      backgroundColor: 'transparent',
                      color: '#94a3b8',
                      fontSize: '11px',
                      cursor: 'pointer',
                    }}
                    type="button"
                  >
                    Undo
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
