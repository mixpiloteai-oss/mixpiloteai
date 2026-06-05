// ─── TakeSelector.tsx ─────────────────────────────────────────────────────────
// Per-track take management panel. Props-driven, no store import.

import React, { useState, useRef, useEffect } from 'react'

interface Take {
  id:              string
  trackId:         string
  filePath:        string
  durationSamples: number
  sampleRate:      number
  channelCount:    number
  takeNumber:      number
  createdAt:       number
  label:           string
}

export interface TakeSelectorProps {
  trackId:      string
  takes:        Take[]
  activeTakeId: string | null
  onSelectTake: (takeId: string) => void
  onDeleteTake: (takeId: string) => void
  onRenameTake: (takeId: string, label: string) => void
}

const formatDuration = (samples: number, sampleRate: number): string => {
  if (sampleRate <= 0) return '0:00'
  const totalSec = samples / sampleRate
  const mm       = Math.floor(totalSec / 60)
  const ss       = Math.floor(totalSec % 60).toString().padStart(2, '0')
  return `${mm}:${ss}`
}

interface TakeRowProps {
  take:         Take
  isActive:     boolean
  onSelect:     () => void
  onDelete:     () => void
  onRename:     (label: string) => void
}

const TakeRow: React.FC<TakeRowProps> = ({ take, isActive, onSelect, onDelete, onRename }) => {
  const [editing, setEditing]     = useState(false)
  const [draft, setDraft]         = useState(take.label)
  const inputRef                  = useRef<HTMLInputElement>(null)

  // Keep draft in sync if label changes externally
  useEffect(() => {
    if (!editing) setDraft(take.label)
  }, [take.label, editing])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const commitRename = (): void => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== take.label) onRename(trimmed)
    else setDraft(take.label)
    setEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter')  commitRename()
    if (e.key === 'Escape') { setDraft(take.label); setEditing(false) }
  }

  return (
    <div
      onClick={onSelect}
      style={{
        display:       'flex',
        alignItems:    'center',
        gap:            4,
        padding:       '3px 5px',
        borderRadius:   3,
        cursor:        'pointer',
        background:    isActive ? '#0f172a' : 'transparent',
        border:        isActive ? '1px solid #1e3a5f' : '1px solid transparent',
        userSelect:    'none',
        minHeight:      22,
      }}
    >
      {/* Take number chip */}
      <span
        style={{
          background:   '#15152a',
          color:        '#475569',
          borderRadius:  3,
          padding:      '1px 4px',
          fontSize:      9,
          fontFamily:   'monospace',
          flexShrink:    0,
          minWidth:      18,
          textAlign:    'center',
        }}
      >
        {take.takeNumber}
      </span>

      {/* Label — double-click to edit inline */}
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={handleKeyDown}
          onClick={e => e.stopPropagation()}
          style={{
            flex:        1,
            background:  '#0d0d1a',
            border:      '1px solid #1e3a5f',
            borderRadius: 3,
            color:       '#e2e8f0',
            fontSize:     10,
            fontFamily:  'monospace',
            padding:     '1px 4px',
            outline:     'none',
            minWidth:     0,
          }}
        />
      ) : (
        <span
          onDoubleClick={e => { e.stopPropagation(); setEditing(true) }}
          title="Double-click to rename"
          style={{
            flex:         1,
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
            color:        isActive ? '#e2e8f0' : '#94a3b8',
            fontSize:      10,
            fontFamily:   'monospace',
            minWidth:      0,
          }}
        >
          {take.label}
        </span>
      )}

      {/* Duration */}
      <span
        style={{
          color:      '#475569',
          fontSize:    9,
          fontFamily: 'monospace',
          flexShrink:  0,
        }}
      >
        {formatDuration(take.durationSamples, take.sampleRate)}
      </span>

      {/* Delete button */}
      <button
        onClick={e => { e.stopPropagation(); onDelete() }}
        title="Delete take"
        style={{
          border:       'none',
          background:   'transparent',
          color:        '#475569',
          cursor:       'pointer',
          padding:      '0 2px',
          fontSize:      11,
          lineHeight:    1,
          flexShrink:    0,
          borderRadius:  2,
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#ef4444' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#475569' }}
      >
        ×
      </button>
    </div>
  )
}

export const TakeSelector: React.FC<TakeSelectorProps> = ({
  takes,
  activeTakeId,
  onSelectTake,
  onDeleteTake,
  onRenameTake,
}) => {
  return (
    <div
      style={{
        display:       'flex',
        flexDirection: 'column',
        background:    '#0b0b17',
        border:        '1px solid #15152a',
        borderRadius:   4,
        padding:       '4px 3px',
        gap:            1,
        fontFamily:    'monospace',
        fontSize:       10,
        color:         '#e2e8f0',
        minWidth:       160,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding:     '2px 5px 4px',
          color:       '#475569',
          fontSize:     9,
          letterSpacing: 1,
          borderBottom: '1px solid #15152a',
          marginBottom:  2,
        }}
      >
        TAKES
      </div>

      {/* Take list */}
      <div
        style={{
          overflowY:  'auto',
          maxHeight:   200,
          display:    'flex',
          flexDirection: 'column',
          gap:          1,
        }}
      >
        {takes.length === 0 ? (
          <div
            style={{
              padding:   '12px 5px',
              color:     '#334155',
              fontSize:   10,
              textAlign: 'center',
              fontStyle: 'italic',
            }}
          >
            No takes yet
          </div>
        ) : (
          takes.map(take => (
            <TakeRow
              key={take.id}
              take={take}
              isActive={take.id === activeTakeId}
              onSelect={() => onSelectTake(take.id)}
              onDelete={() => onDeleteTake(take.id)}
              onRename={label => onRenameTake(take.id, label)}
            />
          ))
        )}
      </div>
    </div>
  )
}

export default TakeSelector
