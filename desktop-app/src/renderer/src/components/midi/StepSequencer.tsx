import { useEffect, useRef, useState } from 'react'
import { useMidiStore } from '../../store/midiStore'
import type { SeqStep } from '../../store/midiStore'
import { getStepSequencerEngine } from '../../audio/midi/StepSequencerEngine'
import { getMidiEngine } from '../../audio/midi/MidiEngine'

// ─── Note name helper ─────────────────────────────────────────────────────────

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

function pitchToName(pitch: number): string {
  const name = NOTE_NAMES[pitch % 12]
  const octave = Math.floor(pitch / 12) - 1
  return `${name ?? 'C'}${octave}`
}

// ─── Step Popup ───────────────────────────────────────────────────────────────

interface StepPopupProps {
  trackId:  string
  stepIdx:  number
  step:     SeqStep
  anchorX:  number
  anchorY:  number
  onClose:  () => void
}

function StepPopup({ trackId, stepIdx, step, anchorX, anchorY, onClose }: StepPopupProps): JSX.Element {
  const setSeqStep = useMidiStore(s => s.setSeqStep)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handlePointerDown(e: PointerEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => { document.removeEventListener('pointerdown', handlePointerDown) }
  }, [onClose])

  const patch = (p: Partial<SeqStep>): void => { setSeqStep(trackId, stepIdx, p) }

  const popupStyle: React.CSSProperties = {
    position:        'fixed',
    top:             anchorY,
    left:            anchorX,
    zIndex:          9999,
    background:      '#0f0f1e',
    border:          '1px solid rgba(124,58,237,0.5)',
    borderRadius:    8,
    padding:         '12px 14px',
    display:         'flex',
    flexDirection:   'column',
    gap:             8,
    minWidth:        200,
    boxShadow:       '0 8px 32px rgba(0,0,0,0.7)',
  }

  const labelStyle: React.CSSProperties = {
    fontSize:   9,
    fontFamily: 'monospace',
    color:      '#475569',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  }

  const inputStyle: React.CSSProperties = {
    background:   '#0b0b14',
    border:       '1px solid rgba(255,255,255,0.08)',
    borderRadius: 4,
    color:        '#e2e8f0',
    fontSize:     11,
    fontFamily:   'monospace',
    padding:      '3px 6px',
    width:        '100%',
    outline:      'none',
  }

  const rowStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column' }

  return (
    <div ref={ref} style={popupStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: '#a855f7', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: 1 }}>
          Step {stepIdx + 1}
        </span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}
        >×</button>
      </div>

      <div style={rowStyle}>
        <span style={labelStyle}>Pitch — {pitchToName(step.pitch)}</span>
        <input
          type="number" min={0} max={127} value={step.pitch}
          onChange={e => patch({ pitch: Math.max(0, Math.min(127, parseInt(e.target.value, 10) || 0)) })}
          style={inputStyle}
        />
      </div>

      <div style={rowStyle}>
        <span style={labelStyle}>Velocity — {step.velocity}</span>
        <input
          type="range" min={1} max={127} value={step.velocity}
          onChange={e => patch({ velocity: parseInt(e.target.value, 10) })}
          style={{ accentColor: '#7c3aed', width: '100%' }}
        />
      </div>

      <div style={rowStyle}>
        <span style={labelStyle}>Gate — {Math.round(step.gate * 100)}%</span>
        <input
          type="range" min={1} max={100} value={Math.round(step.gate * 100)}
          onChange={e => patch({ gate: parseInt(e.target.value, 10) / 100 })}
          style={{ accentColor: '#7c3aed', width: '100%' }}
        />
      </div>

      <div style={rowStyle}>
        <span style={labelStyle}>Probability — {step.probability}%</span>
        <input
          type="range" min={1} max={100} value={step.probability}
          onChange={e => patch({ probability: parseInt(e.target.value, 10) })}
          style={{ accentColor: '#7c3aed', width: '100%' }}
        />
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
        <input
          type="checkbox" checked={step.accent}
          onChange={e => patch({ accent: e.target.checked })}
          style={{ accentColor: '#a855f7' }}
        />
        <span style={{ ...labelStyle, marginBottom: 0 }}>Accent</span>
      </label>
    </div>
  )
}

// ─── StepSequencer ────────────────────────────────────────────────────────────

interface PopupState {
  trackId: string
  stepIdx: number
  x:       number
  y:       number
}

export default function StepSequencer(): JSX.Element {
  const {
    seqTracks, stepCount, seqPlaying, seqCurrentStep, seqBpm, seqSyncToHost,
    setSeqStep, setSeqTrackMute, setSeqTrackSolo, setSeqPlaying, setSeqCurrentStep,
    setSeqBpm, setSeqSyncToHost, addSeqTrack, removeSeqTrack, resetSeq, setStepCount,
  } = useMidiStore()

  const [popup, setPopup] = useState<PopupState | null>(null)

  // ── Engine init ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const eng = getStepSequencerEngine()
    eng.setCallbacks(
      (p, v, ch) => getMidiEngine().noteOn(p, v, ch),
      (p, ch)    => getMidiEngine().noteOff(p, ch),
    )
    eng.setOnStep(step => setSeqCurrentStep(step))
    return () => { eng.stop() }
  }, [setSeqCurrentStep])

  useEffect(() => {
    getStepSequencerEngine().setTracks(seqTracks)
  }, [seqTracks])

  useEffect(() => {
    getStepSequencerEngine().setBpm(seqBpm)
  }, [seqBpm])

  useEffect(() => {
    getStepSequencerEngine().setStepCount(stepCount)
  }, [stepCount])

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handlePlay = (): void => {
    getStepSequencerEngine().start()
    setSeqPlaying(true)
  }

  const handleStop = (): void => {
    getStepSequencerEngine().stop()
    setSeqPlaying(false)
  }

  const handleReset = (): void => {
    getStepSequencerEngine().stop()
    resetSeq()
  }

  const handleStepClick = (trackId: string, stepIdx: number): void => {
    const track = seqTracks.find(t => t.id === trackId)
    if (!track) return
    const step = track.steps[stepIdx]
    if (!step) return
    setSeqStep(trackId, stepIdx, { active: !step.active })
  }

  const handleStepRightClick = (
    e: React.MouseEvent,
    trackId: string,
    stepIdx: number,
  ): void => {
    e.preventDefault()
    setPopup({ trackId, stepIdx, x: e.clientX, y: e.clientY })
  }

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
    display:        'flex',
    alignItems:     'center',
    gap:            10,
    marginBottom:   16,
    flexWrap:       'wrap',
  }

  const titleStyle: React.CSSProperties = {
    fontSize:      9,
    color:         '#2d2d42',
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontWeight:    700,
    marginRight:   8,
  }

  const btnBase: React.CSSProperties = {
    background:   'rgba(255,255,255,0.04)',
    border:       '1px solid rgba(255,255,255,0.08)',
    borderRadius: 5,
    color:        '#94a3b8',
    fontSize:     10,
    fontFamily:   'monospace',
    cursor:       'pointer',
    padding:      '4px 10px',
    transition:   'all 0.15s',
  }

  const btnActive: React.CSSProperties = {
    ...btnBase,
    background: 'rgba(124,58,237,0.3)',
    border:     '1px solid rgba(124,58,237,0.6)',
    color:      '#a855f7',
  }

  const bpmLabel: React.CSSProperties = {
    fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: 1,
  }

  const bpmValue: React.CSSProperties = {
    fontSize: 13, color: '#e2e8f0', fontWeight: 700, minWidth: 36, textAlign: 'center',
  }

  const spinBtn: React.CSSProperties = {
    background:   'rgba(255,255,255,0.05)',
    border:       '1px solid rgba(255,255,255,0.08)',
    borderRadius: 3,
    color:        '#94a3b8',
    cursor:       'pointer',
    width:        18,
    height:       18,
    display:      'flex',
    alignItems:   'center',
    justifyContent: 'center',
    fontSize:     10,
    padding:      0,
    lineHeight:   1,
  }

  const gridContainer: React.CSSProperties = {
    overflowX: 'auto',
    paddingBottom: 4,
  }

  const stepNumRow: React.CSSProperties = {
    display:      'flex',
    alignItems:   'center',
    gap:          3,
    marginBottom: 4,
    paddingLeft:  90,
  }

  const stepNumStyle: React.CSSProperties = {
    width:     22,
    fontSize:  8,
    color:     '#2d2d42',
    textAlign: 'center',
    flexShrink: 0,
  }

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <span style={titleStyle}>Step Sequencer</span>

        <button style={seqPlaying ? btnActive : btnBase} onClick={handlePlay}>▶ Play</button>
        <button style={btnBase} onClick={handleStop}>■ Stop</button>
        <button style={btnBase} onClick={handleReset}>↺ Reset</button>

        {/* BPM */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 8 }}>
          <span style={bpmLabel}>BPM</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <button style={spinBtn} onClick={() => setSeqBpm(Math.min(300, seqBpm + 1))}>▲</button>
            <button style={spinBtn} onClick={() => setSeqBpm(Math.max(40, seqBpm - 1))}>▼</button>
          </div>
          <span style={bpmValue}>{seqBpm}</span>
        </div>

        {/* Steps */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8 }}>
          <span style={bpmLabel}>Steps</span>
          <button
            style={stepCount === 16 ? btnActive : btnBase}
            onClick={() => setStepCount(16)}
          >16</button>
          <button
            style={stepCount === 32 ? btnActive : btnBase}
            onClick={() => setStepCount(32)}
          >32</button>
        </div>

        {/* Sync */}
        <button
          style={seqSyncToHost ? btnActive : btnBase}
          onClick={() => setSeqSyncToHost(!seqSyncToHost)}
        >↻ Sync</button>

        {/* Add track */}
        <button
          style={{ ...btnBase, marginLeft: 'auto' }}
          onClick={addSeqTrack}
          disabled={seqTracks.length >= 8}
        >+ Track</button>
      </div>

      {/* Grid */}
      <div style={gridContainer}>
        {/* Step numbers */}
        <div style={stepNumRow}>
          {Array.from({ length: stepCount }, (_, i) => (
            <div key={i} style={stepNumStyle}>{i + 1}</div>
          ))}
        </div>

        {/* Tracks */}
        {seqTracks.map(track => (
          <TrackRow
            key={track.id}
            track={track}
            stepCount={stepCount}
            currentStep={seqCurrentStep}
            isPlaying={seqPlaying}
            onStepClick={handleStepClick}
            onStepRightClick={handleStepRightClick}
            onMute={() => setSeqTrackMute(track.id, !track.muted)}
            onSolo={() => setSeqTrackSolo(track.id, !track.soloed)}
            onRemove={() => removeSeqTrack(track.id)}
            canRemove={seqTracks.length > 1}
          />
        ))}
      </div>

      {/* Step popup */}
      {popup !== null && (() => {
        const track = seqTracks.find(t => t.id === popup.trackId)
        const step  = track?.steps[popup.stepIdx]
        if (!track || !step) return null
        return (
          <StepPopup
            trackId={popup.trackId}
            stepIdx={popup.stepIdx}
            step={step}
            anchorX={popup.x}
            anchorY={popup.y}
            onClose={() => setPopup(null)}
          />
        )
      })()}
    </div>
  )
}

// ─── TrackRow ─────────────────────────────────────────────────────────────────

interface TrackRowProps {
  track:            import('../../store/midiStore').SeqTrack
  stepCount:        number
  currentStep:      number
  isPlaying:        boolean
  onStepClick:      (trackId: string, stepIdx: number) => void
  onStepRightClick: (e: React.MouseEvent, trackId: string, stepIdx: number) => void
  onMute:           () => void
  onSolo:           () => void
  onRemove:         () => void
  canRemove:        boolean
}

function TrackRow({
  track, stepCount, currentStep, isPlaying,
  onStepClick, onStepRightClick, onMute, onSolo, onRemove, canRemove,
}: TrackRowProps): JSX.Element {
  const rowStyle: React.CSSProperties = {
    display:       'flex',
    alignItems:    'center',
    gap:           3,
    marginBottom:  4,
  }

  const trackLabelStyle: React.CSSProperties = {
    width:         84,
    display:       'flex',
    alignItems:    'center',
    gap:           5,
    flexShrink:    0,
  }

  const colorDot: React.CSSProperties = {
    width:        8,
    height:       8,
    borderRadius: '50%',
    background:   track.color,
    flexShrink:   0,
  }

  const trackName: React.CSSProperties = {
    fontSize:  10,
    color:     '#94a3b8',
    fontFamily: 'monospace',
    overflow:  'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex:      1,
  }

  const ctrlBtn = (active: boolean, color: string): React.CSSProperties => ({
    width:        18,
    height:       18,
    borderRadius: 3,
    border:       `1px solid ${active ? color : 'rgba(255,255,255,0.08)'}`,
    background:   active ? `${color}33` : 'rgba(255,255,255,0.03)',
    color:        active ? color : '#475569',
    fontSize:     8,
    fontFamily:   'monospace',
    cursor:       'pointer',
    display:      'flex',
    alignItems:   'center',
    justifyContent: 'center',
    padding:      0,
    lineHeight:   1,
    flexShrink:   0,
  })

  const stepStyle = (step: SeqStep, idx: number): React.CSSProperties => {
    const isCurrentStep = isPlaying && idx === currentStep
    const baseColor     = step.active ? track.color : '#0e0e1c'
    return {
      width:        22,
      height:       22,
      borderRadius: 3,
      background:   baseColor,
      border:       isCurrentStep
        ? '2px solid #ffffff'
        : step.active
          ? `1px solid ${track.color}`
          : '1px solid rgba(255,255,255,0.06)',
      cursor:       'pointer',
      flexShrink:   0,
      opacity:      track.muted ? 0.3 : step.active ? (step.accent ? 1 : 0.85) : 0.6,
      boxShadow:    isCurrentStep ? `0 0 6px rgba(255,255,255,0.4)` : step.active ? `0 0 4px ${track.color}66` : 'none',
      transition:   'box-shadow 0.05s',
    }
  }

  // group steps in sets of 4 for visual separation
  const steps = Array.from({ length: stepCount }, (_, i) => track.steps[i] ?? {
    active: false, pitch: 60, velocity: 100, gate: 0.8, probability: 100, accent: false,
  } as SeqStep)

  return (
    <div style={rowStyle}>
      {/* Track label + color */}
      <div style={trackLabelStyle}>
        <div style={colorDot} />
        <span style={trackName}>{track.name}</span>
      </div>

      {/* Steps */}
      {steps.map((step, idx) => (
        <div
          key={idx}
          style={{
            ...stepStyle(step, idx),
            marginRight: (idx + 1) % 4 === 0 && idx < stepCount - 1 ? 6 : 0,
          }}
          onClick={() => onStepClick(track.id, idx)}
          onContextMenu={e => onStepRightClick(e, track.id, idx)}
        />
      ))}

      {/* Controls */}
      <div style={{ display: 'flex', gap: 3, marginLeft: 8, flexShrink: 0 }}>
        <button style={ctrlBtn(track.muted, '#ef4444')} onClick={onMute}>M</button>
        <button style={ctrlBtn(track.soloed, '#f59e0b')} onClick={onSolo}>S</button>
        <button
          style={ctrlBtn(false, '#475569')}
          onClick={onRemove}
          disabled={!canRemove}
        >−</button>
      </div>
    </div>
  )
}
