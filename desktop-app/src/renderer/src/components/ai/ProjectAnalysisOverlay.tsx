// ─── ProjectAnalysisOverlay ───────────────────────────────────────────────────
// Compact analysis widget for the main toolbar or sidebar.
// Reads from useAIAssistantStore().lastAnalysis.

import { useAIAssistantStore } from '../../store/aiAssistantStore'

const STYLE_COLORS: Record<string, string> = {
  techno:          '#7c3aed',
  house:           '#06b6d4',
  ambient:         '#10b981',
  'hip-hop':       '#f59e0b',
  'drum-and-bass': '#ef4444',
  pop:             '#ec4899',
  unknown:         '#64748b',
}

export default function ProjectAnalysisOverlay() {
  const analysis = useAIAssistantStore(s => s.lastAnalysis)

  const bpm        = analysis ? String(analysis.bpm)                       : '—'
  const key        = analysis ? (analysis.detectedKey?.name ?? '—')        : '—'
  const style      = analysis ? analysis.style                              : '—'
  const energyPct  = analysis ? (analysis.energy * 100).toFixed(0) + '%'  : '—'
  const styleColor = analysis ? (STYLE_COLORS[analysis.style] ?? '#64748b') : '#64748b'

  return (
    <div
      style={{
        display:    'flex',
        alignItems: 'center',
        gap:        10,
        padding:    '0 8px',
        height:     28,
      }}
    >
      {/* BPM */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <span style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: 1 }}>BPM</span>
        <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
          {bpm}
        </span>
      </div>

      {/* Key */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <span style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: 1 }}>Key</span>
        <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{key}</span>
      </div>

      {/* Style */}
      <div
        style={{
          fontSize:     9,
          padding:      '1px 6px',
          borderRadius: 10,
          background:   `${styleColor}20`,
          border:       `1px solid ${styleColor}40`,
          color:        styleColor,
          fontWeight:   600,
          textTransform:'uppercase',
          letterSpacing: 1,
        }}
      >
        {style}
      </div>

      {/* Energy */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 9, color: '#475569' }}>E</span>
        <div style={{ width: 32, height: 3, background: '#1c1c2e', borderRadius: 2, overflow: 'hidden' }}>
          {analysis && (
            <div
              style={{
                width:        `${(analysis.energy * 100).toFixed(0)}%`,
                height:       '100%',
                background:   '#7c3aed',
                borderRadius: 2,
              }}
            />
          )}
        </div>
        <span style={{ fontSize: 9, color: '#475569', fontVariantNumeric: 'tabular-nums' }}>{energyPct}</span>
      </div>
    </div>
  )
}
