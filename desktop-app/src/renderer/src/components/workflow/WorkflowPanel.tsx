// ─── WorkflowPanel ────────────────────────────────────────────────────────────
// AI Workflow Assistant panel — non-blocking, no modal overlays.

import React from 'react'
import { useWorkflowStore } from '../../store/workflowStore'
import type { WorkflowAction } from '../../audio/workflow/WorkflowActionQueue'
import type { MixingIssueLevel } from '../../audio/workflow/MixingAssistant'

function ScoreColor(score: number): string {
  if (score >= 70) return '#10b981'
  if (score >= 40) return '#f59e0b'
  return '#ef4444'
}

function IssueLevelBadge({ level }: { level: MixingIssueLevel }): React.ReactElement {
  const colors: Record<MixingIssueLevel, { bg: string; text: string; label: string }> = {
    critical: { bg: '#7f1d1d', text: '#fca5a5', label: 'CRITICAL' },
    warning:  { bg: '#78350f', text: '#fcd34d', label: 'WARNING'  },
    info:     { bg: '#1e3a5f', text: '#93c5fd', label: 'INFO'     },
  }
  const cfg = colors[level]
  return (
    <span
      style={{
        fontSize:        10,
        fontWeight:      700,
        padding:         '1px 6px',
        borderRadius:    4,
        backgroundColor: cfg.bg,
        color:           cfg.text,
        marginRight:     6,
        flexShrink:      0,
      }}
    >
      {cfg.label}
    </span>
  )
}

function ActionRow({
  action,
  onConfirm,
  onDismiss,
}: {
  action: WorkflowAction
  onConfirm: (id: string) => void
  onDismiss: (id: string) => void
}): React.ReactElement {
  return (
    <div
      style={{
        display:         'flex',
        alignItems:      'center',
        gap:             8,
        padding:         '6px 8px',
        backgroundColor: '#1f2937',
        borderRadius:    6,
        marginBottom:    4,
      }}
    >
      <span style={{ flex: 1, fontSize: 12, color: '#d1d5db' }}>{action.description}</span>
      <button
        onClick={() => onConfirm(action.id)}
        title="Apply"
        style={{
          background:   '#10b981',
          color:        '#fff',
          border:       'none',
          borderRadius: 4,
          padding:      '2px 8px',
          cursor:       'pointer',
          fontSize:     12,
          fontWeight:   700,
        }}
      >
        ✓
      </button>
      <button
        onClick={() => onDismiss(action.id)}
        title="Skip"
        style={{
          background:   '#374151',
          color:        '#9ca3af',
          border:       'none',
          borderRadius: 4,
          padding:      '2px 8px',
          cursor:       'pointer',
          fontSize:     12,
          fontWeight:   700,
        }}
      >
        ✗
      </button>
    </div>
  )
}

export function WorkflowPanel(): React.ReactElement {
  const {
    enabled,
    analysis,
    pendingActions,
    analyzing,
    tipIndex,
    setEnabled,
    runAnalysis,
    confirmAction,
    dismissAction,
    nextTip,
    applyColorSuggestions,
    applyNameSuggestions,
  } = useWorkflowStore()

  const tips     = analysis?.tips ?? []
  const tip      = tips[tipIndex] ?? null
  const hasTips  = tips.length > 0

  const prevTip = (): void => {
    const count = tips.length
    if (count > 0) {
      useWorkflowStore.setState({ tipIndex: (tipIndex - 1 + count) % count })
    }
  }

  const containerStyle: React.CSSProperties = {
    position:        'relative',
    width:           '100%',
    backgroundColor: '#111827',
    color:           '#f3f4f6',
    fontFamily:      'system-ui, sans-serif',
    padding:         16,
    boxSizing:       'border-box',
    borderRadius:    8,
    display:         'flex',
    flexDirection:   'column',
    gap:             12,
    minWidth:        280,
  }

  const disabledOverlayStyle: React.CSSProperties = {
    position:        'absolute',
    inset:           0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius:    8,
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    zIndex:          10,
  }

  const sectionTitleStyle: React.CSSProperties = {
    fontSize:     11,
    fontWeight:   700,
    color:        '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom:  6,
  }

  return (
    <div style={containerStyle}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#f9fafb' }}>
          Workflow Assistant
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Enable toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 12, color: '#9ca3af' }}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              style={{ accentColor: '#10b981' }}
            />
            Enable
          </label>

          {/* Analyse button */}
          <button
            onClick={() => { void runAnalysis() }}
            disabled={analyzing || !enabled}
            style={{
              background:   analyzing ? '#374151' : '#3b82f6',
              color:        '#fff',
              border:       'none',
              borderRadius: 6,
              padding:      '4px 12px',
              cursor:       analyzing || !enabled ? 'not-allowed' : 'pointer',
              fontSize:     12,
              fontWeight:   600,
              display:      'flex',
              alignItems:   'center',
              gap:          6,
              opacity:      !enabled ? 0.5 : 1,
            }}
          >
            {analyzing ? (
              <>
                <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span>
                Analyzing…
              </>
            ) : 'Analyser'}
          </button>
        </div>
      </div>

      {/* ── Score ── */}
      {analysis && (
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <div style={{ fontSize: 48, fontWeight: 900, color: ScoreColor(analysis.score), lineHeight: 1 }}>
            {analysis.score}
          </div>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>Workflow Score</div>
        </div>
      )}

      {/* ── Mixing Issues ── */}
      {analysis && analysis.mixing.issues.length > 0 && (
        <div>
          <div style={sectionTitleStyle}>Mixing Issues</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {analysis.mixing.issues.map(issue => (
              <div
                key={issue.id}
                style={{
                  display:         'flex',
                  alignItems:      'flex-start',
                  padding:         '6px 8px',
                  backgroundColor: '#1f2937',
                  borderRadius:    6,
                  fontSize:        12,
                }}
              >
                <IssueLevelBadge level={issue.level} />
                <div>
                  <div style={{ fontWeight: 600, color: '#e5e7eb', marginBottom: 2 }}>{issue.title}</div>
                  <div style={{ color: '#9ca3af', fontSize: 11 }}>{issue.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Organization ── */}
      {analysis && (analysis.organization.colors.length > 0 || analysis.organization.names.length > 0) && (
        <div>
          <div style={sectionTitleStyle}>Organization</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {analysis.organization.colors.length > 0 && (
              <button
                onClick={applyColorSuggestions}
                style={{
                  background:   '#374151',
                  color:        '#d1d5db',
                  border:       '1px solid #4b5563',
                  borderRadius: 6,
                  padding:      '4px 10px',
                  cursor:       'pointer',
                  fontSize:     11,
                  fontWeight:   600,
                }}
              >
                🎨 {analysis.organization.colors.length} color suggestions
              </button>
            )}
            {analysis.organization.names.length > 0 && (
              <button
                onClick={applyNameSuggestions}
                style={{
                  background:   '#374151',
                  color:        '#d1d5db',
                  border:       '1px solid #4b5563',
                  borderRadius: 6,
                  padding:      '4px 10px',
                  cursor:       'pointer',
                  fontSize:     11,
                  fontWeight:   600,
                }}
              >
                ✏️ {analysis.organization.names.length} rename suggestions
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Pending Actions ── */}
      {pendingActions.length > 0 && (
        <div>
          <div style={sectionTitleStyle}>Pending Actions ({pendingActions.length})</div>
          {pendingActions.map(action => (
            <ActionRow
              key={action.id}
              action={action}
              onConfirm={confirmAction}
              onDismiss={dismissAction}
            />
          ))}
        </div>
      )}

      {/* ── Tips Carousel ── */}
      {hasTips && tip && (
        <div
          style={{
            backgroundColor: '#1f2937',
            borderRadius:    8,
            padding:         10,
          }}
        >
          <div style={{ ...sectionTitleStyle, marginBottom: 4 }}>Tip</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e5e7eb', marginBottom: 4 }}>
            {tip.title}
          </div>
          <div style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.5 }}>
            {tip.body}
          </div>
          {tip.shortcut && (
            <div style={{ marginTop: 6 }}>
              <kbd
                style={{
                  background:   '#374151',
                  color:        '#d1d5db',
                  borderRadius: 4,
                  padding:      '1px 6px',
                  fontSize:     10,
                  fontFamily:   'monospace',
                  border:       '1px solid #4b5563',
                }}
              >
                {tip.shortcut}
              </kbd>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginTop: 8 }}>
            <button
              onClick={prevTip}
              style={{
                background:   '#374151',
                color:        '#9ca3af',
                border:       'none',
                borderRadius: 4,
                padding:      '2px 8px',
                cursor:       'pointer',
                fontSize:     12,
              }}
            >
              ‹
            </button>
            <span style={{ fontSize: 11, color: '#4b5563', alignSelf: 'center' }}>
              {tipIndex + 1} / {tips.length}
            </span>
            <button
              onClick={nextTip}
              style={{
                background:   '#374151',
                color:        '#9ca3af',
                border:       'none',
                borderRadius: 4,
                padding:      '2px 8px',
                cursor:       'pointer',
                fontSize:     12,
              }}
            >
              ›
            </button>
          </div>
        </div>
      )}

      {/* ── Template Match ── */}
      {analysis?.templateMatch.template && (
        <div>
          <div style={sectionTitleStyle}>Template Match</div>
          <div
            style={{
              backgroundColor: '#1f2937',
              borderRadius:    6,
              padding:         '8px 10px',
              fontSize:        12,
            }}
          >
            <div style={{ fontWeight: 600, color: '#e5e7eb', marginBottom: 4 }}>
              Matched: {analysis.templateMatch.template.name}
            </div>
            {analysis.templateMatch.diff && analysis.templateMatch.diff.missingTracks.length > 0 && (
              <div style={{ color: '#9ca3af' }}>
                Missing tracks:
                <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                  {analysis.templateMatch.diff.missingTracks.map(t => (
                    <li key={t.name} style={{ color: '#f59e0b', fontSize: 11 }}>{t.name}</li>
                  ))}
                </ul>
              </div>
            )}
            {analysis.templateMatch.diff && analysis.templateMatch.diff.bpmDiff !== 0 && (
              <div style={{ marginTop: 4, color: '#9ca3af', fontSize: 11 }}>
                BPM diff: {analysis.templateMatch.diff.bpmDiff > 0 ? '+' : ''}{analysis.templateMatch.diff.bpmDiff}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {!analysis && !analyzing && (
        <div style={{ textAlign: 'center', color: '#4b5563', fontSize: 12, padding: '8px 0' }}>
          Click Analyser to run the workflow analysis.
        </div>
      )}

      {/* ── Disabled overlay ── */}
      {!enabled && (
        <div style={disabledOverlayStyle}>
          <span style={{ color: '#6b7280', fontSize: 13 }}>Workflow Assistant is disabled</span>
        </div>
      )}
    </div>
  )
}

export default WorkflowPanel
