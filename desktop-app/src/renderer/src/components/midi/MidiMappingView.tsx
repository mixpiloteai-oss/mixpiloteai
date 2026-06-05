import { useRef, useState } from 'react'
import { useMidiStore } from '../../store/midiStore'
import type { MidiAssignment } from '../../store/midiStore'
import { getMidiMappingEngine } from '../../audio/midi/MidiMappingEngine'
import { getMidiLearnManager } from '../../audio/midi/MidiLearnManager'

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  root: {
    background:   '#08080f',
    border:       '1px solid rgba(255,255,255,0.06)',
    borderRadius: 6,
    padding:      '12px 14px',
    fontFamily:   'monospace',
    minWidth:     560,
  },
  header: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   10,
  },
  title: {
    fontSize:    10,
    fontWeight:  700,
    letterSpacing: '0.12em',
    color:       '#475569',
    textTransform: 'uppercase' as const,
  },
  actions: {
    display: 'flex',
    gap:     6,
  },
  btn: (color: string): React.CSSProperties => ({
    padding:      '4px 10px',
    background:   `${color}18`,
    border:       `1px solid ${color}44`,
    borderRadius: 3,
    color,
    fontSize:     9,
    fontWeight:   700,
    letterSpacing: '0.08em',
    cursor:       'pointer',
    fontFamily:   'monospace',
    textTransform: 'uppercase' as const,
  }),
  tableWrap: {
    overflowX: 'auto' as const,
  },
  table: {
    width:          '100%',
    borderCollapse: 'collapse' as const,
    fontSize:       10,
  },
  th: {
    color:         '#334155',
    fontSize:      9,
    fontWeight:    700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    textAlign:     'left' as const,
    padding:       '4px 8px',
    borderBottom:  '1px solid rgba(255,255,255,0.05)',
  },
  tdBase: {
    padding:      '5px 8px',
    color:        '#94a3b8',
    borderBottom: '1px solid rgba(255,255,255,0.03)',
    verticalAlign: 'middle' as const,
  },
  numberInput: {
    background:   'rgba(255,255,255,0.04)',
    border:       '1px solid rgba(255,255,255,0.06)',
    borderRadius: 3,
    color:        '#94a3b8',
    fontSize:     10,
    fontFamily:   'monospace',
    width:        44,
    padding:      '2px 4px',
    textAlign:    'center' as const,
  },
  checkbox: {
    accentColor: '#a855f7',
    cursor:      'pointer',
    width:       13,
    height:      13,
  },
  rowActions: {
    display: 'flex',
    gap:     4,
  },
  iconBtn: (color: string): React.CSSProperties => ({
    background:   'transparent',
    border:       `1px solid ${color}33`,
    borderRadius: 3,
    color,
    fontSize:     9,
    fontWeight:   700,
    cursor:       'pointer',
    padding:      '2px 6px',
    fontFamily:   'monospace',
    letterSpacing: '0.06em',
  }),
  emptyRow: {
    textAlign: 'center' as const,
    color:     '#1e293b',
    fontSize:  10,
    fontStyle: 'italic' as const,
    padding:   '12px 0',
  },
  addForm: {
    display:       'flex',
    alignItems:    'center',
    gap:           8,
    marginTop:     10,
    padding:       '8px 10px',
    background:    'rgba(124,58,237,0.06)',
    border:        '1px solid rgba(124,58,237,0.18)',
    borderRadius:  4,
  },
  addInput: {
    flex:         1,
    background:   'rgba(255,255,255,0.04)',
    border:       '1px solid rgba(255,255,255,0.08)',
    borderRadius: 3,
    color:        '#e2e8f0',
    fontSize:     10,
    fontFamily:   'monospace',
    padding:      '4px 8px',
    outline:      'none',
  },
  addLabel: {
    fontSize:    10,
    color:       '#475569',
    flexShrink:  0,
  },
} as const

// ─── MappingRow ───────────────────────────────────────────────────────────────

interface MappingRowProps {
  a:              MidiAssignment
  isLearning:     boolean
  onLearn:        (targetId: string) => void
  onRemove:       (targetId: string) => void
  onUpdateMinOut: (targetId: string, v: number) => void
  onUpdateMaxOut: (targetId: string, v: number) => void
  onUpdatePickup: (targetId: string, v: boolean) => void
}

function MappingRow({
  a,
  isLearning,
  onLearn,
  onRemove,
  onUpdateMinOut,
  onUpdateMaxOut,
  onUpdatePickup,
}: MappingRowProps): JSX.Element {
  const label = a.targetId.length > 24 ? `${a.targetId.slice(0, 22)}…` : a.targetId

  return (
    <tr>
      <td style={S.tdBase} title={a.targetId}>{label}</td>
      <td style={{ ...S.tdBase, color: '#a855f7' }}>CC{a.cc}</td>
      <td style={S.tdBase}>ch{a.channel + 1}</td>
      <td style={S.tdBase}>
        <input
          type="number"
          style={S.numberInput}
          value={a.minOut}
          min={0}
          max={127}
          onChange={(e) => { onUpdateMinOut(a.targetId, Number(e.target.value)) }}
        />
      </td>
      <td style={S.tdBase}>
        <input
          type="number"
          style={S.numberInput}
          value={a.maxOut}
          min={0}
          max={127}
          onChange={(e) => { onUpdateMaxOut(a.targetId, Number(e.target.value)) }}
        />
      </td>
      <td style={{ ...S.tdBase, textAlign: 'center' }}>
        <input
          type="checkbox"
          style={S.checkbox}
          checked={a.pickupMode}
          onChange={(e) => { onUpdatePickup(a.targetId, e.target.checked) }}
        />
      </td>
      <td style={S.tdBase}>
        <div style={S.rowActions}>
          <button
            style={S.iconBtn(isLearning ? '#475569' : '#a855f7')}
            disabled={isLearning}
            onClick={() => { onLearn(a.targetId) }}
          >
            LEARN
          </button>
          <button
            style={S.iconBtn('#ef4444')}
            onClick={() => { onRemove(a.targetId) }}
          >
            ×
          </button>
        </div>
      </td>
    </tr>
  )
}

// ─── MidiMappingView ──────────────────────────────────────────────────────────

export default function MidiMappingView(): JSX.Element {
  const assignments      = useMidiStore(s => s.assignments)
  const isLearning       = useMidiStore(s => s.isLearning)
  const setLearning       = useMidiStore(s => s.setLearning)
  const addAssignment     = useMidiStore(s => s.addAssignment)
  const updateAssignment  = useMidiStore(s => s.updateAssignment)
  const removeAssignment  = useMidiStore(s => s.removeAssignment)
  const importAssignments = useMidiStore(s => s.importAssignments)

  const [showAddForm, setShowAddForm] = useState<boolean>(false)
  const [newLabel, setNewLabel]       = useState<string>('')

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Export to clipboard
  function handleExport(): void {
    const json = JSON.stringify(assignments, null, 2)
    void navigator.clipboard.writeText(json)
  }

  // Import from .json file — parse JSON manually, feed into learn manager + store
  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result
      if (typeof text !== 'string') return
      // Feed into the engine (wires internal CC routing)
      getMidiLearnManager().importAssignments(text)
      // Sync to store: parse the JSON ourselves for the UI state
      try {
        const raw: unknown = JSON.parse(text)
        if (!Array.isArray(raw)) return
        const valid = raw.filter(
          (item): item is MidiAssignment =>
            typeof item === 'object' &&
            item !== null &&
            typeof (item as Record<string, unknown>).targetId === 'string' &&
            typeof (item as Record<string, unknown>).cc       === 'number' &&
            typeof (item as Record<string, unknown>).channel  === 'number',
        )
        importAssignments(valid)
      } catch {
        // malformed JSON — ignore
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // Arm a specific target for re-learn — register a learn-complete hook then arm
  function handleLearn(targetId: string): void {
    const existing = assignments.find(a => a.targetId === targetId)
    const label    = existing?.targetId ?? targetId

    // One-shot: listen for the learn-complete event to capture the new assignment
    getMidiLearnManager().onLearnComplete = (assignment: MidiAssignment) => {
      addAssignment(assignment)
      setLearning(false)
      getMidiLearnManager().onLearnComplete = null
    }

    getMidiMappingEngine().armParam(targetId, label, (_v: number) => {
      // value callback — handled by consumers; learn-complete fires separately
    })
    setLearning(true, targetId, label)
  }

  // Arm a new param from the add form
  function handleArm(): void {
    const label = newLabel.trim()
    if (!label) return

    getMidiLearnManager().onLearnComplete = (assignment: MidiAssignment) => {
      addAssignment(assignment)
      setLearning(false)
      setShowAddForm(false)
      setNewLabel('')
      getMidiLearnManager().onLearnComplete = null
    }

    getMidiMappingEngine().armParam(label, label, (_v: number) => {
      // value callback placeholder
    })
    setLearning(true, label, label)
    setShowAddForm(false)
  }

  return (
    <div style={S.root}>
      {/* Header */}
      <div style={S.header}>
        <span style={S.title}>MIDI Mappings</span>
        <div style={S.actions}>
          <button style={S.btn('#a855f7')} onClick={() => { setShowAddForm(v => !v) }}>
            + Add mapping
          </button>
          <button style={S.btn('#10b981')} onClick={handleExport} disabled={assignments.length === 0}>
            Export JSON
          </button>
          <button
            style={S.btn('#3b82f6')}
            onClick={() => { fileInputRef.current?.click() }}
          >
            Import
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
        </div>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div style={S.addForm}>
          <span style={S.addLabel}>Label:</span>
          <input
            style={S.addInput}
            type="text"
            placeholder="e.g. Master Volume"
            value={newLabel}
            onChange={(e) => { setNewLabel(e.target.value) }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleArm() }}
            autoFocus
          />
          <button style={S.btn('#a855f7')} onClick={handleArm} disabled={!newLabel.trim() || isLearning}>
            Arm
          </button>
          <button style={S.btn('#475569')} onClick={() => { setShowAddForm(false); setNewLabel('') }}>
            Cancel
          </button>
        </div>
      )}

      {/* Table */}
      <div style={S.tableWrap}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Target</th>
              <th style={S.th}>CC</th>
              <th style={S.th}>CH</th>
              <th style={S.th}>Min</th>
              <th style={S.th}>Max</th>
              <th style={{ ...S.th, textAlign: 'center' }}>Pickup</th>
              <th style={S.th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {assignments.length === 0 && (
              <tr>
                <td colSpan={7} style={S.emptyRow}>No mappings — click "+ Add mapping" to get started</td>
              </tr>
            )}
            {assignments.map(a => (
              <MappingRow
                key={a.targetId}
                a={a}
                isLearning={isLearning}
                onLearn={handleLearn}
                onRemove={removeAssignment}
                onUpdateMinOut={(id, v) => { updateAssignment(id, { minOut: v }) }}
                onUpdateMaxOut={(id, v) => { updateAssignment(id, { maxOut: v }) }}
                onUpdatePickup={(id, v) => { updateAssignment(id, { pickupMode: v }) }}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
