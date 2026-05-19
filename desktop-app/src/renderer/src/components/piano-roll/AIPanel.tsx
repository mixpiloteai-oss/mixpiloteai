import { useState } from 'react'
import { usePianoRollStore }        from './usePianoRollStore'
import { PROGRESSIONS }             from '../../lib/musicTheory'
import type { ChordType }           from '../../lib/musicTheory'
import { SCALE_ROOT_MIDI }          from '../../lib/musicTheory'

// ─── Shared styles ────────────────────────────────────────────────────────────

const PANEL_BG: React.CSSProperties = {
  background:   '#07070e',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  flexShrink:   0,
  padding:      '8px 12px',
  display:      'flex',
  gap:          20,
  alignItems:   'flex-start',
  overflowX:    'auto',
}

const SECTION_STYLE: React.CSSProperties = {
  display:       'flex',
  flexDirection: 'column',
  gap:           6,
  minWidth:      140,
}

const LABEL: React.CSSProperties = {
  fontSize:      9,
  fontWeight:    700,
  letterSpacing: '0.10em',
  color:         '#2d2d42',
  textTransform: 'uppercase',
  marginBottom:  2,
}

const BTN: React.CSSProperties = {
  padding:      '3px 9px',
  borderRadius: 4,
  fontSize:     10,
  background:   'rgba(124,58,237,0.12)',
  border:       '1px solid rgba(124,58,237,0.25)',
  color:        '#a78bfa',
  cursor:       'pointer',
  textAlign:    'left',
}

const SEL: React.CSSProperties = {
  fontSize:     10,
  padding:      '2px 6px',
  borderRadius: 4,
  background:   '#0e0e1c',
  border:       '1px solid #1c1c2e',
  color:        '#64748b',
  outline:      'none',
  cursor:       'pointer',
}

const CHORD_TYPES: ChordType[] = ['maj', 'min', 'min7', 'maj7', '7', 'dim', 'aug', 'sus2', 'sus4', 'add9']

// ─── AIPanel ─────────────────────────────────────────────────────────────────

export default function AIPanel() {
  const {
    scaleRoot, scaleMode,
    generateChord, generateProgression, generateMelodyAI,
    quantize, humanize, randomize,
    snap, timeSigTop,
  } = usePianoRollStore()

  const [chordType,    setChordType]    = useState<ChordType>('min')
  const [chordOctave,  setChordOctave]  = useState(4)
  const [progIdx,      setProgIdx]      = useState(0)
  const [progBeats,    setProgBeats]    = useState(4)
  const [progOctave,   setProgOctave]   = useState(3)
  const [melBars,      setMelBars]      = useState(4)
  const [melDensity,   setMelDensity]   = useState<'sparse'|'medium'|'dense'>('medium')
  const [melOctave,    setMelOctave]    = useState(4)
  const [qStrength,    setQStrength]    = useState(100)
  const [hAmount,      setHAmount]      = useState(50)
  const [rndCount,     setRndCount]     = useState(16)
  const [rndBars,      setRndBars]      = useState(4)

  const rootMidi = SCALE_ROOT_MIDI[scaleRoot] + (chordOctave + 1) * 12

  return (
    <div style={PANEL_BG}>

      {/* ── Chord ──────────────────────────────────────────────────────────── */}
      <div style={SECTION_STYLE}>
        <span style={LABEL}>Chord</span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <select value={chordType} onChange={e => setChordType(e.target.value as ChordType)} style={SEL}>
            {CHORD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <span style={{ fontSize: 9, color: '#334155' }}>oct</span>
          <input
            type="number" value={chordOctave} min={1} max={7}
            onChange={e => setChordOctave(Number(e.target.value))}
            style={{ ...SEL, width: 38 }}
          />
        </div>
        <button
          onClick={() => generateChord(rootMidi, chordType, 0)}
          style={BTN}
        >
          + Chord ({scaleRoot} {chordType})
        </button>
      </div>

      {/* ── Progression ────────────────────────────────────────────────────── */}
      <div style={SECTION_STYLE}>
        <span style={LABEL}>Progression</span>
        <select value={progIdx} onChange={e => setProgIdx(Number(e.target.value))} style={{ ...SEL, maxWidth: 180 }}>
          {PROGRESSIONS.map((p, i) => <option key={i} value={i}>{p.name}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: 9, color: '#334155' }}>beats/ch</span>
          <input
            type="number" value={progBeats} min={1} max={16}
            onChange={e => setProgBeats(Number(e.target.value))}
            style={{ ...SEL, width: 42 }}
          />
          <span style={{ fontSize: 9, color: '#334155' }}>oct</span>
          <input
            type="number" value={progOctave} min={1} max={6}
            onChange={e => setProgOctave(Number(e.target.value))}
            style={{ ...SEL, width: 38 }}
          />
        </div>
        <button
          onClick={() => generateProgression(PROGRESSIONS[progIdx]!.degrees, progBeats, progOctave)}
          style={BTN}
        >
          + Progression
        </button>
      </div>

      {/* ── Melody ─────────────────────────────────────────────────────────── */}
      <div style={SECTION_STYLE}>
        <span style={LABEL}>Melody</span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <select value={melDensity} onChange={e => setMelDensity(e.target.value as 'sparse'|'medium'|'dense')} style={SEL}>
            <option value="sparse">Sparse</option>
            <option value="medium">Medium</option>
            <option value="dense">Dense</option>
          </select>
          <span style={{ fontSize: 9, color: '#334155' }}>bars</span>
          <input
            type="number" value={melBars} min={1} max={32}
            onChange={e => setMelBars(Number(e.target.value))}
            style={{ ...SEL, width: 42 }}
          />
          <span style={{ fontSize: 9, color: '#334155' }}>oct</span>
          <input
            type="number" value={melOctave} min={2} max={7}
            onChange={e => setMelOctave(Number(e.target.value))}
            style={{ ...SEL, width: 38 }}
          />
        </div>
        <button
          onClick={() => generateMelodyAI(melBars, melDensity, melOctave)}
          style={BTN}
        >
          + Melody ({scaleRoot} {scaleMode})
        </button>
      </div>

      {/* ── Quantize ───────────────────────────────────────────────────────── */}
      <div style={SECTION_STYLE}>
        <span style={LABEL}>Quantize</span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: 9, color: '#334155' }}>strength</span>
          <input
            type="range" min={0} max={100} value={qStrength}
            onChange={e => setQStrength(Number(e.target.value))}
            style={{ width: 70, cursor: 'pointer' }}
          />
          <span style={{ fontSize: 9, color: '#64748b', fontFamily: 'monospace', minWidth: 28 }}>
            {qStrength}%
          </span>
        </div>
        <button
          onClick={() => quantize(snap, qStrength / 100)}
          style={BTN}
        >
          Quantize ({snap})
        </button>
      </div>

      {/* ── Humanize ───────────────────────────────────────────────────────── */}
      <div style={SECTION_STYLE}>
        <span style={LABEL}>Humanize</span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: 9, color: '#334155' }}>amount</span>
          <input
            type="range" min={0} max={100} value={hAmount}
            onChange={e => setHAmount(Number(e.target.value))}
            style={{ width: 70, cursor: 'pointer' }}
          />
          <span style={{ fontSize: 9, color: '#64748b', fontFamily: 'monospace', minWidth: 28 }}>
            {hAmount}%
          </span>
        </div>
        <button onClick={() => humanize(hAmount / 100)} style={BTN}>
          Humanize
        </button>
      </div>

      {/* ── Randomize ──────────────────────────────────────────────────────── */}
      <div style={SECTION_STYLE}>
        <span style={LABEL}>Randomize</span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: 9, color: '#334155' }}>count</span>
          <input
            type="number" value={rndCount} min={1} max={128}
            onChange={e => setRndCount(Number(e.target.value))}
            style={{ ...SEL, width: 46 }}
          />
          <span style={{ fontSize: 9, color: '#334155' }}>bars</span>
          <input
            type="number" value={rndBars} min={1} max={32}
            onChange={e => setRndBars(Number(e.target.value))}
            style={{ ...SEL, width: 42 }}
          />
        </div>
        <button
          onClick={() => randomize(rndCount, rndBars)}
          style={BTN}
        >
          Randomize
        </button>
      </div>

    </div>
  )
}
