import { useEffect } from 'react'
import { useMidiStore } from '../../store/midiStore'
import { getMidiDeviceManager } from '../../audio/midi/MidiDeviceManager'
import type { MidiDevice } from '../../audio/midi/MidiDeviceManager'

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  root: {
    background:   '#08080f',
    border:       '1px solid rgba(255,255,255,0.06)',
    borderRadius: 6,
    padding:      '12px 14px',
    minWidth:     340,
    fontFamily:   'monospace',
    userSelect:   'none' as const,
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
  statusRow: {
    display:     'flex',
    alignItems:  'center',
    gap:         6,
    fontSize:    10,
    color:       '#475569',
    marginBottom: 12,
  },
  statusDot: (ok: boolean): React.CSSProperties => ({
    width:        7,
    height:       7,
    borderRadius: '50%',
    background:   ok ? '#10b981' : '#ef4444',
    flexShrink:   0,
    boxShadow:    ok ? '0 0 5px #10b98160' : '0 0 5px #ef444460',
  }),
  columns: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap:     10,
  },
  colLabel: {
    fontSize:     9,
    fontWeight:   700,
    letterSpacing: '0.1em',
    color:        '#334155',
    textTransform: 'uppercase' as const,
    marginBottom: 6,
  },
  deviceList: {
    display:       'flex',
    flexDirection: 'column' as const,
    gap:           4,
  },
  deviceRow: (selected: boolean): React.CSSProperties => ({
    display:       'flex',
    alignItems:    'center',
    gap:           7,
    padding:       '5px 8px',
    borderRadius:  4,
    cursor:        'pointer',
    background:    selected ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.02)',
    border:        selected ? '1px solid rgba(124,58,237,0.4)' : '1px solid rgba(255,255,255,0.04)',
    transition:    'background 0.12s, border-color 0.12s',
  }),
  deviceDot: (color: string, state: string): React.CSSProperties => ({
    width:        7,
    height:       7,
    borderRadius: '50%',
    background:   state === 'connected' ? color : '#334155',
    flexShrink:   0,
  }),
  deviceName: {
    fontSize:    10,
    color:       '#94a3b8',
    flex:        1,
    overflow:    'hidden',
    textOverflow: 'ellipsis',
    whiteSpace:  'nowrap' as const,
  },
  badge: (color?: string): React.CSSProperties => ({
    fontSize:     8,
    fontWeight:   700,
    letterSpacing: '0.08em',
    color:        color ?? '#475569',
    background:   color ? `${color}22` : 'rgba(255,255,255,0.04)',
    border:       `1px solid ${color ? `${color}44` : 'rgba(255,255,255,0.06)'}`,
    borderRadius: 3,
    padding:      '1px 4px',
    textTransform: 'uppercase' as const,
    flexShrink:   0,
  }),
  errorBox: {
    marginTop:    10,
    padding:      '7px 10px',
    background:   'rgba(239,68,68,0.08)',
    border:       '1px solid rgba(239,68,68,0.25)',
    borderRadius: 4,
    fontSize:     10,
    color:        '#f87171',
  },
  initBtn: {
    marginTop:    12,
    width:        '100%',
    padding:      '7px 0',
    background:   'rgba(124,58,237,0.18)',
    border:       '1px solid rgba(124,58,237,0.4)',
    borderRadius: 4,
    color:        '#a855f7',
    fontSize:     10,
    fontWeight:   700,
    letterSpacing: '0.08em',
    cursor:       'pointer',
    fontFamily:   'monospace',
    textTransform: 'uppercase' as const,
  },
  emptyNote: {
    fontSize:  10,
    color:     '#1e293b',
    fontStyle: 'italic' as const,
    padding:   '4px 0',
  },
} as const

// ─── Vendor color map ─────────────────────────────────────────────────────────

const VENDOR_COLORS: Record<string, string> = {
  akai:               '#ef4444',
  arturia:            '#3b82f6',
  novation:           '#f97316',
  'native-instruments': '#10b981',
  generic:            '#6b7280',
}

function vendorColor(vendor: string): string {
  return VENDOR_COLORS[vendor] ?? '#6b7280'
}

// ─── DeviceRow ────────────────────────────────────────────────────────────────

interface DeviceRowProps {
  device:   MidiDevice
  selected: boolean
  onClick:  () => void
}

function DeviceRow({ device, selected, onClick }: DeviceRowProps): JSX.Element {
  const color = device.profile.color ?? vendorColor(device.profile.vendor)

  return (
    <div style={S.deviceRow(selected)} onClick={onClick} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
    >
      <span style={S.deviceDot(color, device.state)} />
      <span style={S.deviceName} title={device.name}>{device.name}</span>
      <span style={S.badge(vendorColor(device.profile.vendor))}>
        {device.profile.vendor.replace('native-instruments', 'NI')}
      </span>
      <span style={S.badge(device.state === 'connected' ? '#10b981' : undefined)}>
        {device.state}
      </span>
      {selected && <span style={S.badge('#a855f7')}>✓</span>}
    </div>
  )
}

// ─── MidiDevicePanel ──────────────────────────────────────────────────────────

export default function MidiDevicePanel(): JSX.Element {
  const devices          = useMidiStore(s => s.devices)
  const selectedInputId  = useMidiStore(s => s.selectedInputId)
  const selectedOutputId = useMidiStore(s => s.selectedOutputId)
  const midiInitialized  = useMidiStore(s => s.midiInitialized)
  const midiError        = useMidiStore(s => s.midiError)
  const setSelectedInput  = useMidiStore(s => s.setSelectedInput)
  const setSelectedOutput = useMidiStore(s => s.setSelectedOutput)
  const setDevices         = useMidiStore(s => s.setDevices)
  const setMidiInitialized = useMidiStore(s => s.setMidiInitialized)
  const setMidiError       = useMidiStore(s => s.setMidiError)

  // Hot-plug subscription
  useEffect(() => {
    const manager = getMidiDeviceManager()
    const unsub = manager.onDeviceChange((all) => {
      setDevices(all)
    })
    // Seed initial device list if already initialised
    if (midiInitialized) {
      setDevices(manager.getAllDevices())
    }
    return unsub
  }, [midiInitialized, setDevices])

  async function handleInit(): Promise<void> {
    const manager = getMidiDeviceManager()
    try {
      const ok = await manager.init()
      if (ok) {
        setDevices(manager.getAllDevices())
        setMidiInitialized(true)
        setMidiError(null)
      } else {
        setMidiError('WebMIDI access denied or not supported.')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setMidiError(msg)
    }
  }

  const inputs  = devices.filter(d => d.type === 'input')
  const outputs = devices.filter(d => d.type === 'output')
  const webMidiOk = typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator

  return (
    <div style={S.root}>
      {/* Header */}
      <div style={S.header}>
        <span style={S.title}>MIDI Devices</span>
      </div>

      {/* WebMIDI status */}
      <div style={S.statusRow}>
        <span style={S.statusDot(webMidiOk && midiInitialized)} />
        {webMidiOk
          ? (midiInitialized ? 'WebMIDI active' : 'WebMIDI available — not initialized')
          : 'WebMIDI not available in this environment'}
      </div>

      {/* Initialize button */}
      {!midiInitialized && (
        <button style={S.initBtn} onClick={() => { void handleInit() }}>
          Initialize MIDI
        </button>
      )}

      {/* Error */}
      {midiError && (
        <div style={S.errorBox}>⚠ {midiError}</div>
      )}

      {/* Device columns */}
      {midiInitialized && (
        <div style={S.columns}>
          {/* Inputs */}
          <div>
            <div style={S.colLabel}>Inputs</div>
            <div style={S.deviceList}>
              {inputs.length === 0 && (
                <div style={S.emptyNote}>No inputs found</div>
              )}
              {inputs.map(d => (
                <DeviceRow
                  key={d.id}
                  device={d}
                  selected={d.id === selectedInputId}
                  onClick={() => { setSelectedInput(d.id === selectedInputId ? null : d.id) }}
                />
              ))}
            </div>
          </div>

          {/* Outputs */}
          <div>
            <div style={S.colLabel}>Outputs</div>
            <div style={S.deviceList}>
              {outputs.length === 0 && (
                <div style={S.emptyNote}>No outputs found</div>
              )}
              {outputs.map(d => (
                <DeviceRow
                  key={d.id}
                  device={d}
                  selected={d.id === selectedOutputId}
                  onClick={() => { setSelectedOutput(d.id === selectedOutputId ? null : d.id) }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
