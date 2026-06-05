// ─── AIHubPanel.tsx ────────────────────────────────────────────────────────────
// Central AI interface. Integrates chat + context + suggestions + history.

import { useState, useRef, useEffect } from 'react'
import { useAIHubStore } from '../../store/aiHubStore'
import type { AIChatMessage } from '../../store/aiHubStore'
import type { ProjectSnapshot } from '../../audio/ai/MusicContextEngine'
import AIContextBadge from './AIContextBadge'
import AIActionPreviewModal from './AIActionPreviewModal'
import type { AIAction } from '../../audio/ai/AIActionManager'

const EXAMPLE_COMMANDS = [
  'fais une bass acid aggressive',
  'ajoute une montée avant le drop',
  'humanise le groove',
  'rends le kick plus punchy',
  'génère un lead tribe',
] as const

const STYLE_COLORS: Record<string, string> = {
  house:   '#3b82f6',
  techno:  '#6d28d9',
  dnb:     '#dc2626',
  trap:    '#f59e0b',
  hiphop:  '#10b981',
  jazz:    '#06b6d4',
  ambient: '#64748b',
  unknown: '#64748b',
}

function SuggestionTypeIcon({ type }: { type: string }) {
  if (type === 'warning') return <span style={{ color: '#ef4444' }}>⚠</span>
  if (type === 'fix') return <span style={{ color: '#f59e0b' }}>🔧</span>
  if (type === 'enhancement') return <span style={{ color: '#22c55e' }}>✨</span>
  return <span style={{ color: '#3b82f6' }}>💡</span>
}

function SourceDot({ source }: { source: AIChatMessage['source'] }) {
  const color = source === 'local' ? '#22c55e' : source === 'cloud' ? '#a855f7' : '#64748b'
  return (
    <span
      style={{
        display: 'inline-block',
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        backgroundColor: color,
        marginRight: '4px',
        verticalAlign: 'middle',
      }}
    />
  )
}

interface AIHubPanelProps {
  getProjectSnapshot?: () => ProjectSnapshot
}

export default function AIHubPanel({ getProjectSnapshot }: AIHubPanelProps) {
  const store = useAIHubStore()
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [contextCollapsed, setContextCollapsed] = useState(false)
  const [previewAction, setPreviewAction] = useState<AIAction | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [store.chatMessages])

  function handleSend() {
    const text = store.inputText.trim()
    if (!text || store.isProcessing || !store.enabled) return
    store.setInputText('')
    const snapshot = getProjectSnapshot ? getProjectSnapshot() : defaultSnapshot()
    void store.sendMessage(text, () => snapshot)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function defaultSnapshot(): ProjectSnapshot {
    return { bpm: 120, tracks: [], totalBars: 16, sampleRate: 44100 }
  }

  // Detect style from context summary (simple heuristic)
  const detectedStyle = store.contextSummary
    ? (['house', 'techno', 'dnb', 'trap', 'hiphop', 'jazz', 'ambient'] as const)
        .find(s => store.contextSummary.toLowerCase().includes(s)) ?? 'unknown'
    : 'unknown'

  const styleBpm = store.contextSummary
    ? parseInt(store.contextSummary.match(/(\d+)\s*BPM/i)?.[1] ?? '0', 10) || 0
    : 0

  const styleColor = STYLE_COLORS[detectedStyle] ?? STYLE_COLORS['unknown']!

  return (
    <div
      style={{
        width: '380px',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#0f0f1e',
        borderLeft: '1px solid #1e293b',
        overflow: 'hidden',
        fontSize: '13px',
        color: '#d1d5db',
      }}
    >
      {/* ─── Header ──────────────────────────────────────────────────────────── */}
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexShrink: 0,
        }}
      >
        <span style={{ fontWeight: 700, fontSize: '14px', color: '#f1f5f9' }}>AI Assistant</span>
        <div style={{ flex: 1 }} />
        {/* Auto-analyze toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#64748b', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={store.autoAnalyze}
            onChange={e => store.setAutoAnalyze(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          Auto
        </label>
        {/* Enable toggle */}
        <button
          onClick={() => store.setEnabled(!store.enabled)}
          style={{
            padding: '3px 10px',
            borderRadius: '9999px',
            border: 'none',
            backgroundColor: store.enabled ? '#22c55e22' : '#374151',
            color: store.enabled ? '#22c55e' : '#64748b',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
          type="button"
        >
          {store.enabled ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* ─── Context Strip ───────────────────────────────────────────────────── */}
      <div
        style={{
          borderBottom: '1px solid #1e293b',
          backgroundColor: styleColor + '11',
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => setContextCollapsed(c => !c)}
          style={{
            width: '100%',
            padding: '6px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
          }}
          type="button"
        >
          <span style={{ fontSize: '10px', color: '#475569' }}>{contextCollapsed ? '▶' : '▼'}</span>
          {store.contextSummary ? (
            <AIContextBadge
              contextSummary={store.contextSummary}
              style={detectedStyle}
              bpm={styleBpm}
              isStale={store.isContextStale}
            />
          ) : (
            <span style={{ color: '#475569', fontSize: '12px' }}>No context — click Analyze</span>
          )}
        </button>
      </div>

      {/* ─── Live Suggestions ────────────────────────────────────────────────── */}
      {store.liveSuggestions.length > 0 && (
        <div
          style={{
            padding: '8px 14px',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: '10px', color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Suggestions
          </span>
          {store.liveSuggestions.slice(0, 3).map(s => (
            <div
              key={s.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 8px',
                backgroundColor: '#1a1a2e',
                borderRadius: '6px',
              }}
            >
              <SuggestionTypeIcon type={s.type} />
              <span style={{ flex: 1, color: '#d1d5db', fontSize: '12px' }}>{s.title}</span>
              <button
                onClick={() => store.setInputText(s.command)}
                style={{
                  padding: '3px 8px',
                  borderRadius: '4px',
                  border: '1px solid #374151',
                  backgroundColor: 'transparent',
                  color: '#94a3b8',
                  fontSize: '11px',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
                type="button"
              >
                Use
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ─── Chat ────────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {store.chatMessages.length === 0 && (
          <p style={{ color: '#334155', fontSize: '12px', textAlign: 'center', marginTop: '20px' }}>
            Demande quelque chose à l&apos;IA...
          </p>
        )}
        {store.chatMessages.map(msg => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
              gap: '6px',
            }}
          >
            <div
              style={{
                maxWidth: '80%',
                padding: '8px 10px',
                borderRadius: '8px',
                backgroundColor: msg.role === 'user' ? '#1d4ed8' : '#1e1e2e',
                border: `1px solid ${msg.role === 'user' ? '#2563eb' : '#374151'}`,
                fontSize: '12px',
                lineHeight: 1.5,
                color: '#f1f5f9',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}>
                <SourceDot source={msg.source} />
                <span style={{ color: '#64748b', fontSize: '10px' }}>
                  {msg.role === 'user' ? 'You' : 'AI'}
                  {msg.actionId && (
                    <span style={{ marginLeft: '4px', color: '#6366f1' }}>#{msg.actionId.slice(-6)}</span>
                  )}
                </span>
              </div>
              {msg.content}
            </div>
          </div>
        ))}
        {store.isProcessing && (
          <div style={{ display: 'flex', gap: '6px' }}>
            <div
              style={{
                padding: '8px 10px',
                borderRadius: '8px',
                backgroundColor: '#1e1e2e',
                border: '1px solid #374151',
                color: '#64748b',
                fontSize: '12px',
              }}
            >
              Thinking...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ─── Example Commands ────────────────────────────────────────────────── */}
      <div
        style={{
          padding: '6px 14px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px',
          borderTop: '1px solid #1e293b',
          flexShrink: 0,
        }}
      >
        {EXAMPLE_COMMANDS.map(cmd => (
          <button
            key={cmd}
            onClick={() => store.setInputText(cmd)}
            style={{
              padding: '2px 8px',
              borderRadius: '9999px',
              border: '1px solid #374151',
              backgroundColor: '#1a1a2e',
              color: '#64748b',
              fontSize: '11px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
            type="button"
          >
            {cmd}
          </button>
        ))}
      </div>

      {/* ─── Input ───────────────────────────────────────────────────────────── */}
      <div
        style={{
          padding: '10px 14px',
          borderTop: '1px solid #1e293b',
          display: 'flex',
          gap: '8px',
          flexShrink: 0,
        }}
      >
        <textarea
          ref={textareaRef}
          rows={2}
          value={store.inputText}
          onChange={e => store.setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask the AI..."
          disabled={!store.enabled || store.isProcessing}
          style={{
            flex: 1,
            padding: '7px 10px',
            backgroundColor: '#1a1a2e',
            border: '1px solid #374151',
            borderRadius: '6px',
            color: '#f1f5f9',
            fontSize: '13px',
            resize: 'none',
            outline: 'none',
            fontFamily: 'inherit',
            lineHeight: 1.5,
          }}
        />
        <button
          onClick={handleSend}
          disabled={!store.enabled || store.isProcessing || !store.inputText.trim()}
          style={{
            padding: '0 14px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: '#6366f1',
            color: '#fff',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            opacity: (!store.enabled || store.isProcessing || !store.inputText.trim()) ? 0.5 : 1,
            alignSelf: 'stretch',
          }}
          type="button"
        >
          Send
        </button>
      </div>

      {/* ─── Pending Actions ─────────────────────────────────────────────────── */}
      {store.pendingActions.length > 0 && (
        <div
          style={{
            borderTop: '1px solid #1e293b',
            padding: '10px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            flexShrink: 0,
            maxHeight: '220px',
            overflowY: 'auto',
          }}
        >
          <span style={{ fontSize: '10px', color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Pending Actions
          </span>
          {store.pendingActions.map(action => (
            <div
              key={action.id}
              style={{
                backgroundColor: '#1a1a2e',
                border: '1px solid #374151',
                borderRadius: '6px',
                padding: '8px 10px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#d1d5db', fontSize: '12px', fontWeight: 600 }}>
                  {action.title}
                </span>
                <span style={{ color: '#64748b', fontSize: '11px' }}>
                  {Math.round(action.confidence * 100)}%
                </span>
              </div>
              <p style={{ color: '#64748b', fontSize: '11px', margin: '0 0 8px', lineHeight: 1.4 }}>
                {action.description}
              </p>
              {/* Confidence bar */}
              <div style={{ height: '2px', backgroundColor: '#0f172a', borderRadius: '2px', marginBottom: '8px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${action.confidence * 100}%`,
                    backgroundColor: '#6366f1',
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => {
                    store.previewAction(action.id)
                    setPreviewAction(store.pendingActions.find(a => a.id === action.id) ?? null)
                  }}
                  style={{
                    flex: 1,
                    padding: '5px 0',
                    borderRadius: '4px',
                    border: '1px solid #374151',
                    backgroundColor: 'transparent',
                    color: '#94a3b8',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                  type="button"
                >
                  Preview
                </button>
                <button
                  onClick={() => store.applyAction(action.id)}
                  style={{
                    flex: 1,
                    padding: '5px 0',
                    borderRadius: '4px',
                    border: 'none',
                    backgroundColor: '#22c55e',
                    color: '#fff',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  type="button"
                >
                  Apply
                </button>
                <button
                  onClick={() => store.rejectAction(action.id)}
                  style={{
                    flex: 1,
                    padding: '5px 0',
                    borderRadius: '4px',
                    border: '1px solid #7f1d1d',
                    backgroundColor: 'transparent',
                    color: '#ef4444',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                  type="button"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Preview Modal ───────────────────────────────────────────────────── */}
      {previewAction && (
        <AIActionPreviewModal
          action={previewAction}
          onApply={() => {
            store.applyAction(previewAction.id)
            setPreviewAction(null)
          }}
          onReject={() => {
            store.rejectAction(previewAction.id)
            setPreviewAction(null)
          }}
          onClose={() => setPreviewAction(null)}
        />
      )}
    </div>
  )
}
