import { useState, useEffect, useRef } from 'react'
import { useMidiStore } from '../../store/midiStore'
import type { MidiPreset, PresetCategory } from '../../store/midiStore'

// ─── Toast ────────────────────────────────────────────────────────────────────

interface ToastState {
  id:      number
  message: string
}

let toastCounter = 0

function Toast({ message }: { message: string }): JSX.Element {
  return (
    <div style={{
      position:     'fixed',
      bottom:       24,
      right:        24,
      zIndex:       9999,
      background:   'rgba(124,58,237,0.9)',
      border:       '1px solid rgba(168,85,247,0.6)',
      borderRadius: 8,
      padding:      '8px 16px',
      color:        '#fff',
      fontSize:     12,
      fontFamily:   'monospace',
      boxShadow:    '0 4px 24px rgba(0,0,0,0.6)',
      pointerEvents: 'none',
    }}>
      {message}
    </div>
  )
}

// ─── Save Modal ───────────────────────────────────────────────────────────────

const CATEGORIES: PresetCategory[] = ['arp', 'seq', 'mapping', 'drumrack', 'full']

interface SaveModalProps {
  onSave:   (name: string, category: PresetCategory) => void
  onCancel: () => void
}

function SaveModal({ onSave, onCancel }: SaveModalProps): JSX.Element {
  const [name, setName]         = useState('')
  const [category, setCategory] = useState<PresetCategory>('full')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onSave(trimmed, category)
  }

  const overlayStyle: React.CSSProperties = {
    position:       'fixed',
    inset:          0,
    zIndex:         9990,
    background:     'rgba(0,0,0,0.7)',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
  }

  const modalStyle: React.CSSProperties = {
    background:   '#0f0f1e',
    border:       '1px solid rgba(124,58,237,0.4)',
    borderRadius: 10,
    padding:      '20px 24px',
    width:        320,
    display:      'flex',
    flexDirection: 'column',
    gap:          14,
    boxShadow:    '0 16px 48px rgba(0,0,0,0.8)',
    fontFamily:   'monospace',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: 1,
  }

  const inputStyle: React.CSSProperties = {
    background:   '#0b0b14',
    border:       '1px solid rgba(255,255,255,0.1)',
    borderRadius: 5,
    color:        '#e2e8f0',
    fontSize:     12,
    fontFamily:   'monospace',
    padding:      '6px 10px',
    outline:      'none',
    width:        '100%',
    boxSizing:    'border-box',
  }

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: 'pointer',
  }

  const btnRow: React.CSSProperties = { display: 'flex', gap: 8, justifyContent: 'flex-end' }

  return (
    <div style={overlayStyle} onPointerDown={onCancel}>
      <div style={modalStyle} onPointerDown={e => e.stopPropagation()}>
        <span style={{ fontSize: 11, color: '#a855f7', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>
          Save Preset
        </span>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={labelStyle}>Name</span>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="My preset…"
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={labelStyle}>Category</span>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as PresetCategory)}
              style={selectStyle}
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
              ))}
            </select>
          </div>

          <div style={btnRow}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 5, color: '#475569', fontSize: 11, fontFamily: 'monospace',
                cursor: 'pointer', padding: '6px 14px',
              }}
            >Cancel</button>
            <button
              type="submit"
              disabled={!name.trim()}
              style={{
                background: name.trim() ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${name.trim() ? 'rgba(124,58,237,0.7)' : 'rgba(255,255,255,0.06)'}`,
                borderRadius: 5, color: name.trim() ? '#a855f7' : '#2d2d42',
                fontSize: 11, fontFamily: 'monospace', cursor: name.trim() ? 'pointer' : 'default',
                padding: '6px 14px',
              }}
            >Save</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── PresetManager ────────────────────────────────────────────────────────────

type FilterCategory = 'all' | PresetCategory

const FILTER_CATEGORIES: FilterCategory[] = ['all', 'arp', 'seq', 'mapping', 'drumrack', 'full']

export default function PresetManager(): JSX.Element {
  const { presets, savePreset, loadPreset, deletePreset } = useMidiStore()

  const [showSave, setShowSave]         = useState(false)
  const [filter, setFilter]             = useState<FilterCategory>('all')
  const [search, setSearch]             = useState('')
  const [toast, setToast]               = useState<ToastState | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = (message: string): void => {
    if (toastTimerRef.current !== null) clearTimeout(toastTimerRef.current)
    toastCounter += 1
    setToast({ id: toastCounter, message })
    toastTimerRef.current = setTimeout(() => { setToast(null) }, 2000)
  }

  useEffect(() => () => {
    if (toastTimerRef.current !== null) clearTimeout(toastTimerRef.current)
  }, [])

  const handleSave = (name: string, category: PresetCategory): void => {
    savePreset(name, category)
    setShowSave(false)
    showToast(`Preset "${name}" saved`)
  }

  const handleLoad = (preset: MidiPreset): void => {
    loadPreset(preset.id)
    showToast(`Loaded "${preset.name}"`)
  }

  const handleDelete = (preset: MidiPreset): void => {
    if (!window.confirm(`Delete preset "${preset.name}"?`)) return
    deletePreset(preset.id)
    showToast(`Deleted "${preset.name}"`)
  }

  const filtered = presets.filter(p => {
    const matchCat    = filter === 'all' || p.category === filter
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  // ── Styles ───────────────────────────────────────────────────────────────────

  const containerStyle: React.CSSProperties = {
    background:   '#08080f',
    border:       '1px solid rgba(255,255,255,0.06)',
    borderRadius: 10,
    padding:      '14px 16px',
    fontFamily:   'monospace',
    minHeight:    300,
    display:      'flex',
    flexDirection: 'column',
    gap:          12,
  }

  const titleStyle: React.CSSProperties = {
    fontSize:      9,
    color:         '#2d2d42',
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontWeight:    700,
  }

  const toolbarStyle: React.CSSProperties = {
    display:     'flex',
    alignItems:  'center',
    gap:         10,
    flexWrap:    'wrap',
  }

  const btnBase: React.CSSProperties = {
    background:   'rgba(124,58,237,0.2)',
    border:       '1px solid rgba(124,58,237,0.5)',
    borderRadius: 5,
    color:        '#a855f7',
    fontSize:     10,
    fontFamily:   'monospace',
    cursor:       'pointer',
    padding:      '5px 12px',
    whiteSpace:   'nowrap',
  }

  const selectStyle: React.CSSProperties = {
    background:   '#0b0b14',
    border:       '1px solid rgba(255,255,255,0.08)',
    borderRadius: 5,
    color:        '#94a3b8',
    fontSize:     10,
    fontFamily:   'monospace',
    padding:      '4px 8px',
    cursor:       'pointer',
    outline:      'none',
  }

  const searchInput: React.CSSProperties = {
    background:   '#0b0b14',
    border:       '1px solid rgba(255,255,255,0.08)',
    borderRadius: 5,
    color:        '#e2e8f0',
    fontSize:     10,
    fontFamily:   'monospace',
    padding:      '4px 8px',
    outline:      'none',
    width:        140,
  }

  const tableStyle: React.CSSProperties = {
    width:          '100%',
    borderCollapse: 'collapse',
  }

  const thStyle: React.CSSProperties = {
    fontSize:      8,
    color:         '#2d2d42',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight:    700,
    textAlign:     'left',
    padding:       '0 8px 6px',
    borderBottom:  '1px solid rgba(255,255,255,0.05)',
  }

  const tdStyle: React.CSSProperties = {
    padding:       '7px 8px',
    fontSize:      11,
    color:         '#94a3b8',
    borderBottom:  '1px solid rgba(255,255,255,0.03)',
    whiteSpace:    'nowrap',
  }

  const categoryBadge = (cat: PresetCategory): React.CSSProperties => {
    const colors: Record<PresetCategory, string> = {
      arp:      '#7c3aed',
      seq:      '#0ea5e9',
      mapping:  '#10b981',
      drumrack: '#f59e0b',
      full:     '#a855f7',
    }
    const c = colors[cat]
    return {
      display:      'inline-block',
      padding:      '1px 6px',
      borderRadius: 3,
      background:   `${c}22`,
      border:       `1px solid ${c}55`,
      color:        c,
      fontSize:     9,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    }
  }

  const actionBtn = (variant: 'load' | 'del'): React.CSSProperties => ({
    background:   variant === 'load' ? 'rgba(124,58,237,0.15)' : 'rgba(239,68,68,0.1)',
    border:       `1px solid ${variant === 'load' ? 'rgba(124,58,237,0.4)' : 'rgba(239,68,68,0.3)'}`,
    borderRadius: 4,
    color:        variant === 'load' ? '#a855f7' : '#ef4444',
    fontSize:     9,
    fontFamily:   'monospace',
    cursor:       'pointer',
    padding:      '3px 8px',
    marginRight:  variant === 'load' ? 4 : 0,
  })

  return (
    <div style={containerStyle}>
      {/* Title */}
      <span style={titleStyle}>Presets</span>

      {/* Toolbar */}
      <div style={toolbarStyle}>
        <button style={btnBase} onClick={() => setShowSave(true)}>+ Save Current</button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: 1 }}>
            Category
          </span>
          <select
            value={filter}
            onChange={e => setFilter(e.target.value as FilterCategory)}
            style={selectStyle}
          >
            {FILTER_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>
                {cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: 1 }}>
            Search
          </span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter by name…"
            style={searchInput}
          />
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div style={{
          flex:           1,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          color:          '#2d2d42',
          fontSize:       11,
          fontStyle:      'italic',
          paddingTop:     24,
        }}>
          {presets.length === 0
            ? 'No presets yet. Save your first preset above.'
            : 'No presets match the current filter.'}
        </div>
      ) : (
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Category</th>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(preset => (
                <tr key={preset.id} style={{ transition: 'background 0.1s' }}>
                  <td style={{ ...tdStyle, color: '#e2e8f0', fontWeight: 600 }}>{preset.name}</td>
                  <td style={tdStyle}>
                    <span style={categoryBadge(preset.category)}>{preset.category}</span>
                  </td>
                  <td style={{ ...tdStyle, color: '#475569' }}>
                    {new Date(preset.createdAt).toLocaleDateString()}
                  </td>
                  <td style={tdStyle}>
                    <button style={actionBtn('load')} onClick={() => handleLoad(preset)}>Load</button>
                    <button style={actionBtn('del')} onClick={() => handleDelete(preset)}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Save modal */}
      {showSave && (
        <SaveModal onSave={handleSave} onCancel={() => setShowSave(false)} />
      )}

      {/* Toast */}
      {toast !== null && <Toast key={toast.id} message={toast.message} />}
    </div>
  )
}
