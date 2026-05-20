import { useMemo, useCallback }    from 'react'
import { useProjectStore }          from '../../store/projectStore'
import { useMixerStore }            from './useMixerStore'
import SpectrumCanvas               from './SpectrumCanvas'
import { TrackChannelStrip, BusChannelStrip, makeTrackLevelFn, makeBusLevelFn } from './ChannelStrip'
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
  const { project }                                     = useProjectStore()
  const { buses, masterLimiter, monitoring, spectrumOpen, setMasterLimiter, setMonitoring, toggleSpectrum } =
    useMixerStore()

  // Build level functions once per track (stable across re-renders)
  const trackIdKey = project.tracks.map(t => t.id).join(',')
  const busIdKey   = buses.map(b => b.id).join(',')

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const trackLevelFns = useMemo(() => Object.fromEntries(project.tracks.map(t => [t.id, makeTrackLevelFn(t)])), [trackIdKey])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const busLevelFns   = useMemo(() => Object.fromEntries(buses.map(b => [b.id, makeBusLevelFn(b)])),           [busIdKey])

  // Spectrum data — use stable string deps instead of object references to avoid spurious recomputes
  const trackIdColorKey = project.tracks.map(t => `${t.id}:${t.color}`).join(',')
  const busIdColorKey   = buses.map(b => `${b.id}:${b.color}:${b.type}`).join(',')
  const spectrumTracks = useMemo<TrackSpectrum[]>(() => [
    ...project.tracks.map(t => ({
      trackId:  t.id,
      type:     t.type as TrackSpectrum['type'],
      color:    t.color,
      getLevel: trackLevelFns[t.id] ?? (() => ({ rmsL: 0, rmsR: 0, peakL: 0, peakR: 0 })),
    })),
    ...buses.map(b => ({
      trackId:  b.id,
      type:     (b.type === 'master' ? 'master' : 'bus') as TrackSpectrum['type'],
      color:    b.color,
      getLevel: busLevelFns[b.id] ?? (() => ({ rmsL: 0, rmsR: 0, peakL: 0, peakR: 0 })),
    })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [trackIdColorKey, busIdColorKey, trackLevelFns, busLevelFns])

  const groupBuses = buses.filter(b => b.type === 'group')
  const fxBuses    = buses.filter(b => b.type === 'fx-return')
  const masterBus  = buses.find(b => b.type === 'master')

  const handleLimiter = useCallback(() => setMasterLimiter(!masterLimiter), [masterLimiter, setMasterLimiter])
  const handleMonitor = useCallback(() => setMonitoring(!monitoring),       [monitoring, setMonitoring])

  const noLevel = () => ({ rmsL: 0, rmsR: 0, peakL: 0, peakR: 0 })

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

        <span style={{ fontSize: 9, color: '#1c1c2e', fontFamily: 'monospace' }}>
          {project.tracks.length} ch · {groupBuses.length} grp · {fxBuses.length} fx
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
          {project.tracks.map((track, i) => (
            <TrackChannelStrip
              key={track.id}
              track={track}
              channelNum={i + 1}
              levelFn={trackLevelFns[track.id] ?? noLevel}
            />
          ))}

          {/* Group buses */}
          {groupBuses.length > 0 && <StripDivider label="Groups" />}
          {groupBuses.map(bus => (
            <BusChannelStrip
              key={bus.id}
              bus={bus}
              levelFn={busLevelFns[bus.id] ?? noLevel}
              isMaster={false}
            />
          ))}

          {/* FX returns */}
          {fxBuses.length > 0 && <StripDivider label="FX" />}
          {fxBuses.map(bus => (
            <BusChannelStrip
              key={bus.id}
              bus={bus}
              levelFn={busLevelFns[bus.id] ?? noLevel}
              isMaster={false}
            />
          ))}

          {/* Master */}
          {masterBus && (
            <>
              <StripDivider label="Master" />
              <BusChannelStrip
                bus={masterBus}
                levelFn={busLevelFns[masterBus.id] ?? noLevel}
                isMaster
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
