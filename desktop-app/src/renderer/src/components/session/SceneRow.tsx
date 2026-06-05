import React, { useState, useRef, useCallback, useEffect } from 'react'

// ─── Inline types ─────────────────────────────────────────────────────────────

interface SceneInfo {
  id:    string
  name:  string
  color: string
  tempo: number | null
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface SceneRowProps {
  scene:     SceneInfo
  isPlaying: boolean
  onLaunch:  () => void
  onStop:    () => void
  onRename:  (name: string) => void
}

// ─── SceneRow ─────────────────────────────────────────────────────────────────

export function SceneRow({
  scene,
  isPlaying,
  onLaunch,
  onStop,
  onRename,
}: SceneRowProps): React.JSX.Element {
  const [editing, setEditing]   = useState(false)
  const [draft,   setDraft]     = useState(scene.name)
  const inputRef                = useRef<HTMLInputElement>(null)

  // Sync draft if name changes externally
  useEffect(() => {
    if (!editing) setDraft(scene.name)
  }, [scene.name, editing])

  const startEdit = useCallback(() => {
    setDraft(scene.name)
    setEditing(true)
  }, [scene.name])

  const commitEdit = useCallback(() => {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed && trimmed !== scene.name) onRename(trimmed)
    else setDraft(scene.name)
  }, [draft, scene.name, onRename])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter')  commitEdit()
    if (e.key === 'Escape') { setEditing(false); setDraft(scene.name) }
  }, [commitEdit, scene.name])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  return (
    <div
      style={{
        width:          120,
        height:         72,
        display:        'flex',
        alignItems:     'stretch',
        background:     '#0d0d1a',
        borderRight:    '1px solid #15152a',
        borderBottom:   '1px solid #15152a',
        flexShrink:     0,
        position:       'relative',
        overflow:       'hidden',
      }}
    >
      {/* Colored left border */}
      <div
        style={{
          width:      3,
          background: scene.color,
          flexShrink: 0,
        }}
      />

      {/* Content */}
      <div
        style={{
          flex:          1,
          display:       'flex',
          flexDirection: 'column',
          padding:       '6px 5px 5px',
          gap:           3,
          overflow:      'hidden',
        }}
      >
        {/* Name (double-click to rename) */}
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            style={{
              background:   'rgba(255,255,255,0.08)',
              border:       `1px solid ${scene.color}80`,
              borderRadius: 3,
              color:        '#e2e8f0',
              fontSize:     9,
              fontWeight:   600,
              padding:      '2px 4px',
              outline:      'none',
              width:        '100%',
              boxSizing:    'border-box',
            }}
          />
        ) : (
          <div
            onDoubleClick={startEdit}
            title={scene.name}
            style={{
              fontSize:     9,
              fontWeight:   600,
              color:        '#e2e8f0',
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
              cursor:       'default',
              letterSpacing: '0.03em',
              flexShrink:   0,
            }}
          >
            {scene.name}
          </div>
        )}

        {/* Tempo chip */}
        {scene.tempo !== null && (
          <div
            style={{
              display:      'inline-flex',
              alignItems:   'center',
              gap:          2,
              padding:      '1px 4px',
              borderRadius: 3,
              background:   'rgba(255,255,255,0.05)',
              border:       '1px solid rgba(255,255,255,0.06)',
              fontSize:     8,
              color:        '#475569',
              alignSelf:    'flex-start',
              flexShrink:   0,
            }}
          >
            <span>{scene.tempo}</span>
            <span style={{ fontSize: 8 }}>♩</span>
          </div>
        )}

        {/* Launch / Stop buttons */}
        <div
          style={{
            display:    'flex',
            gap:        3,
            marginTop:  'auto',
          }}
        >
          {/* Launch */}
          <button
            onClick={onLaunch}
            title="Launch scene"
            style={{
              flex:         1,
              height:       16,
              borderRadius: 3,
              fontSize:     9,
              cursor:       'pointer',
              border:       `1px solid ${isPlaying ? 'rgba(34,197,94,0.50)' : 'rgba(255,255,255,0.08)'}`,
              background:   isPlaying ? 'rgba(34,197,94,0.18)' : 'rgba(255,255,255,0.04)',
              color:        isPlaying ? '#22c55e' : '#475569',
              transition:   'all 0.12s',
              padding:      0,
              display:      'flex',
              alignItems:   'center',
              justifyContent: 'center',
            }}
          >
            ▶
          </button>

          {/* Stop */}
          <button
            onClick={onStop}
            title="Stop scene"
            style={{
              width:        20,
              height:       16,
              borderRadius: 3,
              fontSize:     9,
              cursor:       'pointer',
              border:       '1px solid rgba(255,255,255,0.06)',
              background:   'rgba(255,255,255,0.04)',
              color:        '#475569',
              transition:   'all 0.12s',
              padding:      0,
              display:      'flex',
              alignItems:   'center',
              justifyContent: 'center',
            }}
          >
            ■
          </button>
        </div>
      </div>
    </div>
  )
}
