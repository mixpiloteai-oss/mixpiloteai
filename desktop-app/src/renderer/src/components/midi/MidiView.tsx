import { useEffect, useState } from 'react'
import { useMidiStore } from '../../store/midiStore'
import { getMidiDeviceManager } from '../../audio/midi/MidiDeviceManager'
import MidiDevicePanel   from './MidiDevicePanel'
import ArpeggiatorView   from './ArpeggiatorView'
import StepSequencer     from './StepSequencer'
import DrumRack          from './DrumRack'
import MidiMappingView   from './MidiMappingView'
import PresetManager     from './PresetManager'
import MidiLearnOverlay  from './MidiLearnOverlay'

// ─── Tab definitions ──────────────────────────────────────────────────────────

type TabId = 'devices' | 'arp' | 'seq' | 'drumrack' | 'mappings' | 'presets'

interface Tab {
  id:    TabId
  label: string
}

const TABS: Tab[] = [
  { id: 'devices',  label: 'Devices'      },
  { id: 'arp',      label: 'Arpeggiator'  },
  { id: 'seq',      label: 'Step Seq'     },
  { id: 'drumrack', label: 'Drum Rack'    },
  { id: 'mappings', label: 'Mappings'     },
  { id: 'presets',  label: 'Presets'      },
]

// ─── MidiView ─────────────────────────────────────────────────────────────────

export default function MidiView(): JSX.Element {
  const { setDevices, setMidiInitialized, setMidiError } = useMidiStore()

  const [activeTab, setActiveTab] = useState<TabId>('devices')
  const [initialized, setInitialized] = useState(false)

  // ── Init MIDI on mount ───────────────────────────────────────────────────────

  useEffect(() => {
    const mgr = getMidiDeviceManager()
    mgr.init().then(ok => {
      setMidiInitialized(ok)
      setInitialized(ok)
      if (!ok) {
        setMidiError('WebMIDI not available')
      } else {
        setDevices(mgr.getAllDevices())
      }
    }).catch(() => {
      setMidiInitialized(false)
      setMidiError('Failed to initialize WebMIDI')
    })

    const unsub = mgr.onDeviceChange(devices => { setDevices(devices) })
    return () => { unsub() }
  }, [setDevices, setMidiInitialized, setMidiError])

  // ── Styles ───────────────────────────────────────────────────────────────────

  const outerStyle: React.CSSProperties = {
    display:        'flex',
    flexDirection:  'column',
    height:         '100%',
    background:     '#08080f',
    fontFamily:     'monospace',
    overflow:       'hidden',
  }

  const topBarStyle: React.CSSProperties = {
    display:        'flex',
    alignItems:     'center',
    gap:            0,
    background:     '#09090f',
    borderBottom:   '1px solid rgba(255,255,255,0.06)',
    padding:        '0 12px',
    flexShrink:     0,
    overflowX:      'auto',
  }

  const sectionTitle: React.CSSProperties = {
    fontSize:      9,
    color:         '#2d2d42',
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontWeight:    700,
    paddingRight:  16,
    whiteSpace:    'nowrap',
    borderRight:   '1px solid rgba(255,255,255,0.05)',
    marginRight:   4,
    lineHeight:    '38px',
    flexShrink:    0,
  }

  const tabBtn = (id: TabId): React.CSSProperties => {
    const isActive = activeTab === id
    return {
      background:     'none',
      border:         'none',
      borderBottom:   isActive
        ? '2px solid #7c3aed'
        : '2px solid transparent',
      color:          isActive ? '#a855f7' : '#475569',
      fontSize:       10,
      fontFamily:     'monospace',
      textTransform:  'uppercase',
      letterSpacing:  1,
      cursor:         'pointer',
      padding:        '0 14px',
      height:         38,
      whiteSpace:     'nowrap',
      transition:     'color 0.15s, border-color 0.15s',
      flexShrink:     0,
    }
  }

  const contentStyle: React.CSSProperties = {
    flex:       1,
    overflow:   'auto',
    padding:    '16px',
    display:    'flex',
    flexDirection: 'column',
  }

  const statusBanner = (ok: boolean): React.CSSProperties => ({
    display:      'flex',
    alignItems:   'center',
    gap:          8,
    padding:      '6px 12px',
    background:   ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
    border:       `1px solid ${ok ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
    borderRadius: 6,
    marginBottom: 12,
    fontSize:     10,
    color:        ok ? '#10b981' : '#ef4444',
    flexShrink:   0,
  })

  const dot: React.CSSProperties = {
    width:        6,
    height:       6,
    borderRadius: '50%',
    background:   initialized ? '#10b981' : '#ef4444',
    flexShrink:   0,
  }

  // ── Content ──────────────────────────────────────────────────────────────────

  const renderContent = (): JSX.Element => {
    switch (activeTab) {
      case 'devices':  return <MidiDevicePanel />
      case 'arp':      return <ArpeggiatorView />
      case 'seq':      return <StepSequencer />
      case 'drumrack': return <DrumRack />
      case 'mappings': return <MidiMappingView />
      case 'presets':  return <PresetManager />
    }
  }

  return (
    <div style={outerStyle}>
      {/* Tab bar */}
      <div style={topBarStyle}>
        <span style={sectionTitle}>MIDI</span>
        {TABS.map(tab => (
          <button
            key={tab.id}
            style={tabBtn(tab.id)}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div style={contentStyle}>
        {/* MIDI init status */}
        <div style={statusBanner(initialized)}>
          <div style={dot} />
          <span>
            {initialized ? 'WebMIDI active' : 'WebMIDI unavailable — running in offline mode'}
          </span>
        </div>

        {/* Active tab */}
        {renderContent()}
      </div>

      {/* Always-present MIDI learn overlay (self-hides when not learning) */}
      <MidiLearnOverlay />
    </div>
  )
}
