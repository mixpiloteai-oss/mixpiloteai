import { useMemo, useCallback }    from 'react'
import { useProjectStore }          from '../../store/projectStore'
import { useMixerStore }            from './useMixerStore'
import SpectrumCanvas               from './SpectrumCanvas'
import { TrackChannelStrip, BusChannelStrip } from './ChannelStrip'
import { MixerLayoutControls }      from './MixerLayoutControls'
import type { TrackSpectrum }       from './SpectrumCanvas'

// ─── Toolbar ──────────────────────────────────────────────────────────────────

function TBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding:      '2px 9px',
        borderRadius: 4,
        fontSize:     10,
        fontWeight:   active ? 600 : 400,
        cursor:       'pointer',
        background:   active ? 'rgba(124,58,237,0.22)' : 'transparent',
        color:        active ? '#a855f7' : '#475569',
        border:       `1px solid ${active ? 'rgba(124,58,237,0.40)' : 'transparent'}`,
        transition:   'all 0.12s',
      }}
    >
      {label}
    </button>
  )
}

// ─── Divider between groups ───────────────────────────────────────────────────

function StripDivider({ label }: { label: string }) {
  return (
    <div style={{
      width:          1,
      alignSelf:      'stretch',
      background:     'rgba(255,255,255,0.06)',
      margin:         '0 4px',
      position:       'relative',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
    }}>
      <span style={{
        position:    'absolute',
        top:         8,
        fontSize:    7,
        color:       '#2a2a40',
        fontWeight:  700,
        letterSpacing: '0.08em',
        writingMode: 'vertical-lr',
        textTransform: 'uppercase',
        transform:   'rotate(180deg)',
      }}>
        {label}
      </span>
    </div>
  )
}

// ─── Main MixerView ───────────────────────────────────────────────────────────

export default function MixerView() {
  const tracks          = useProjectStore(s => s.project.tracks)
  const buses           = useMixerStore(s => s.buses)
  const masterLimiter   = useMixerStore(s => s.masterLimiter)
  const monitoring      = useMixerStore(s => s.monitoring)
  const spectrumOpen    = useMixerStore(s => s.spectrumOpen)
  const setMasterLimiter = useMixerStore(s => s.setMasterLimiter)
  const setMonitoring   = useMixerStore(s => s.setMonitoring)
  const toggleSpectrum  = useMixerStore(s => s.toggleSpectrum)

  // Spectrum data — level functions use real audio data via closures over track IDs
  // (SpectrumCanvas calls getLevel() each rAF frame; we provide zero-level fallbacks
  //  since actual metering is now in the strip components via useTrackLevel/useBusLevel)
  const trackIdColorKey = tracks.map((t: { id: string; color: string }) => `${t.id}:${t.color}`).join(',')
  const busIdColorKey   = buses.map((b: { id: string; color: string; type: string }) => `${b.id}:${b.color}:${b.type}`).join(',')
  const noLevel = (): { rmsL: number; rmsR: number; peakL: number; peakR: number } => ({ rmsL: 0, rmsR: 0, peakL: 0, peakR: 0 })
  const spectrumTracks = useMemo<TrackSpectrum[]>(() => [
    ...tracks.map(t => ({
      trackId:  t.id,
      type:     t.type as TrackSpectrum['type'],
      color:    t.color,
      getLevel: noLevel,
    })),
    ...buses.map(b => ({
      trackId:  b.id,
      type:     (b.type === 'master' ? 'master' : 'bus') as TrackSpectrum['type'],
      color:    b.color,
      getLevel: noLevel,
    })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [trackIdColorKey, busIdColorKey])

  const groupBuses = buses.filter(b => b.type === 'group')
  const fxBuses    = buses.filter(b => b.type === 'fx-return')
  const masterBus  = buses.find(b => b.type === 'master')

  const handleLimiter = useCallback(() => setMasterLimiter(!masterLimiter), [masterLimiter, setMasterLimiter])
  const handleMonitor = useCallback(() => setMonitoring(!monitoring),       [monitoring, setMonitoring])

  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      height:        '100%',
      background:    '#08080f',
      overflow:      'hidden',
    }}>

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div style={{
        display:      'flex',
        alignItems:   'center',
        gap:          8,
        padding:      '0 12px',
        height:       36,
        flexShrink:   0,
        background:   '#0b0b14',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
          color: '#2d2d42', textTransform: 'uppercase', marginRight: 4,
        }}>
          Mixer
        </span>

        <TBtn label="Spectrum"  active={spectrumOpen}  onClick={toggleSpectrum} />
        <TBtn label="Limiter"   active={masterLimiter} onClick={handleLimiter} />
        <TBtn label="Monitor"   active={monitoring}    onClick={handleMonitor} />

        <div style={{ flex: 1 }} />

        <MixerLayoutControls />

        <span style={{ fontSize: 9, color: '#1c1c2e', fontFamily: 'monospace', marginLeft: 8 }}>
          {tracks.length} ch · {groupBuses.length} grp · {fxBuses.length} fx
        </span>
      </div>

      {/* ── Spectrum analyzer ───────────────────────────────────────────────── */}
      {spectrumOpen && (
        <div style={{
          flexShrink:   0,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background:   '#05050a',
        }}>
          <SpectrumCanvas tracks={spectrumTracks} height={72} />
        </div>
      )}

      {/* ── Channel strips ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden' }}>
        <div style={{
          display:    'flex',
          alignItems: 'stretch',
          gap:        4,
          padding:    '8px 10px',
          minHeight:  '100%',
          height:     'max-content',
          background: '#09090f',
        }}>

          {/* Track channels */}
          {tracks.map((track, i) => (
            <TrackChannelStrip
              key={track.id}
              track={track}
              channelNum={i + 1}
            />
          ))}

          {/* Group buses */}
          {groupBuses.length > 0 && <StripDivider label="Groups" />}
          {groupBuses.map(bus => (
            <BusChannelStrip
              key={bus.id}
              bus={bus}
              isMaster={false}
            />
          ))}

          {/* FX returns */}
          {fxBuses.length > 0 && <StripDivider label="FX" />}
          {fxBuses.map(bus => (
            <BusChannelStrip
              key={bus.id}
              bus={bus}
              isMaster={false}
            />
          ))}

          {/* Master */}
          {masterBus && (
            <>
              <StripDivider label="Master" />
              <BusChannelStrip
                bus={masterBus}
                isMaster
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
