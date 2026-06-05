import { useState, useCallback } from 'react'
import { getArpeggiatorEngine } from '../../audio/midi/ArpeggiatorEngine'
import type { ArpConfig } from '../../audio/midi/ArpeggiatorEngine'
import { getTrackManager } from '../../audio'
import { MidiTrackNode } from '../../audio/tracks/MidiTrackNode'

type ArpMode = ArpConfig['mode']
type ArpRate = ArpConfig['rate']

const ARP_MODES: ArpMode[] = ['up', 'down', 'up-down', 'down-up', 'random', 'order', 'chord']
const ARP_RATES: ArpRate[] = ['1/32', '1/16', '1/8', '1/4', '1/2', '1/1']

interface ArpState {
  config: ArpConfig
  enabled: boolean
  swing: number
}

export default function ArpPanel() {
  const [state, setState] = useState<ArpState>({
    config: {
      mode:    'up',
      rate:    '1/16',
      octaves: 1,
      gate:    0.8,
      channel: 0,
    },
    enabled: false,
    swing:   0,
  })

  const update = useCallback((patch: Partial<ArpConfig>) => {
    setState(prev => {
      const next = { ...prev, config: { ...prev.config, ...patch } }
      const eng = getArpeggiatorEngine()
      eng.setConfig(next.config)
      return next
    })
  }, [])

  const toggleEnabled = useCallback(() => {
    setState(prev => {
      const nextEnabled = !prev.enabled
      const eng = getArpeggiatorEngine()

      if (nextEnabled) {
        // Wire arp to first available MidiTrackNode
        const trackMgr = getTrackManager()
        const ids = trackMgr.getTrackIds()
        let midiNode: MidiTrackNode | null = null
        for (const id of ids) {
          const node = trackMgr.getTrack(id)
          if (node instanceof MidiTrackNode) { midiNode = node; break }
        }
        if (midiNode) {
          const node = midiNode
          eng.setCallbacks(
            (pitch, velocity, _channel) => node.noteOn(pitch, velocity),
            (pitch, _channel)           => node.noteOff(pitch),
          )
          eng.start()
        }
      } else {
        eng.stop()
      }

      return { ...prev, enabled: nextEnabled }
    })
  }, [])

  const setSwing = useCallback((v: number) => {
    setState(prev => ({ ...prev, swing: v }))
    // swing is not part of ArpConfig — it's a playback timing concern; no direct arp API
  }, [])

  const { config, enabled, swing } = state

  const labelStyle: React.CSSProperties = {
    fontSize:  9,
    color:     '#64748b',
    minWidth:  36,
  }

  const selectStyle: React.CSSProperties = {
    fontSize:     10,
    padding:      '1px 4px',
    borderRadius: 4,
    background:   '#0e0e1c',
    border:       '1px solid #1c1c2e',
    color:        '#94a3b8',
    outline:      'none',
    cursor:       'pointer',
  }

  const sliderStyle: React.CSSProperties = {
    accentColor: '#7c3aed',
    width:       80,
  }

  return (
    <div style={{
      display:      'flex',
      flexWrap:     'wrap',
      alignItems:   'center',
      gap:          8,
      padding:      '6px 12px',
      background:   '#09090f',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
      flexShrink:   0,
    }}>
      {/* Enable toggle */}
      <button
        onClick={toggleEnabled}
        style={{
          padding:      '2px 8px',
          borderRadius: 4,
          fontSize:     10,
          fontWeight:   enabled ? 700 : 400,
          background:   enabled ? 'rgba(124,58,237,0.22)' : 'transparent',
          color:        enabled ? '#a855f7' : '#475569',
          border:       `1px solid ${enabled ? 'rgba(124,58,237,0.4)' : '#1c1c2e'}`,
          cursor:       'pointer',
        }}
      >
        {enabled ? 'ARP ON' : 'ARP OFF'}
      </button>

      {/* Mode */}
      <span style={labelStyle}>MODE</span>
      <select
        value={config.mode}
        onChange={e => update({ mode: e.target.value as ArpMode })}
        style={selectStyle}
      >
        {ARP_MODES.map(m => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>

      {/* Rate */}
      <span style={labelStyle}>RATE</span>
      <select
        value={config.rate}
        onChange={e => update({ rate: e.target.value as ArpRate })}
        style={selectStyle}
      >
        {ARP_RATES.map(r => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>

      {/* Octaves */}
      <span style={labelStyle}>OCT</span>
      <select
        value={config.octaves}
        onChange={e => update({ octaves: Number(e.target.value) })}
        style={selectStyle}
      >
        {[1, 2, 3, 4].map(o => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>

      {/* Gate */}
      <span style={labelStyle}>GATE</span>
      <input
        type="range"
        min={0.1}
        max={1.0}
        step={0.05}
        value={config.gate}
        onChange={e => update({ gate: Number(e.target.value) })}
        style={sliderStyle}
        title={`Gate: ${Math.round(config.gate * 100)}%`}
      />
      <span style={{ ...labelStyle, minWidth: 24 }}>{Math.round(config.gate * 100)}%</span>

      {/* Swing */}
      <span style={labelStyle}>SWING</span>
      <input
        type="range"
        min={0}
        max={0.5}
        step={0.01}
        value={swing}
        onChange={e => setSwing(Number(e.target.value))}
        style={sliderStyle}
        title={`Swing: ${Math.round(swing * 200)}%`}
      />
      <span style={{ ...labelStyle, minWidth: 24 }}>{Math.round(swing * 200)}%</span>
    </div>
  )
}
