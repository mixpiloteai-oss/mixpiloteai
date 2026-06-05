// ─── FxChainPanel.tsx ─────────────────────────────────────────────────────────
// Expandable FX insert chain panel with drag-to-reorder.

import React, { useState, useCallback } from 'react'
import { useMixerStore, type InsertSlot } from './useMixerStore'

interface FxChainPanelProps {
  trackId: string
}

const PRESET_KEY = (id: string) => `fx-chain-${id}`

export const FxChainPanel: React.FC<FxChainPanelProps> = ({ trackId }) => {
  const { getOrCreate, addInsert, removeInsert, toggleInsert } = useMixerStore()
  const channel  = getOrCreate(trackId)
  const inserts  = channel.inserts

  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [addName, setAddName] = useState('')

  const savePreset = useCallback(() => {
    localStorage.setItem(PRESET_KEY(trackId), JSON.stringify(inserts))
  }, [trackId, inserts])

  const loadPreset = useCallback(() => {
    const raw = localStorage.getItem(PRESET_KEY(trackId))
    if (!raw) return
    try {
      const loaded = JSON.parse(raw) as InsertSlot[]
      // Replace inserts via remove-all + add-all
      for (const ins of inserts) removeInsert(trackId, ins.id)
      for (const ins of loaded)  addInsert(trackId, ins.name)
    } catch { /* invalid preset */ }
  }, [trackId, inserts, addInsert, removeInsert])

  const onDragStart = (i: number) => setDragIdx(i)
  const onDragOver  = (e: React.DragEvent) => e.preventDefault()
  const onDrop      = (dropIdx: number) => {
    if (dragIdx === null || dragIdx === dropIdx) return
    // Reorder: move dragIdx to dropIdx
    const reordered = [...inserts]
    const [moved]   = reordered.splice(dragIdx, 1)
    reordered.splice(dropIdx, 0, moved)
    // Apply: remove all + re-add in order
    for (const ins of inserts)    removeInsert(trackId, ins.id)
    for (const ins of reordered) addInsert(trackId, ins.name)
    setDragIdx(null)
  }

  return (
    <div style={{ padding: '6px 8px', background: '#0f172a', borderRadius: 6, minWidth: 200 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6, gap: 6 }}>
        <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, flex: 1 }}>FX CHAIN</span>
        <button onClick={savePreset} title="Save preset" style={btnStyle}>💾</button>
        <button onClick={loadPreset} title="Load preset" style={btnStyle}>📂</button>
      </div>

      {inserts.map((ins, i) => (
        <div
          key={ins.id}
          draggable
          onDragStart={() => onDragStart(i)}
          onDragOver={onDragOver}
          onDrop={() => onDrop(i)}
          style={{
            display:      'flex',
            alignItems:   'center',
            gap:          4,
            padding:      '3px 6px',
            marginBottom: 2,
            background:   dragIdx === i ? '#1e293b' : '#1a2234',
            borderRadius: 4,
            cursor:       'grab',
            border:       `1px solid ${ins.enabled ? '#334155' : '#1e293b'}`,
          }}
        >
          <button
            onClick={() => toggleInsert(trackId, ins.id)}
            title={ins.enabled ? 'Bypass' : 'Enable'}
            style={{ width: 8, height: 8, borderRadius: '50%', border: 'none', cursor: 'pointer', background: ins.enabled ? '#22c55e' : '#475569', padding: 0 }}
          />
          <span style={{ flex: 1, fontSize: 11, color: ins.enabled ? '#e2e8f0' : '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {ins.name}
          </span>
          <button onClick={() => removeInsert(trackId, ins.id)} style={{ ...btnStyle, color: '#ef4444' }}>×</button>
        </div>
      ))}

      {inserts.length < 8 && (
        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          <input
            value={addName}
            onChange={e => setAddName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && addName.trim()) { addInsert(trackId, addName.trim()); setAddName('') } }}
            placeholder="+ Add FX…"
            style={{ flex: 1, background: '#1e293b', border: '1px solid #334155', borderRadius: 4, padding: '2px 6px', fontSize: 11, color: '#e2e8f0' }}
          />
          <button
            onClick={() => { if (addName.trim()) { addInsert(trackId, addName.trim()); setAddName('') } }}
            style={{ ...btnStyle, background: '#334155' }}
          >
            +
          </button>
        </div>
      )}
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 12, padding: '0 2px',
}

export default FxChainPanel
