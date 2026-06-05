import React, { useMemo } from 'react'
import { useBrowserStore } from '../../store/browserStore'
import { getSampleIndexer } from '../../audio/browser/SampleIndexer'
import { DEFAULT_FILTER } from '../../audio/browser/types'

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:           '#0b0b14',
  border:       'rgba(255,255,255,0.06)',
  sectionTitle: '#3f4966',
  text:         '#94a3b8',
  textMuted:    '#4b5a7a',
  btnBg:        'rgba(255,255,255,0.04)',
  btnBorder:    'rgba(255,255,255,0.07)',
  btnHover:     'rgba(255,255,255,0.08)',
  btnActive:    'rgba(124,58,237,0.22)',
  btnActiveText:'#c4b5fd',
  btnActiveBdr: 'rgba(124,58,237,0.5)',
  inputBg:      '#0e0e1c',
  inputBorder:  '#1c1c2e',
  inputText:    '#cbd5e1',
  resetBg:      'rgba(239,68,68,0.1)',
  resetBdr:     'rgba(239,68,68,0.25)',
  resetText:    '#f87171',
  tagBg:        'rgba(255,255,255,0.05)',
  tagBorder:    'rgba(255,255,255,0.08)',
  tagActive:    'rgba(124,58,237,0.2)',
  tagActiveBdr: 'rgba(124,58,237,0.45)',
  favActive:    'rgba(245,158,11,0.15)',
  favBdr:       'rgba(245,158,11,0.4)',
  favText:      '#fbbf24',
} as const

// ─── Known extensions ─────────────────────────────────────────────────────────
const KNOWN_EXTS: ReadonlyArray<string> = ['.wav', '.mp3', '.flac', '.aif', '.ogg']

// ─── Active filter count ──────────────────────────────────────────────────────
function countActiveFilters(filter: ReturnType<typeof useBrowserStore.getState>['filter']): number {
  let count = 0
  if (filter.search !== DEFAULT_FILTER.search) count++
  if (filter.extensions.length > 0) count++
  if (filter.bpmMin !== null) count++
  if (filter.bpmMax !== null) count++
  if (filter.keys.length > 0) count++
  if (filter.styles.length > 0) count++
  if (filter.favoritesOnly) count++
  if (filter.minDuration !== null) count++
  if (filter.maxDuration !== null) count++
  return count
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionLabel({ label }: { label: string }): React.ReactElement {
  return (
    <div style={{
      fontSize:    9,
      fontWeight:  700,
      letterSpacing: '0.08em',
      color:       C.sectionTitle,
      textTransform: 'uppercase',
      marginBottom: 6,
      userSelect:  'none',
    }}>
      {label}
    </div>
  )
}

// ─── Toggle button ────────────────────────────────────────────────────────────
interface ToggleBtnProps {
  label:   string
  active:  boolean
  onClick: () => void
  title?:  string
}

function ToggleBtn({ label, active, onClick, title }: ToggleBtnProps): React.ReactElement {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        padding:      '2px 8px',
        height:       24,
        background:   active ? C.btnActive : C.btnBg,
        border:       `1px solid ${active ? C.btnActiveBdr : C.btnBorder}`,
        borderRadius: 4,
        color:        active ? C.btnActiveText : C.text,
        fontSize:     11,
        cursor:       'pointer',
        flexShrink:   0,
        whiteSpace:   'nowrap',
        fontFamily:   'inherit',
        userSelect:   'none',
        transition:   'background 0.1s, border-color 0.1s, color 0.1s',
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.background = C.btnHover
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.background = C.btnBg
      }}
    >
      {label}
    </button>
  )
}

// ─── Number input ─────────────────────────────────────────────────────────────
interface NumInputProps {
  value:       number | null
  placeholder: string
  min?:        number
  max?:        number
  onChange:    (v: number | null) => void
  width?:      number
}

function NumInput({ value, placeholder, min, max, onChange, width = 64 }: NumInputProps): React.ReactElement {
  return (
    <input
      type="number"
      value={value ?? ''}
      placeholder={placeholder}
      min={min}
      max={max}
      onChange={(e) => {
        const raw = e.target.value.trim()
        if (raw === '') {
          onChange(null)
        } else {
          const n = parseFloat(raw)
          if (!isNaN(n)) onChange(n)
        }
      }}
      style={{
        width:        width,
        height:       24,
        background:   C.inputBg,
        border:       `1px solid ${C.inputBorder}`,
        borderRadius: 4,
        color:        C.inputText,
        fontSize:     11,
        padding:      '0 6px',
        outline:      'none',
        boxSizing:    'border-box',
        fontFamily:   'inherit',
        flexShrink:   0,
      }}
    />
  )
}

// ─── Tag chip ─────────────────────────────────────────────────────────────────
interface TagChipProps {
  label:   string
  active:  boolean
  onClick: () => void
}

function TagChip({ label, active, onClick }: TagChipProps): React.ReactElement {
  return (
    <button
      onClick={onClick}
      style={{
        padding:      '2px 8px',
        height:       22,
        background:   active ? C.tagActive : C.tagBg,
        border:       `1px solid ${active ? C.tagActiveBdr : C.tagBorder}`,
        borderRadius: 10,
        color:        active ? C.btnActiveText : C.textMuted,
        fontSize:     10,
        cursor:       'pointer',
        flexShrink:   0,
        whiteSpace:   'nowrap',
        fontFamily:   'inherit',
        userSelect:   'none',
        transition:   'background 0.1s, border-color 0.1s, color 0.1s',
        lineHeight:   1,
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.background = C.btnHover
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.background = C.tagBg
      }}
    >
      {label}
    </button>
  )
}

// ─── FilterPanel ──────────────────────────────────────────────────────────────
export default function FilterPanel(): React.ReactElement {
  const filter      = useBrowserStore((s) => s.filter)
  const setFilter   = useBrowserStore((s) => s.setFilter)
  const resetFilter = useBrowserStore((s) => s.resetFilter)

  // Derived unique keys/styles from the indexer (fast — already indexed)
  const uniqueKeys   = useMemo(() => getSampleIndexer().getUniqueKeys(),   [])
  const uniqueStyles = useMemo(() => getSampleIndexer().getUniqueStyles(), [])
  const uniqueExts   = useMemo(() => {
    const fromIndexer = getSampleIndexer().getUniqueExts()
    // Merge with known extensions so buttons always visible
    const merged = new Set([...KNOWN_EXTS, ...fromIndexer])
    return [...merged].sort()
  }, [])

  const activeCount = useMemo(() => countActiveFilters(filter), [filter])

  // ── Handlers ────────────────────────────────────────────────────────────────

  const toggleExt = (ext: string): void => {
    const next = filter.extensions.includes(ext)
      ? filter.extensions.filter((e) => e !== ext)
      : [...filter.extensions, ext]
    setFilter({ extensions: next })
  }

  const toggleKey = (key: string): void => {
    const next = filter.keys.includes(key)
      ? filter.keys.filter((k) => k !== key)
      : [...filter.keys, key]
    setFilter({ keys: next })
  }

  const toggleStyle = (style: string): void => {
    const next = filter.styles.includes(style)
      ? filter.styles.filter((s) => s !== style)
      : [...filter.styles, style]
    setFilter({ styles: next })
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        background:  C.bg,
        borderBottom: `1px solid ${C.border}`,
        padding:     '10px 12px',
        display:     'flex',
        flexDirection: 'column',
        gap:         12,
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          fontSize:    10,
          fontWeight:  700,
          color:       C.text,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          userSelect:  'none',
          display:     'flex',
          alignItems:  'center',
          gap:         6,
        }}>
          Filters
          {activeCount > 0 && (
            <span style={{
              background:   C.btnActive,
              border:       `1px solid ${C.btnActiveBdr}`,
              borderRadius: 10,
              color:        C.btnActiveText,
              fontSize:     9,
              fontWeight:   700,
              padding:      '1px 6px',
              lineHeight:   1.4,
            }}>
              {activeCount}
            </span>
          )}
        </div>

        {/* Reset */}
        <button
          onClick={resetFilter}
          disabled={activeCount === 0}
          style={{
            height:       22,
            padding:      '0 8px',
            background:   activeCount > 0 ? C.resetBg : 'transparent',
            border:       `1px solid ${activeCount > 0 ? C.resetBdr : C.btnBorder}`,
            borderRadius: 4,
            color:        activeCount > 0 ? C.resetText : C.textMuted,
            fontSize:     10,
            cursor:       activeCount > 0 ? 'pointer' : 'default',
            fontFamily:   'inherit',
            userSelect:   'none',
            opacity:      activeCount > 0 ? 1 : 0.4,
            transition:   'opacity 0.15s',
          }}
        >
          Reset all
        </button>
      </div>

      {/* Format */}
      <div>
        <SectionLabel label="Format" />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {uniqueExts.map((ext) => (
            <ToggleBtn
              key={ext}
              label={ext.replace('.', '').toUpperCase()}
              active={filter.extensions.includes(ext)}
              onClick={() => toggleExt(ext)}
              title={ext}
            />
          ))}
        </div>
      </div>

      {/* BPM */}
      <div>
        <SectionLabel label="BPM" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <NumInput
            value={filter.bpmMin}
            placeholder="Min"
            min={0}
            max={300}
            onChange={(v) => setFilter({ bpmMin: v })}
            width={64}
          />
          <span style={{ color: C.textMuted, fontSize: 11, userSelect: 'none' }}>—</span>
          <NumInput
            value={filter.bpmMax}
            placeholder="Max"
            min={0}
            max={300}
            onChange={(v) => setFilter({ bpmMax: v })}
            width={64}
          />
        </div>
      </div>

      {/* Duration */}
      <div>
        <SectionLabel label="Duration (s)" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <NumInput
            value={filter.minDuration}
            placeholder="0.0s"
            min={0}
            onChange={(v) => setFilter({ minDuration: v })}
            width={64}
          />
          <span style={{ color: C.textMuted, fontSize: 11, userSelect: 'none' }}>—</span>
          <NumInput
            value={filter.maxDuration}
            placeholder="∞"
            min={0}
            onChange={(v) => setFilter({ maxDuration: v })}
            width={64}
          />
        </div>
      </div>

      {/* Key */}
      {uniqueKeys.length > 0 && (
        <div>
          <SectionLabel label="Key" />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 54, overflowY: 'auto' }}>
            {uniqueKeys.map((key) => (
              <TagChip
                key={key}
                label={key}
                active={filter.keys.includes(key)}
                onClick={() => toggleKey(key)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Style */}
      {uniqueStyles.length > 0 && (
        <div>
          <SectionLabel label="Style" />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 54, overflowY: 'auto' }}>
            {uniqueStyles.map((style) => (
              <TagChip
                key={style}
                label={style}
                active={filter.styles.includes(style)}
                onClick={() => toggleStyle(style)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Favorites only */}
      <div>
        <button
          onClick={() => setFilter({ favoritesOnly: !filter.favoritesOnly })}
          style={{
            display:      'flex',
            alignItems:   'center',
            gap:          7,
            height:       28,
            padding:      '0 10px',
            background:   filter.favoritesOnly ? C.favActive : C.btnBg,
            border:       `1px solid ${filter.favoritesOnly ? C.favBdr : C.btnBorder}`,
            borderRadius: 5,
            color:        filter.favoritesOnly ? C.favText : C.text,
            fontSize:     11,
            cursor:       'pointer',
            fontFamily:   'inherit',
            userSelect:   'none',
            transition:   'background 0.1s, border-color 0.1s, color 0.1s',
          }}
          onMouseEnter={(e) => {
            if (!filter.favoritesOnly)
              (e.currentTarget as HTMLButtonElement).style.background = C.btnHover
          }}
          onMouseLeave={(e) => {
            if (!filter.favoritesOnly)
              (e.currentTarget as HTMLButtonElement).style.background = C.btnBg
          }}
        >
          <span style={{ fontSize: 13 }}>{filter.favoritesOnly ? '★' : '☆'}</span>
          <span>Favorites only</span>
        </button>
      </div>
    </div>
  )
}
