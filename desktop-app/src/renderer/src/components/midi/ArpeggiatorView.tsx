import { useEffect, useRef } from 'react'
import { useMidiStore } from '../../store/midiStore'
import type { ArpMode, ArpRate } from '../../store/midiStore'
import { getArpeggiatorEngine } from '../../audio/midi/ArpeggiatorEngine'
import { getMidiEngine } from '../../audio/midi/MidiEngine'

// ─── Pitch helpers ────────────────────────────────────────────────────────────

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

function pitchToName(p: number): string {
  const name   = NOTE_NAMES[p % 12] ?? 'C'
  const octave = Math.floor(p / 12) - 1
  return `${name}${octave}`
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ARP_MODES: ArpMode[] = ['up', 'down', 'up-down', 'down-up', 'random', 'order', 'chord']
const ARP_RATES: ArpRate[] = ['1/32', '1/16', '1/8', '1/4', '1/2', '1/1']
const PATTERN_SLOTS         = 8
const CHANNELS              = Array.from({ length: 16 }, (_, i) => i + 1)

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  root: {
    background:   '#08080f',
    border:       '1px solid rgba(255,255,255,0.06)',
    borderRadius: 6,
    padding:      '12px 14px',
    fontFamily:   'monospace',
    minWidth:     420,
  },
  title: {
    fontSize:      10,
    fontWeight:    700,
    letterSpacing: '0.12em',
    color:         '#475569',
    textTransform: 'uppercase' as const,
    marginBottom:  12,
  },
  row: {
    display:    'flex',
    alignItems: 'center',
    gap:        10,
    flexWrap:   'wrap' as const,
    marginBottom: 10,
  },
  label: {
    fontSize:  10,
    color:     '#475569',
    flexShrink: 0,
  },
  toggleBtn: (enabled: boolean): React.CSSProperties => ({
    padding:      '4px 12px',
    borderRadius: 4,
    border:       enabled ? '1px solid rgba(124,58,237,0.5)' : '1px solid rgba(255,255,255,0.08)',
    background:   enabled ? 'rgba(124,58,237,0.25)' : 'rgba(255,255,255,0.03)',
    color:        enabled ? '#a855f7' : '#475569',
    fontSize:     10,
    fontWeight:   700,
    letterSpacing: '0.1em',
    cursor:       'pointer',
    fontFamily:   'monospace',
    textTransform: 'uppercase' as const,
    boxShadow:    enabled ? '0 0 10px rgba(124,58,237,0.3)' : 'none',
    transition:   'all 0.15s',
  }),
  select: {
    background:   'rgba(255,255,255,0.04)',
    border:       '1px solid rgba(255,255,255,0.08)',
    borderRadius: 3,
    color:        '#94a3b8',
    fontSize:     10,
    fontFamily:   'monospace',
    padding:      '3px 6px',
    cursor:       'pointer',
    outline:      'none',
  },
  gateWrap: {
    display:    'flex',
    alignItems: 'center',
    gap:        6,
  },
  gateSlider: {
    accentColor: '#7c3aed',
    cursor:      'pointer',
    width:       80,
  },
  gateValue: {
    fontSize: 10,
    color:    '#94a3b8',
    minWidth: 30,
  },
  checkbox: {
    accentColor: '#a855f7',
    cursor:      'pointer',
    width:       13,
    height:      13,
  },
  divider: {
    height:     '1px',
    background: 'rgba(255,255,255,0.04)',
    margin:     '8px 0',
  },
  patternLabel: {
    fontSize:  9,
    color:     '#334155',
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    marginBottom: 6,
  },
  patternRow: {
    display: 'flex',
    gap:     4,
  },
  stepCell: (active: boolean, current: boolean, enabled: boolean): React.CSSProperties => ({
    width:        28,
    height:       28,
    borderRadius: 3,
    display:      'flex',
    alignItems:   'center',
    justifyContent: 'center',
    fontSize:     8,
    fontWeight:   700,
    background:   current && enabled
      ? 'rgba(168,85,247,0.5)'
      : active
        ? 'rgba(124,58,237,0.18)'
        : 'rgba(255,255,255,0.02)',
    border:       current && enabled
      ? '1px solid rgba(168,85,247,0.8)'
      : active
        ? '1px solid rgba(124,58,237,0.25)'
        : '1px solid rgba(255,255,255,0.04)',
    color:        current && enabled ? '#e2e8f0' : active ? '#7c3aed' : '#1e293b',
    transition:   'background 0.08s, border-color 0.08s',
    boxShadow:    current && enabled ? '0 0 8px rgba(168,85,247,0.4)' : 'none',
    overflow:     'hidden',
    whiteSpace:   'nowrap' as const,
  }),
  heldRow: {
    display:    'flex',
    alignItems: 'center',
    gap:        6,
    flexWrap:   'wrap' as const,
    marginTop:  8,
  },
  heldLabel: {
    fontSize:  9,
    color:     '#334155',
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
  },
  heldNote: {
    fontSize:     9,
    color:        '#7c3aed',
    background:   'rgba(124,58,237,0.12)',
    border:       '1px solid rgba(124,58,237,0.25)',
    borderRadius: 3,
    padding:      '1px 5px',
    fontWeight:   700,
  },
} as const

// ─── ArpeggiatorView ─────────────────────────────────────────────────────────

export default function ArpeggiatorView(): JSX.Element {
  const arp             = useMidiStore(s => s.arp)
  const setArpEnabled    = useMidiStore(s => s.setArpEnabled)
  const setArpMode       = useMidiStore(s => s.setArpMode)
  const setArpRate       = useMidiStore(s => s.setArpRate)
  const setArpOctaves    = useMidiStore(s => s.setArpOctaves)
  const setArpGate       = useMidiStore(s => s.setArpGate)
  const setArpSyncToHost = useMidiStore(s => s.setArpSyncToHost)
  const setArpStep       = useMidiStore(s => s.setArpStep)
  const setArpChannel    = useMidiStore(s => s.setArpChannel)

  // Track previous enabled state to start/stop engine
  const prevEnabledRef = useRef<boolean>(false)

  // Wire up engine on mount
  useEffect(() => {
    const engine    = getArpeggiatorEngine()
    const midiEng   = getMidiEngine()

    engine.setCallbacks(
      (pitch, velocity, channel) => { midiEng.noteOn(pitch, velocity, channel) },
      (pitch, channel)           => { midiEng.noteOff(pitch, channel) },
    )

    engine.setOnStepChange((step) => {
      setArpStep(step)
    })
  }, [setArpStep])

  // Start / stop engine when arp.enabled changes
  useEffect(() => {
    const engine = getArpeggiatorEngine()
    if (arp.enabled && !prevEnabledRef.current) {
      engine.start()
    } else if (!arp.enabled && prevEnabledRef.current) {
      engine.stop()
    }
    prevEnabledRef.current = arp.enabled
  }, [arp.enabled])

  // Sync config to engine whenever relevant arp state changes
  useEffect(() => {
    const engine = getArpeggiatorEngine()
    engine.setConfig({
      mode:    arp.mode,
      rate:    arp.rate,
      octaves: arp.octaves,
      gate:    arp.gate,
      channel: arp.channel,
    })
  }, [arp.mode, arp.rate, arp.octaves, arp.gate, arp.channel])

  // Pattern preview: build slots from held notes count
  const slotCount   = Math.max(PATTERN_SLOTS, arp.heldNotes.length)
  const currentStep = arp.currentStep % PATTERN_SLOTS

  function handleModeChange(e: React.ChangeEvent<HTMLSelectElement>): void {
    setArpMode(e.target.value as ArpMode)
  }

  function handleRateChange(e: React.ChangeEvent<HTMLSelectElement>): void {
    setArpRate(e.target.value as ArpRate)
  }

  function handleOctavesChange(e: React.ChangeEvent<HTMLSelectElement>): void {
    setArpOctaves(Number(e.target.value))
  }

  function handleChannelChange(e: React.ChangeEvent<HTMLSelectElement>): void {
    setArpChannel(Number(e.target.value) - 1)  // store is 0-indexed
  }

  return (
    <div style={S.root}>
      <div style={S.title}>Arpeggiator</div>

      {/* Row 1: ON/OFF | Mode | Rate | Octaves | Gate */}
      <div style={S.row}>
        {/* Toggle */}
        <button
          style={S.toggleBtn(arp.enabled)}
          onClick={() => { setArpEnabled(!arp.enabled) }}
        >
          {arp.enabled ? '● ON' : '○ OFF'}
        </button>

        {/* Mode */}
        <span style={S.label}>Mode</span>
        <select style={S.select} value={arp.mode} onChange={handleModeChange}>
          {ARP_MODES.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        {/* Rate */}
        <span style={S.label}>Rate</span>
        <select style={S.select} value={arp.rate} onChange={handleRateChange}>
          {ARP_RATES.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>

        {/* Octaves */}
        <span style={S.label}>Oct</span>
        <select style={S.select} value={arp.octaves} onChange={handleOctavesChange}>
          {[1, 2, 3, 4].map(o => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>

        {/* Gate */}
        <span style={S.label}>Gate</span>
        <div style={S.gateWrap}>
          <input
            type="range"
            style={S.gateSlider}
            min={0}
            max={100}
            value={Math.round(arp.gate * 100)}
            onChange={(e) => { setArpGate(Number(e.target.value) / 100) }}
          />
          <span style={S.gateValue}>{Math.round(arp.gate * 100)}%</span>
        </div>
      </div>

      {/* Row 2: Sync | Channel */}
      <div style={S.row}>
        <span style={S.label}>Sync to Host</span>
        <input
          type="checkbox"
          style={S.checkbox}
          checked={arp.syncToHost}
          onChange={(e) => { setArpSyncToHost(e.target.checked) }}
        />

        <span style={S.label}>Channel</span>
        <select style={S.select} value={arp.channel + 1} onChange={handleChannelChange}>
          {CHANNELS.map(ch => (
            <option key={ch} value={ch}>{ch}</option>
          ))}
        </select>
      </div>

      <div style={S.divider} />

      {/* Pattern preview */}
      <div style={S.patternLabel}>Pattern preview</div>
      <div style={S.patternRow}>
        {Array.from({ length: slotCount }, (_, i) => {
          const note        = arp.heldNotes[i]
          const hasNote     = note !== undefined
          const isCurrent   = i === currentStep && arp.enabled
          const label       = hasNote ? pitchToName(note) : ''

          return (
            <div key={i} style={S.stepCell(hasNote, isCurrent, arp.enabled)}>
              {label}
            </div>
          )
        })}
      </div>

      {/* Held notes */}
      <div style={S.heldRow}>
        <span style={S.heldLabel}>Held:</span>
        {arp.heldNotes.length === 0 && (
          <span style={{ fontSize: 10, color: '#1e293b', fontStyle: 'italic' }}>none</span>
        )}
        {arp.heldNotes.map((n, i) => (
          <span key={`${n}-${i}`} style={S.heldNote}>{pitchToName(n)}</span>
        ))}
      </div>
    </div>
  )
}
