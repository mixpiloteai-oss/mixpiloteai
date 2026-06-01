// ─── AutomationEditorPanel.tsx ────────────────────────────────────────────────
// Full automation editor panel with toolbar and lane list.

import React, { useState } from 'react'
import { useAutomationStore } from '../../store/automationStore'
import { AutomationLaneEditor } from './AutomationLaneEditor'
import { AutomationMiniLane } from './AutomationMiniLane'
import type { AutomationCurveType } from '../../audio/automation/AutomationTypes'

const SNAP_OPTIONS: { label: string; value: number }[] = [
  { label: '1/16', value: 0.0625 },
  { label: '1/8', value: 0.125 },
  { label: '1/4', value: 0.25 },
  { label: '1/2', value: 0.5 },
  { label: '1', value: 1.0 },
]

const OPERATIONS = ['Scale', 'Smooth', 'Randomize', 'Invert'] as const
type Operation = (typeof OPERATIONS)[number]

export function AutomationEditorPanel(): React.ReactElement {
  const store = useAutomationStore()
  const [panelWidth] = useState(800)
  const [pendingOp, setPendingOp] = useState<Operation | null>(null)

  const laneEditorWidth = panelWidth - 120

  const handleAddDemoLane = () => {
    store.addLane({
      type: 'track-volume',
      trackId: `track_${Date.now()}`,
      paramName: 'Volume',
      minValue: 0,
      maxValue: 1,
      defaultValue: 0.75,
      unit: 'dB',
    })
  }

  const handleOperation = (laneId: string, op: Operation) => {
    const selectedLane = store.lanes.find((l) => l.id === laneId)
    if (!selectedLane || selectedLane.points.length === 0) return
    const beats = selectedLane.points.map((p) => p.beat)
    const start = Math.min(...beats)
    const end = Math.max(...beats)

    switch (op) {
      case 'Scale':
        store.scaleRange(laneId, start, end, 1.5)
        break
      case 'Smooth':
        store.smoothRange(laneId, start, end, 1)
        break
      case 'Randomize':
        store.randomizeRange(laneId, start, end, 0.1)
        break
      case 'Invert':
        store.invertRange(laneId, start, end)
        break
    }
    setPendingOp(null)
  }

  return (
    <div
      style={{
        background: '#0a0a14',
        border: '1px solid #222',
        borderRadius: 8,
        overflow: 'hidden',
        fontFamily: 'system-ui, sans-serif',
        color: '#ccc',
        userSelect: 'none',
        width: panelWidth,
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          height: 40,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 10px',
          borderBottom: '1px solid #222',
          background: '#111',
          flexShrink: 0,
          flexWrap: 'wrap',
        }}
      >
        {/* Edit mode buttons */}
        {(['draw', 'select', 'erase'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => store.setEditMode(mode)}
            style={{
              padding: '3px 10px',
              fontSize: 12,
              border: `1px solid ${store.editMode === mode ? '#10b981' : '#333'}`,
              background: store.editMode === mode ? '#10b98120' : 'transparent',
              color: store.editMode === mode ? '#10b981' : '#888',
              borderRadius: 4,
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {mode}
          </button>
        ))}

        <div style={{ width: 1, height: 20, background: '#333' }} />

        {/* Snap controls */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
          <input
            type="checkbox"
            checked={store.snapEnabled}
            onChange={(e) => store.setSnapEnabled(e.target.checked)}
          />
          Snap
        </label>
        <select
          value={store.snapBeats}
          onChange={(e) => store.setSnapBeats(Number(e.target.value))}
          style={{
            background: '#1a1a2e',
            color: '#ccc',
            border: '1px solid #333',
            borderRadius: 4,
            fontSize: 12,
            padding: '2px 4px',
          }}
        >
          {SNAP_OPTIONS.map(({ label, value }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <div style={{ width: 1, height: 20, background: '#333' }} />

        {/* Zoom controls */}
        <button
          onClick={() => store.setZoom(Math.max(20, store.zoom - 20))}
          style={{ padding: '2px 8px', fontSize: 13, background: '#1a1a2e', border: '1px solid #333', color: '#ccc', borderRadius: 4, cursor: 'pointer' }}
        >
          −
        </button>
        <span style={{ fontSize: 12, minWidth: 32, textAlign: 'center' }}>{store.zoom}</span>
        <button
          onClick={() => store.setZoom(Math.min(400, store.zoom + 20))}
          style={{ padding: '2px 8px', fontSize: 13, background: '#1a1a2e', border: '1px solid #333', color: '#ccc', borderRadius: 4, cursor: 'pointer' }}
        >
          +
        </button>

        <div style={{ width: 1, height: 20, background: '#333' }} />

        {/* Add lane */}
        <button
          onClick={handleAddDemoLane}
          style={{
            padding: '3px 10px',
            fontSize: 12,
            background: '#1a1a2e',
            border: '1px solid #333',
            color: '#10b981',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          + Lane
        </button>

        {/* Record button */}
        <button
          onClick={() => (store.isRecording ? store.stopRecording() : store.startRecording())}
          style={{
            padding: '3px 10px',
            fontSize: 12,
            background: store.isRecording ? '#ef444420' : 'transparent',
            border: `1px solid ${store.isRecording ? '#ef4444' : '#333'}`,
            color: store.isRecording ? '#ef4444' : '#888',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          {store.isRecording ? '■ Stop' : '● Record'}
        </button>

        {/* Operations dropdown */}
        <select
          value={pendingOp ?? ''}
          onChange={(e) => {
            const op = e.target.value as Operation
            if (op && store.selectedLaneId) {
              handleOperation(store.selectedLaneId, op)
            }
          }}
          style={{
            background: '#1a1a2e',
            color: '#ccc',
            border: '1px solid #333',
            borderRadius: 4,
            fontSize: 12,
            padding: '2px 4px',
          }}
        >
          <option value="">Operations…</option>
          {OPERATIONS.map((op) => (
            <option key={op} value={op}>
              {op}
            </option>
          ))}
        </select>
      </div>

      {/* Lane list */}
      <div style={{ overflowY: 'auto', maxHeight: 400 }}>
        {store.lanes
          .filter((l) => l.visible)
          .map((lane) => (
            <div
              key={lane.id}
              style={{
                display: 'flex',
                alignItems: 'stretch',
                borderBottom: '1px solid #111',
                background: store.selectedLaneId === lane.id ? '#0d0d2a' : 'transparent',
              }}
              onClick={() => store.selectLane(lane.id)}
            >
              {/* Lane header */}
              <div
                style={{
                  width: 120,
                  flexShrink: 0,
                  padding: '4px 6px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  gap: 3,
                  borderRight: '1px solid #222',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: lane.color,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 11,
                      color: '#ccc',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                    }}
                  >
                    {lane.target.paramName}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      store.removeLane(lane.id)
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#666',
                      cursor: 'pointer',
                      padding: '0 2px',
                      fontSize: 12,
                    }}
                  >
                    ×
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  {/* Enable toggle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      store.setLaneEnabled(lane.id, !lane.enabled)
                    }}
                    title={lane.enabled ? 'Bypass' : 'Enable'}
                    style={{
                      fontSize: 9,
                      padding: '1px 4px',
                      background: lane.enabled ? '#10b98120' : '#33333320',
                      border: `1px solid ${lane.enabled ? '#10b981' : '#444'}`,
                      color: lane.enabled ? '#10b981' : '#666',
                      borderRadius: 3,
                      cursor: 'pointer',
                    }}
                  >
                    {lane.enabled ? 'ON' : 'OFF'}
                  </button>
                  {/* Fold toggle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      store.setLaneFolded(lane.id, !lane.folded)
                    }}
                    title={lane.folded ? 'Expand' : 'Fold'}
                    style={{
                      fontSize: 9,
                      padding: '1px 4px',
                      background: 'transparent',
                      border: '1px solid #333',
                      color: '#888',
                      borderRadius: 3,
                      cursor: 'pointer',
                    }}
                  >
                    {lane.folded ? '▶' : '▼'}
                  </button>
                  {/* Record arm */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      store.setLaneRecordArmed(lane.id, !lane.recordArmed)
                    }}
                    title="Record arm"
                    style={{
                      fontSize: 9,
                      padding: '1px 4px',
                      background: lane.recordArmed ? '#ef444420' : 'transparent',
                      border: `1px solid ${lane.recordArmed ? '#ef4444' : '#333'}`,
                      color: lane.recordArmed ? '#ef4444' : '#666',
                      borderRadius: 3,
                      cursor: 'pointer',
                    }}
                  >
                    ●
                  </button>
                </div>
              </div>

              {/* Lane editor or mini lane */}
              <div style={{ flex: 1, overflow: 'hidden' }}>
                {lane.folded ? (
                  <AutomationMiniLane
                    lane={lane}
                    width={laneEditorWidth}
                    totalBeats={32}
                  />
                ) : (
                  <AutomationLaneEditor
                    lane={lane}
                    width={laneEditorWidth}
                    height={lane.height}
                    zoom={store.zoom}
                    scrollBeat={store.scrollBeat}
                    snapBeats={store.snapBeats}
                    snapEnabled={store.snapEnabled}
                    editMode={store.editMode}
                    onPointAdd={(beat, value) => store.addPoint(lane.id, beat, value)}
                    onPointMove={(pointId, beat, value) =>
                      store.movePoint(lane.id, pointId, beat, value)
                    }
                    onPointRemove={(pointId) => store.removePoint(lane.id, pointId)}
                    onCurveChange={(pointId, curve: AutomationCurveType) =>
                      store.updateCurve(lane.id, pointId, curve)
                    }
                  />
                )}
              </div>
            </div>
          ))}
        {store.lanes.filter((l) => l.visible).length === 0 && (
          <div
            style={{
              padding: 24,
              textAlign: 'center',
              color: '#555',
              fontSize: 13,
            }}
          >
            No automation lanes. Click "+ Lane" to add one.
          </div>
        )}
      </div>
    </div>
  )
}
