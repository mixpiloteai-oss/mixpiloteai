// ─── AIAssistantPanel ─────────────────────────────────────────────────────────
// Full AI assistant UI. All values come from real analysis.

import { useState, useRef, useEffect } from 'react'
import { useAIAssistantStore } from '../../store/aiAssistantStore'

const SUGGESTED_COMMANDS = [
  'fais un kick tribe',
  'humanize les hats',
  'ajoute une montée',
  'rends la basse plus agressive',
  'fais un drop',
  'génère hardtek',
  'create hardtek kick',
  'analyse le projet',
] as const

const STYLE_COLORS: Record<string, string> = {
  techno:          '#7c3aed',
  house:           '#06b6d4',
  ambient:         '#10b981',
  'hip-hop':       '#f59e0b',
  'drum-and-bass': '#ef4444',
  pop:             '#ec4899',
  unknown:         '#64748b',
}

export default function AIAssistantPanel() {
  const store      = useAIAssistantStore()
  const [draft, setDraft] = useState('')
  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [store.history])

  // Auto-run analysis on mount
  useEffect(() => {
    store.runAnalysis()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSend() {
    const text = draft.trim()
    if (!text || store.processing || !store.enabled) return
    setDraft('')
    void store.sendCommand(text)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); handleSend() }
  }

  function handleChipClick(cmd: string) {
    setDraft(cmd)
    inputRef.current?.focus()
  }

  const analysis = store.lastAnalysis
  const energyPct = analysis ? (analysis.energy * 100).toFixed(0) : '0'
  const styleColor = analysis ? (STYLE_COLORS[analysis.style] ?? '#64748b') : '#64748b'

  return (
    <div className="flex flex-col h-full" style={{ background: '#08080f', position: 'relative' }}>
      {/* Disabled overlay */}
      {!store.enabled && (
        <div
          style={{
            position:        'absolute',
            inset:           0,
            background:      'rgba(0,0,0,0.7)',
            zIndex:          10,
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
          }}
        >
          <p style={{ color: '#64748b', fontSize: 13 }}>L&apos;assistant IA est désactivé.</p>
        </div>
      )}

      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 shrink-0"
        style={{ borderBottom: '1px solid #1c1c2e', background: '#0c0c14', height: 40 }}
      >
        <span style={{ color: '#7c3aed', fontSize: 13 }}>✦</span>
        <span style={{ color: '#94a3b8', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 2 }}>
          AI Assistant
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => { store.runAnalysis() }}
            style={{
              fontSize:   10,
              padding:    '2px 8px',
              borderRadius: 4,
              background: 'rgba(6,182,212,0.1)',
              border:     '1px solid rgba(6,182,212,0.3)',
              color:      '#06b6d4',
              cursor:     'pointer',
            }}
          >
            Analyser
          </button>
          <button
            onClick={() => store.setEnabled(!store.enabled)}
            style={{
              fontSize:   10,
              padding:    '2px 8px',
              borderRadius: 4,
              background: store.enabled ? 'rgba(16,185,129,0.1)' : 'rgba(100,116,139,0.1)',
              border:     `1px solid ${store.enabled ? 'rgba(16,185,129,0.3)' : 'rgba(100,116,139,0.3)'}`,
              color:      store.enabled ? '#10b981' : '#64748b',
              cursor:     'pointer',
            }}
          >
            {store.enabled ? 'Activé' : 'Désactivé'}
          </button>
        </div>
      </div>

      {/* Analysis bar */}
      {analysis && (
        <div
          style={{
            padding:      '8px 12px',
            borderBottom: '1px solid #13131f',
            background:   '#0a0a12',
            display:      'flex',
            gap:          12,
            alignItems:   'center',
            flexWrap:     'wrap',
          }}
        >
          {/* BPM */}
          <div style={{ fontSize: 10, color: '#64748b' }}>
            BPM <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{analysis.bpm}</span>
          </div>

          {/* Key */}
          <div style={{ fontSize: 10, color: '#64748b' }}>
            Tonalité <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{analysis.detectedKey?.name ?? '—'}</span>
          </div>

          {/* Style badge */}
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
            {analysis.style}
          </div>

          {/* Energy bar */}
          <div style={{ flex: 1, minWidth: 60 }}>
            <div style={{ fontSize: 9, color: '#64748b', marginBottom: 2 }}>Énergie {energyPct}%</div>
            <div style={{ height: 3, background: '#1c1c2e', borderRadius: 2, overflow: 'hidden' }}>
              <div
                style={{
                  width:        `${energyPct}%`,
                  height:       '100%',
                  background:   '#7c3aed',
                  borderRadius: 2,
                }}
              />
            </div>
          </div>

          {/* Badges */}
          <div style={{ display: 'flex', gap: 4 }}>
            {analysis.hasKick && (
              <span style={{ fontSize: 9, color: '#ef4444', border: '1px solid #ef444440', borderRadius: 4, padding: '0 4px' }}>KICK</span>
            )}
            {analysis.hasBass && (
              <span style={{ fontSize: 9, color: '#06b6d4', border: '1px solid #06b6d440', borderRadius: 4, padding: '0 4px' }}>BASS</span>
            )}
            {analysis.hasHarmony && (
              <span style={{ fontSize: 9, color: '#10b981', border: '1px solid #10b98140', borderRadius: 4, padding: '0 4px' }}>HARM</span>
            )}
          </div>
        </div>
      )}

      {/* Suggested command chips */}
      <div
        style={{
          display:      'flex',
          gap:          6,
          padding:      '8px 12px',
          overflowX:    'auto',
          borderBottom: '1px solid #13131f',
          flexShrink:   0,
        }}
      >
        {SUGGESTED_COMMANDS.map(cmd => (
          <button
            key={cmd}
            onClick={() => handleChipClick(cmd)}
            style={{
              flexShrink:    0,
              padding:       '3px 10px',
              borderRadius:  20,
              fontSize:      10,
              whiteSpace:    'nowrap',
              background:    'rgba(124,58,237,0.06)',
              border:        '1px solid rgba(124,58,237,0.2)',
              color:         '#7c3aed',
              cursor:        'pointer',
            }}
          >
            {cmd}
          </button>
        ))}
      </div>

      {/* Conversation */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {store.history.length === 0 && (
          <p style={{ color: '#334155', fontSize: 11, textAlign: 'center', marginTop: 20 }}>
            Envoyez une commande ou cliquez sur une suggestion.
          </p>
        )}

        {store.history.map(entry => (
          <div
            key={entry.id}
            style={{
              display:        'flex',
              justifyContent: entry.role === 'user' ? 'flex-end' : 'flex-start',
              alignItems:     'flex-start',
              gap:            6,
            }}
          >
            {entry.role === 'assistant' && (
              <div
                style={{
                  width:           20,
                  height:          20,
                  borderRadius:    6,
                  background:      'rgba(124,58,237,0.2)',
                  display:         'flex',
                  alignItems:      'center',
                  justifyContent:  'center',
                  fontSize:        10,
                  color:           '#7c3aed',
                  flexShrink:      0,
                  marginTop:       2,
                }}
              >
                ✦
              </div>
            )}

            <div
              style={{
                maxWidth:     '80%',
                padding:      '8px 12px',
                borderRadius: entry.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                fontSize:     11,
                lineHeight:   1.5,
                background:   entry.role === 'user'
                  ? 'rgba(124,58,237,0.15)'
                  : '#0f0f1a',
                border:       `1px solid ${entry.role === 'user' ? 'rgba(124,58,237,0.25)' : '#1c1c2e'}`,
                color:        entry.role === 'user' ? '#c4b5fd' : '#94a3b8',
              }}
            >
              {entry.text}
              <div style={{ marginTop: 4 }}>
                <span
                  style={{
                    fontSize:     8,
                    padding:      '0 4px',
                    borderRadius: 3,
                    background:   'rgba(100,116,139,0.15)',
                    color:        '#475569',
                    border:       '1px solid #1e293b',
                  }}
                >
                  {entry.source}
                </span>
              </div>
            </div>
          </div>
        ))}

        {store.processing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div
              style={{
                width:          20,
                height:         20,
                borderRadius:   6,
                background:     'rgba(124,58,237,0.2)',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                fontSize:       10,
                color:          '#7c3aed',
              }}
            >
              ✦
            </div>
            <span style={{ fontSize: 11, color: '#7c3aed' }}>Traitement en cours…</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '10px 12px', borderTop: '1px solid #1c1c2e', flexShrink: 0 }}>
        <div
          style={{
            display:      'flex',
            gap:          8,
            alignItems:   'center',
            background:   '#0f0f1a',
            border:       '1px solid #1c1c2e',
            borderRadius: 10,
            overflow:     'hidden',
            padding:      '4px 4px 4px 12px',
          }}
        >
          <input
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!store.enabled || store.processing}
            placeholder="Décrivez ce que vous voulez générer…"
            style={{
              flex:        1,
              background:  'transparent',
              border:      'none',
              outline:     'none',
              fontSize:    11,
              color:       '#e2e8f0',
              caretColor:  '#7c3aed',
              fontFamily:  'inherit',
            }}
          />
          <button
            onClick={handleSend}
            disabled={!draft.trim() || store.processing || !store.enabled}
            style={{
              width:           28,
              height:          28,
              borderRadius:    7,
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
              cursor:          draft.trim() && !store.processing ? 'pointer' : 'default',
              background:      draft.trim() && !store.processing && store.enabled
                ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.04)',
              border:          `1px solid ${draft.trim() && !store.processing && store.enabled
                ? 'rgba(124,58,237,0.4)' : '#1c1c2e'}`,
              color:           draft.trim() && !store.processing && store.enabled ? '#a855f7' : '#334155',
              fontSize:        14,
            }}
          >
            ↑
          </button>
        </div>
        <p style={{ fontSize: 9, marginTop: 4, paddingLeft: 4, color: '#1e293b' }}>
          Entrée pour envoyer
        </p>
      </div>
    </div>
  )
}
