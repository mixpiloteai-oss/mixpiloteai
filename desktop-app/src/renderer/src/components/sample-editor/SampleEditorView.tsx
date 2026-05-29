// ─── SampleEditorView ─────────────────────────────────────────────────────────
// Main sample editor shell: toolbar + waveform canvas + status bar.

import React, { useCallback } from 'react'
import { useAudioEditorStore } from '../../store/audioEditorStore'
import { WaveformCanvas }      from './WaveformCanvas'
import { AudioEditorToolbar }  from './AudioEditorToolbar'

function formatTime(samples: number, sampleRate: number): string {
  const secs  = samples / sampleRate
  const m     = Math.floor(secs / 60)
  const s     = (secs % 60).toFixed(3)
  return `${m}:${s.padStart(6, '0')}`
}

export const SampleEditorView: React.FC = () => {
  const {
    engine, sampleRate, cursorPosition, selectionStart, selectionEnd,
    channels, zoomLevel, detectedBpm,
  } = useAudioEditorStore()

  const totalSamples = engine?.editBuffer.totalLength ?? 0

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    // File loading would be done via the store.loadBuffer() after decoding
  }, [])

  return (
    <div
      style={{
        display:       'flex',
        flexDirection: 'column',
        width:         '100%',
        height:        '100%',
        background:    '#0f172a',
        color:         '#e2e8f0',
        fontFamily:    'monospace',
        overflow:      'hidden',
      }}
      onDragOver={e => e.preventDefault()}
      onDrop={onDrop}
    >
      <AudioEditorToolbar />

      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {engine ? (
          <WaveformCanvas />
        ) : (
          <div
            style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              height:         '100%',
              color:          '#475569',
              fontSize:       14,
            }}
          >
            Drop an audio file or load a sample to begin editing
          </div>
        )}
      </div>

      {/* Status bar */}
      <div
        style={{
          display:       'flex',
          gap:           16,
          padding:       '3px 12px',
          background:    '#020617',
          borderTop:     '1px solid rgba(255,255,255,0.06)',
          fontSize:      11,
          color:         '#64748b',
          flexShrink:    0,
        }}
      >
        <span>Cursor: {formatTime(cursorPosition, sampleRate)}</span>
        {selectionStart !== null && selectionEnd !== null && (
          <span>
            Sel: {formatTime(selectionStart, sampleRate)} – {formatTime(selectionEnd, sampleRate)}
            &nbsp;({formatTime(selectionEnd - selectionStart, sampleRate)})
          </span>
        )}
        <span>Zoom: {zoomLevel} smp/px</span>
        <span>{sampleRate} Hz</span>
        <span>{channels}ch</span>
        {totalSamples > 0 && (
          <span>Total: {formatTime(totalSamples, sampleRate)}</span>
        )}
        {detectedBpm && (
          <span>BPM: {detectedBpm.bpm.toFixed(1)} (conf: {(detectedBpm.confidence * 100).toFixed(0)}%)</span>
        )}
        <div style={{ flex: 1 }} />
        <span>Sample Editor</span>
      </div>
    </div>
  )
}

export default SampleEditorView
