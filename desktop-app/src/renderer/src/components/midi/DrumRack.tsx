import { useEffect, useRef, useState } from 'react'
import { useMidiStore } from '../../store/midiStore'
import type { DrumPad } from '../../store/midiStore'
import { getMidiEngine } from '../../audio/midi/MidiEngine'
import { getMidiDeviceManager } from '../../audio/midi/MidiDeviceManager'

// ─── Note name helper ─────────────────────────────────────────────────────────

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

function pitchToName(pitch: number): string {
  const name = NOTE_NAMES[pitch % 12]
  const octave = Math.floor(pitch / 12) - 1
  return `${name ?? 'C'}${octave}`
}

// ─── Keyboard layout ──────────────────────────────────────────────────────────

const PAD_KEYS: string[] = [
  'a', 's', 'd', 'f',
  'z', 'x', 'c', 'v',
  'q', 'w', 'e', 'r',
  '1', '2', '3', '4',
]

// ─── Pad component ────────────────────────────────────────────────────────────

interface PadProps {
  pad:        DrumPad
  keyLabel:   string
  editMode:   boolean
  isSelected: boolean
  onHit:      (pad: DrumPad) => void
  onSelect:   (pad: DrumPad) => void
  onVelocity: (padId: string, v: number) => void
  onMute:     (padId: string, muted: boolean) => void
  onSolo:     (padId: string, soloed: boolean) => void
  onNote:     (padId: string, note: number) => void
}

function Pad({
  pad, keyLabel, editMode, isSelected,
  onHit, onSelect, onVelocity, onMute, onSolo, onNote,
}: PadProps): JSX.Element {
  const padOuter: React.CSSProperties = {
    position:      'relative',
    width:         80,
    height:        editMode ? 110 : 72,
    borderRadius:  8,
    background:    pad.active
      ? pad.color
      : `${pad.color}26`,
    border:        pad.soloed
      ? `2px solid #f97316`
      : isSelected
        ? `2px solid rgba(168,85,247,0.8)`
        : `1px solid ${pad.color}55`,
    cursor:        'pointer',
    display:       'flex',
    flexDirection: 'column',
    alignItems:    'center',
    justifyContent: 'flex-start',
    padding:       '8px 6px 6px',
    overflow:      'hidden',
    transition:    'background 0.08s, box-shadow 0.08s',
    boxShadow:     pad.active
      ? `0 0 18px ${pad.color}88, inset 0 0 8px ${pad.color}44`
      : pad.soloed
        ? `0 0 12px #f9731666`
        : 'none',
    flexShrink:    0,
    userSelect:    'none',
    opacity:       pad.muted ? 0.35 : 1,
  }

  const nameStyle: React.CSSProperties = {
    fontSize:      10,
    fontWeight:    700,
    fontFamily:    'monospace',
    color:         pad.active ? '#fff' : '#e2e8f0',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign:     'center',
    lineHeight:    1.2,
  }

  const noteStyle: React.CSSProperties = {
    fontSize:  8,
    color:     pad.active ? 'rgba(255,255,255,0.8)' : '#475569',
    fontFamily: 'monospace',
    marginTop: 3,
  }

  const keyBadge: React.CSSProperties = {
    position:     'absolute',
    bottom:       5,
    right:        6,
    fontSize:     8,
    color:        '#2d2d42',
    fontFamily:   'monospace',
    textTransform: 'uppercase',
  }

  // Muted diagonal stripe overlay
  const muteOverlay: React.CSSProperties = {
    position:    'absolute',
    inset:       0,
    borderRadius: 7,
    background:  `repeating-linear-gradient(
      -45deg,
      transparent,
      transparent 6px,
      rgba(0,0,0,0.4) 6px,
      rgba(0,0,0,0.4) 8px
    )`,
    pointerEvents: 'none',
  }

  return (
    <div
      style={padOuter}
      onPointerDown={() => { onSelect(pad); onHit(pad) }}
    >
      {pad.muted && <div style={muteOverlay} />}

      <span style={nameStyle}>{pad.name}</span>
      <span style={noteStyle}>{pitchToName(pad.note)} ({pad.note})</span>

      {editMode && (
        <div
          style={{ width: '100%', marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}
          onPointerDown={e => e.stopPropagation()}
        >
          {/* Note input */}
          <input
            type="number" min={0} max={127} value={pad.note}
            onChange={e => onNote(pad.id, Math.max(0, Math.min(127, parseInt(e.target.value, 10) || 0)))}
            style={{
              width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 3, color: '#e2e8f0', fontSize: 10, fontFamily: 'monospace',
              padding: '2px 4px', outline: 'none', boxSizing: 'border-box',
            }}
          />
          {/* Velocity slider */}
          <input
            type="range" min={1} max={127} value={pad.velocity}
            onChange={e => onVelocity(pad.id, parseInt(e.target.value, 10))}
            style={{ accentColor: pad.color, width: '100%' }}
          />
          {/* M / S */}
          <div style={{ display: 'flex', gap: 3 }}>
            <button
              style={{
                flex: 1, height: 16, fontSize: 8, fontFamily: 'monospace', cursor: 'pointer',
                background: pad.muted ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${pad.muted ? '#ef4444' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 3, color: pad.muted ? '#ef4444' : '#475569',
              }}
              onClick={() => onMute(pad.id, !pad.muted)}
            >M</button>
            <button
              style={{
                flex: 1, height: 16, fontSize: 8, fontFamily: 'monospace', cursor: 'pointer',
                background: pad.soloed ? 'rgba(249,115,22,0.3)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${pad.soloed ? '#f97316' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 3, color: pad.soloed ? '#f97316' : '#475569',
              }}
              onClick={() => onSolo(pad.id, !pad.soloed)}
            >S</button>
          </div>
        </div>
      )}

      <span style={keyBadge}>{keyLabel}</span>
    </div>
  )
}

// ─── DrumRack ─────────────────────────────────────────────────────────────────

export default function DrumRack(): JSX.Element {
  const {
    drumPads,
    setDrumPadActive, setDrumPadVelocity, setDrumPadMute, setDrumPadSolo, setDrumPadNote,
  } = useMidiStore()

  const [editMode, setEditMode]     = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selectedPad = drumPads.find(p => p.id === selectedId) ?? null

  // ── Pad hit ──────────────────────────────────────────────────────────────────

  const handleHit = (pad: DrumPad): void => {
    if (pad.muted) return
    getMidiEngine().noteOn(pad.note, pad.velocity, pad.channel)
    setDrumPadActive(pad.id, true)
    setTimeout(() => { getMidiEngine().noteOff(pad.note, pad.channel) }, 100)
    setTimeout(() => { setDrumPadActive(pad.id, false) }, 150)
  }

  // ── MIDI input subscription ──────────────────────────────────────────────────

  useEffect(() => {
    const unsub = getMidiDeviceManager().onMessage((_deviceId, data) => {
      const status  = data[0]
      const note    = data[1]
      const velocity = data[2]

      if (status === undefined || note === undefined || velocity === undefined) return

      const isNoteOn = (status & 0xf0) === 0x90 && velocity > 0
      if (!isNoteOn) return

      const pad = useMidiStore.getState().drumPads.find(p => p.note === note)
      if (!pad) return

      setDrumPadActive(pad.id, true)
      setTimeout(() => { setDrumPadActive(pad.id, false) }, 150)
    })
    return unsub
  }, [setDrumPadActive])

  // ── Keyboard shortcuts ───────────────────────────────────────────────────────

  const drumPadsRef = useRef(drumPads)
  drumPadsRef.current = drumPads

  useEffect(() => {
    function handleKey(e: KeyboardEvent): void {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const idx = PAD_KEYS.indexOf(e.key.toLowerCase())
      if (idx === -1) return
      const pad = drumPadsRef.current[idx]
      if (!pad) return
      handleHit(pad)
      setSelectedId(pad.id)
    }
    window.addEventListener('keydown', handleKey)
    return () => { window.removeEventListener('keydown', handleKey) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Styles ───────────────────────────────────────────────────────────────────

  const containerStyle: React.CSSProperties = {
    background:   '#08080f',
    border:       '1px solid rgba(255,255,255,0.06)',
    borderRadius: 10,
    padding:      '14px 16px',
    fontFamily:   'monospace',
    userSelect:   'none',
  }

  const headerStyle: React.CSSProperties = {
    display:      'flex',
    alignItems:   'center',
    gap:          10,
    marginBottom: 14,
  }

  const titleStyle: React.CSSProperties = {
    fontSize:      9,
    color:         '#2d2d42',
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontWeight:    700,
    flex:          1,
  }

  const toggleBtn = (active: boolean): React.CSSProperties => ({
    background:   active ? 'rgba(124,58,237,0.25)' : 'rgba(255,255,255,0.04)',
    border:       `1px solid ${active ? 'rgba(124,58,237,0.6)' : 'rgba(255,255,255,0.08)'}`,
    borderRadius: 5,
    color:        active ? '#a855f7' : '#475569',
    fontSize:     10,
    fontFamily:   'monospace',
    cursor:       'pointer',
    padding:      '4px 10px',
  })

  const gridStyle: React.CSSProperties = {
    display:       'grid',
    gridTemplateColumns: 'repeat(4, 80px)',
    gap:           8,
  }

  const footerStyle: React.CSSProperties = {
    marginTop:    12,
    display:      'flex',
    alignItems:   'center',
    gap:          12,
    flexWrap:     'wrap',
    paddingTop:   10,
    borderTop:    '1px solid rgba(255,255,255,0.05)',
  }

  const infoLabel: React.CSSProperties = {
    fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: 1,
  }

  const infoValue: React.CSSProperties = {
    fontSize: 11, color: '#94a3b8', fontFamily: 'monospace',
  }

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <span style={titleStyle}>Drum Rack</span>
        <button style={toggleBtn(editMode)} onClick={() => setEditMode(v => !v)}>
          {editMode ? '✎ Editing' : '✎ Edit Mode'}
        </button>
      </div>

      {/* 4×4 Grid */}
      <div style={gridStyle}>
        {drumPads.map((pad, idx) => (
          <Pad
            key={pad.id}
            pad={pad}
            keyLabel={PAD_KEYS[idx] ?? ''}
            editMode={editMode}
            isSelected={pad.id === selectedId}
            onHit={handleHit}
            onSelect={p => setSelectedId(p.id)}
            onVelocity={setDrumPadVelocity}
            onMute={setDrumPadMute}
            onSolo={setDrumPadSolo}
            onNote={setDrumPadNote}
          />
        ))}
      </div>

      {/* Footer info */}
      <div style={footerStyle}>
        {selectedPad !== null ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={infoLabel}>Selected</span>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: selectedPad.color }} />
              <span style={infoValue}>{selectedPad.name}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={infoLabel}>Note</span>
              <span style={infoValue}>{pitchToName(selectedPad.note)} ({selectedPad.note})</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={infoLabel}>Vel</span>
              <span style={infoValue}>{selectedPad.velocity}</span>
            </div>
            <button
              style={toggleBtn(selectedPad.muted)}
              onClick={() => setDrumPadMute(selectedPad.id, !selectedPad.muted)}
            >M</button>
            <button
              style={toggleBtn(selectedPad.soloed)}
              onClick={() => setDrumPadSolo(selectedPad.id, !selectedPad.soloed)}
            >S</button>
          </>
        ) : (
          <span style={{ ...infoLabel, fontStyle: 'italic' }}>Click or press a key to select a pad</span>
        )}
      </div>
    </div>
  )
}
