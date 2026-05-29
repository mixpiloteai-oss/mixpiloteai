// ─── AudioEditorToolbar ───────────────────────────────────────────────────────
// Toolbar for the sample editor: edit ops, zoom, mode toggle.

import React, { useCallback } from 'react'
import { useAudioEditorStore } from '../../store/audioEditorStore'
import { detectTransients }    from '../../audio/editor/TransientDetector'
import { detectBpm }           from '../../audio/editor/BpmDetector'
import type { FadeCurve }      from '../../audio/editor/AudioEditorEngine'

const Btn: React.FC<{ label: string; onClick: () => void; disabled?: boolean; title?: string }> = ({
  label, onClick, disabled, title,
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    style={{
      padding:      '4px 8px',
      fontSize:     12,
      borderRadius: 4,
      border:       '1px solid rgba(255,255,255,0.15)',
      background:   disabled ? '#1e293b' : '#334155',
      color:        disabled ? '#64748b' : '#e2e8f0',
      cursor:       disabled ? 'default' : 'pointer',
    }}
  >
    {label}
  </button>
)

export const AudioEditorToolbar: React.FC = () => {
  const {
    engine, selectionStart, selectionEnd, zoomLevel, mode, sampleRate,
    setZoom, setMode, setTransients, setBpm, invalidate,
  } = useAudioEditorStore()

  const hasSel = selectionStart !== null && selectionEnd !== null
  const start  = selectionStart ?? 0
  const end    = selectionEnd   ?? 0

  const wrap = useCallback((fn: () => void) => { fn(); invalidate() }, [invalidate])

  const handleCut    = () => wrap(() => engine?.cut(start, end))
  const handleCopy   = () => engine?.copy(start, end)
  const handlePaste  = () => wrap(() => engine?.paste(start))

  const handleFadeIn  = (curve: FadeCurve = 'linear') => wrap(() => engine?.fadeIn(start, end, curve))
  const handleFadeOut = (curve: FadeCurve = 'linear') => wrap(() => engine?.fadeOut(start, end, curve))

  const handleNormalize = () => wrap(() => engine?.normalize(start, end, -1))
  const handleReverse   = () => wrap(() => engine?.reverse(start, end))
  const handleGain      = () => {
    const db = parseFloat(window.prompt('Gain (dB):', '0') ?? '0')
    if (!isNaN(db)) wrap(() => engine?.gainClip(start, end, db))
  }
  const handleTimestretch = () => {
    const factor = parseFloat(window.prompt('Stretch factor (0.5 = half speed):', '1') ?? '1')
    if (!isNaN(factor) && factor > 0) wrap(() => engine?.timestretch(start, end, factor))
  }

  const handleTransients = () => {
    const flat = engine?.editBuffer.flatten()
    if (!flat?.[0]) return
    const positions = detectTransients(flat[0], sampleRate)
    setTransients(positions)
  }

  const handleBpm = () => {
    const flat = engine?.editBuffer.flatten()
    if (!flat?.[0]) return
    const result = detectBpm(flat[0], sampleRate)
    setBpm(result)
  }

  const handleUndo = () => wrap(() => engine?.undo_())
  const handleRedo = () => wrap(() => engine?.redo_())

  return (
    <div
      style={{
        display:        'flex',
        alignItems:     'center',
        gap:            6,
        padding:        '4px 8px',
        background:     '#0f172a',
        borderBottom:   '1px solid rgba(255,255,255,0.08)',
        flexWrap:       'wrap',
        flexShrink:     0,
      }}
    >
      <Btn label="Undo"  onClick={handleUndo}  disabled={!engine?.canUndo()} />
      <Btn label="Redo"  onClick={handleRedo}  disabled={!engine?.canRedo()} />

      <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.15)' }} />

      <Btn label="Cut"   onClick={handleCut}   disabled={!hasSel} />
      <Btn label="Copy"  onClick={handleCopy}  disabled={!hasSel} />
      <Btn label="Paste" onClick={handlePaste} disabled={!engine} />

      <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.15)' }} />

      <Btn label="Fade In"  onClick={() => handleFadeIn()}  disabled={!hasSel} />
      <Btn label="Fade Out" onClick={() => handleFadeOut()} disabled={!hasSel} />
      <Btn label="Normalize"    onClick={handleNormalize}    disabled={!hasSel} />
      <Btn label="Reverse"      onClick={handleReverse}      disabled={!hasSel} />
      <Btn label="Gain"         onClick={handleGain}         disabled={!hasSel} />
      <Btn label="Timestretch"  onClick={handleTimestretch}  disabled={!hasSel} title="STUB: linear interpolation" />

      <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.15)' }} />

      <Btn label="Detect Transients" onClick={handleTransients} disabled={!engine} />
      <Btn label="Detect BPM"        onClick={handleBpm}        disabled={!engine} />

      <div style={{ flex: 1 }} />

      <label style={{ fontSize: 11, color: '#94a3b8' }}>
        Zoom
        <input
          type="range"
          min={16}
          max={8192}
          step={16}
          value={zoomLevel}
          onChange={e => setZoom(Number(e.target.value))}
          style={{ marginLeft: 4, width: 80 }}
        />
      </label>

      <div
        style={{
          display:      'flex',
          border:       '1px solid rgba(255,255,255,0.15)',
          borderRadius: 4,
          overflow:     'hidden',
        }}
      >
        {(['non-destructive', 'destructive'] as const).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              padding:    '2px 8px',
              fontSize:   11,
              background: mode === m ? '#6366f1' : 'transparent',
              color:      mode === m ? '#fff'    : '#94a3b8',
              border:     'none',
              cursor:     'pointer',
            }}
          >
            {m === 'non-destructive' ? 'Non-Destructive' : 'Destructive'}
          </button>
        ))}
      </div>
    </div>
  )
}

export default AudioEditorToolbar
