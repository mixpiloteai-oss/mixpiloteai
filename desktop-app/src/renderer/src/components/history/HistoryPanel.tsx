import React, { useCallback } from 'react'
import { useHistoryStore, jumpToHistory } from '../../store/historyStore'
import type { HistoryDomain, HistoryEntry } from '../../store/historyStore'

// ─── Palette ──────────────────────────────────────────────────────────────────

const C = {
  bg:          '#08080f',
  header:      '#0b0b14',
  border:      'rgba(255,255,255,0.06)',
  text:        '#94a3b8',
  textDim:     '#4b5a7a',
  textActive:  '#e2e8f0',
  rowHover:    'rgba(255,255,255,0.03)',
  rowActive:   'rgba(124,58,237,0.12)',
  rowActiveBdr:'rgba(124,58,237,0.4)',
  currentLine: 'rgba(124,58,237,0.22)',
  btnBg:       'rgba(255,255,255,0.04)',
  btnBorder:   'rgba(255,255,255,0.07)',
  btnHover:    'rgba(255,255,255,0.08)',
  corrupted:   '#ef4444',
  domainColors: {
    arrangement: '#7c3aed',
    mixer:       '#06b6d4',
    midi:        '#f59e0b',
    automation:  '#10b981',
    plugin:      '#ec4899',
    editor:      '#8b5cf6',
  } satisfies Record<HistoryDomain, string>,
} as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(ts: number): string {
  const diffS = Math.round((Date.now() - ts) / 1000)
  if (diffS < 5)   return 'just now'
  if (diffS < 60)  return `${diffS}s ago`
  const diffM = Math.round(diffS / 60)
  if (diffM < 60)  return `${diffM}m ago`
  const diffH = Math.round(diffM / 60)
  return `${diffH}h ago`
}

function domainLabel(d: HistoryDomain): string {
  const map: Record<HistoryDomain, string> = {
    arrangement: 'ARR',
    mixer:       'MIX',
    midi:        'MIDI',
    automation:  'AUTO',
    plugin:      'FX',
    editor:      'EDIT',
  }
  return map[d]
}

// ─── Row component ────────────────────────────────────────────────────────────

interface RowProps {
  entry:     HistoryEntry
  index:     number          // index in past[] (0 = oldest)
  current:   number          // current last index
  total:     number
  onClick:   (i: number) => void
}

function HistoryRow({ entry, index, current, onClick }: RowProps): React.ReactElement {
  const isCurrent = index === current
  const isRedo    = index > current
  const color     = C.domainColors[entry.domain]

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(index)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(index) }}
      style={{
        display:      'flex',
        alignItems:   'center',
        gap:          8,
        padding:      '5px 10px',
        cursor:       'pointer',
        background:   isCurrent ? C.currentLine : 'transparent',
        borderLeft:   isCurrent ? `2px solid ${color}` : '2px solid transparent',
        opacity:      isRedo ? 0.35 : 1,
        userSelect:   'none',
      }}
      onMouseEnter={(e) => {
        if (!isCurrent) (e.currentTarget as HTMLDivElement).style.background = C.rowHover
      }}
      onMouseLeave={(e) => {
        if (!isCurrent) (e.currentTarget as HTMLDivElement).style.background = 'transparent'
      }}
    >
      {/* Domain badge */}
      <span style={{
        fontSize:     9,
        fontWeight:   600,
        color,
        background:   `${color}18`,
        border:       `1px solid ${color}30`,
        borderRadius: 3,
        padding:      '1px 4px',
        flexShrink:   0,
        letterSpacing: '0.04em',
        minWidth:     32,
        textAlign:    'center',
      }}>
        {domainLabel(entry.domain)}
      </span>

      {/* Label */}
      <span style={{
        flex:         1,
        fontSize:     11,
        color:        isCurrent ? C.textActive : C.text,
        overflow:     'hidden',
        textOverflow: 'ellipsis',
        whiteSpace:   'nowrap',
      }}>
        {entry.label}
      </span>

      {/* Relative time */}
      <span style={{ fontSize: 9, color: C.textDim, flexShrink: 0 }}>
        {relativeTime(entry.timestamp)}
      </span>
    </div>
  )
}

// ─── HistoryPanel ─────────────────────────────────────────────────────────────

interface HistoryPanelProps {
  /** Optional max height for the scrollable list area */
  maxHeight?: number
}

export default function HistoryPanel({ maxHeight = 400 }: HistoryPanelProps): React.ReactElement {
  const { past, future, canUndo, canRedo, corrupted, undo, redo, clear, getEntries } = useHistoryStore()

  const entries   = getEntries()
  const currentIdx = past.length - 1

  // Build combined list: past (oldest → newest) then future (as greyed-out)
  const futureEntries: HistoryEntry[] = future.map(({ id, label, domain, timestamp }) => ({
    id, label, domain, timestamp,
  }))
  const allEntries = [...entries, ...futureEntries]

  const handleClick = useCallback((index: number) => {
    jumpToHistory(index)
  }, [])

  const handleClear = useCallback(() => {
    clear()
  }, [clear])

  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      background:    C.bg,
      border:        `1px solid ${C.border}`,
      borderRadius:  8,
      overflow:      'hidden',
      minWidth:      220,
    }}>
      {/* Header */}
      <div style={{
        display:      'flex',
        alignItems:   'center',
        padding:      '0 10px',
        height:       36,
        background:   C.header,
        borderBottom: `1px solid ${C.border}`,
        flexShrink:   0,
        gap:          8,
      }}>
        <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: C.text, userSelect: 'none' }}>
          History
        </span>

        {/* Count */}
        <span style={{ fontSize: 10, color: C.textDim, userSelect: 'none' }}>
          {entries.length}/{past.length + future.length}
        </span>

        {/* Undo button */}
        <button
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          style={btnStyle(!canUndo)}
        >
          ↩
        </button>

        {/* Redo button */}
        <button
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
          style={btnStyle(!canRedo)}
        >
          ↪
        </button>

        {/* Clear button */}
        <button
          onClick={handleClear}
          disabled={entries.length === 0 && futureEntries.length === 0}
          title="Clear history"
          style={btnStyle(entries.length === 0 && futureEntries.length === 0)}
        >
          ✕
        </button>
      </div>

      {/* Corruption warning */}
      {corrupted && (
        <div style={{
          padding:    '6px 10px',
          background: 'rgba(239,68,68,0.12)',
          borderBottom: `1px solid rgba(239,68,68,0.3)`,
          fontSize:   10,
          color:      C.corrupted,
        }}>
          ⚠ An undo/redo operation failed. History preserved safely.
        </div>
      )}

      {/* List */}
      <div style={{
        overflowY:     'auto',
        maxHeight,
        scrollbarWidth: 'thin',
        scrollbarColor: `rgba(255,255,255,0.06) transparent`,
      }}>
        {allEntries.length === 0 ? (
          <div style={{
            padding:    '20px 12px',
            fontSize:   11,
            color:      C.textDim,
            textAlign:  'center',
            userSelect: 'none',
          }}>
            No history yet
          </div>
        ) : (
          /* Render newest-first for usability */
          [...allEntries].reverse().map((entry, reversedIdx) => {
            const index = allEntries.length - 1 - reversedIdx
            return (
              <HistoryRow
                key={entry.id}
                entry={entry}
                index={index}
                current={currentIdx}
                total={allEntries.length}
                onClick={handleClick}
              />
            )
          })
        )}
      </div>

      {/* Footer: legend */}
      <div style={{
        display:      'flex',
        alignItems:   'center',
        gap:          6,
        padding:      '5px 10px',
        borderTop:    `1px solid ${C.border}`,
        flexShrink:   0,
        flexWrap:     'wrap',
      }}>
        {(Object.entries(C.domainColors) as [HistoryDomain, string][]).map(([domain, color]) => (
          <span key={domain} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ fontSize: 9, color: C.textDim, userSelect: 'none' }}>
              {domainLabel(domain)}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── Tiny button style helper ─────────────────────────────────────────────────

function btnStyle(disabled: boolean): React.CSSProperties {
  return {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    width:          22,
    height:         22,
    background:     C.btnBg,
    border:         `1px solid ${C.btnBorder}`,
    borderRadius:   4,
    color:          disabled ? C.textDim : C.text,
    fontSize:       11,
    cursor:         disabled ? 'not-allowed' : 'pointer',
    opacity:        disabled ? 0.4 : 1,
    flexShrink:     0,
    fontFamily:     'inherit',
    userSelect:     'none',
    transition:     'background 0.1s',
    padding:        0,
  }
}
