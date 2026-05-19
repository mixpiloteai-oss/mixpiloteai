import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useBrowserStore } from '../../store/browserStore'

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:         '#0e0e1c',
  border:     '#1c1c2e',
  borderFoc:  '#7c3aed',
  text:       '#cbd5e1',
  placeholder:'#3f4966',
  icon:       '#4b5a7a',
  btnBg:      'rgba(255,255,255,0.04)',
  btnHover:   'rgba(255,255,255,0.08)',
  btnActive:  'rgba(124,58,237,0.2)',
  btnBorder:  'rgba(255,255,255,0.06)',
  btnText:    '#94a3b8',
  btnActiveTxt:'#a78bfa',
  clearBtn:   '#6b7a99',
} as const

// ─── Props ────────────────────────────────────────────────────────────────────
interface SearchBarProps {
  onToggleFilters: () => void
  filtersActive:   boolean
}

// ─── SearchBar ────────────────────────────────────────────────────────────────
export default function SearchBar({
  onToggleFilters,
  filtersActive,
}: SearchBarProps): React.ReactElement {
  const filter    = useBrowserStore((s) => s.filter)
  const setFilter = useBrowserStore((s) => s.setFilter)

  const [localValue, setLocalValue] = useState<string>(filter.search)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef    = useRef<HTMLInputElement>(null)
  const [focused, setFocused] = useState<boolean>(false)

  // Keep local value in sync when filter resets from outside
  useEffect(() => {
    setLocalValue(filter.search)
  }, [filter.search])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setLocalValue(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setFilter({ search: value })
    }, 150)
  }, [setFilter])

  const handleClear = useCallback(() => {
    setLocalValue('')
    setFilter({ search: '' })
    inputRef.current?.focus()
  }, [setFilter])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      handleClear()
    }
  }, [handleClear])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return (
    <div
      style={{
        display:     'flex',
        alignItems:  'center',
        gap:         6,
        flex:        1,
        minWidth:    0,
      }}
    >
      {/* Search input wrapper */}
      <div
        style={{
          position:     'relative',
          flex:         1,
          minWidth:     0,
          display:      'flex',
          alignItems:   'center',
        }}
      >
        {/* Search icon */}
        <span
          style={{
            position:  'absolute',
            left:      10,
            color:     C.icon,
            fontSize:  12,
            lineHeight: 1,
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          🔍
        </span>

        <input
          ref={inputRef}
          type="text"
          value={localValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Search samples..."
          spellCheck={false}
          style={{
            width:           '100%',
            height:          30,
            background:      C.bg,
            border:          `1px solid ${focused ? C.borderFoc : C.border}`,
            borderRadius:    6,
            color:           C.text,
            fontSize:        12,
            padding:         '0 30px 0 32px',
            outline:         'none',
            boxSizing:       'border-box',
            transition:      'border-color 0.15s',
            fontFamily:      'inherit',
          }}
        />

        {/* Clear button */}
        {localValue.length > 0 && (
          <button
            onClick={handleClear}
            title="Clear search (Esc)"
            style={{
              position:   'absolute',
              right:      6,
              background: 'transparent',
              border:     'none',
              cursor:     'pointer',
              color:      C.clearBtn,
              fontSize:   14,
              lineHeight: 1,
              padding:    '0 2px',
              display:    'flex',
              alignItems: 'center',
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* Filters toggle button */}
      <button
        onClick={onToggleFilters}
        title="Toggle filters"
        style={{
          display:       'flex',
          alignItems:    'center',
          gap:           5,
          height:        30,
          padding:       '0 10px',
          background:    filtersActive ? C.btnActive : C.btnBg,
          border:        `1px solid ${filtersActive ? 'rgba(124,58,237,0.4)' : C.btnBorder}`,
          borderRadius:  6,
          color:         filtersActive ? C.btnActiveTxt : C.btnText,
          fontSize:      11,
          cursor:        'pointer',
          flexShrink:    0,
          whiteSpace:    'nowrap',
          fontFamily:    'inherit',
          userSelect:    'none',
          transition:    'background 0.1s, border-color 0.1s, color 0.1s',
        }}
        onMouseEnter={(e) => {
          if (!filtersActive) {
            (e.currentTarget as HTMLButtonElement).style.background = C.btnHover
          }
        }}
        onMouseLeave={(e) => {
          if (!filtersActive) {
            (e.currentTarget as HTMLButtonElement).style.background = C.btnBg
          }
        }}
      >
        <span style={{ fontSize: 12 }}>🎚</span>
        <span>Filters</span>
      </button>
    </div>
  )
}
