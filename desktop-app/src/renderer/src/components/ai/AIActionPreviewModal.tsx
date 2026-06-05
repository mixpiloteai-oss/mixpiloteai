// ─── AIActionPreviewModal.tsx ─────────────────────────────────────────────────
// Modal showing what an AI action will do before applying.

import { useEffect, useRef } from 'react'
import type { AIAction } from '../../audio/ai/AIActionManager'

interface AIActionPreviewModalProps {
  action: AIAction
  onApply: () => void
  onReject: () => void
  onClose: () => void
}

function MidiNotesPreview({
  notes,
}: {
  notes: Array<{ pitch: number; startBeat: number; duration: number; velocity: number }>
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || notes.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    ctx.clearRect(0, 0, W, H)

    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, W, H)

    const minPitch = Math.min(...notes.map(n => n.pitch))
    const maxPitch = Math.max(...notes.map(n => n.pitch)) + 1
    const pitchRange = maxPitch - minPitch || 1
    const maxBeat = Math.max(...notes.map(n => n.startBeat + n.duration))

    for (const note of notes) {
      const x = (note.startBeat / maxBeat) * (W - 4) + 2
      const w = Math.max(2, (note.duration / maxBeat) * (W - 4))
      const y = H - ((note.pitch - minPitch + 1) / pitchRange) * (H - 4) - 2
      const h = Math.max(2, ((H - 4) / pitchRange))

      const alpha = 0.4 + (note.velocity / 127) * 0.6
      ctx.fillStyle = `rgba(99, 102, 241, ${alpha})`
      ctx.fillRect(x, y, w, h - 1)
    }
  }, [notes])

  return (
    <canvas
      ref={canvasRef}
      width={360}
      height={100}
      style={{ borderRadius: '4px', border: '1px solid #374151', display: 'block' }}
    />
  )
}

function AutomationPreview({
  points,
}: {
  points: Array<{ laneId: string; beat: number; value: number }>
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || points.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, W, H)

    const sorted = [...points].sort((a, b) => a.beat - b.beat)
    const maxBeat = sorted[sorted.length - 1]!.beat || 1

    ctx.strokeStyle = '#6366f1'
    ctx.lineWidth = 2
    ctx.beginPath()
    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i]!
      const x = (p.beat / maxBeat) * (W - 8) + 4
      const y = H - p.value * (H - 8) - 4
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }, [points])

  return (
    <canvas
      ref={canvasRef}
      width={200}
      height={80}
      style={{ borderRadius: '4px', border: '1px solid #374151', display: 'block' }}
    />
  )
}

export default function AIActionPreviewModal({
  action,
  onApply,
  onReject,
  onClose,
}: AIActionPreviewModalProps) {
  const { previewData } = action
  const confidencePct = Math.round(action.confidence * 100)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          backgroundColor: '#1e1e2e',
          border: '1px solid #374151',
          borderRadius: '10px',
          padding: '20px',
          width: '420px',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div>
            <h2 style={{ color: '#f1f5f9', fontSize: '15px', fontWeight: 700, margin: 0 }}>
              {action.title}
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '12px', margin: '4px 0 0' }}>
              Confidence: {confidencePct}%
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '0 4px',
            }}
            type="button"
          >
            ×
          </button>
        </div>

        {/* Confidence bar */}
        <div style={{ marginBottom: '16px', backgroundColor: '#0f172a', borderRadius: '4px', height: '4px', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${confidencePct}%`,
              backgroundColor: confidencePct > 70 ? '#22c55e' : confidencePct > 40 ? '#f59e0b' : '#ef4444',
            }}
          />
        </div>

        {/* Preview content */}
        <div style={{ marginBottom: '16px' }}>
          {previewData.midiNotes && previewData.midiNotes.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <p style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '6px' }}>
                MIDI Notes ({previewData.midiNotes.length} notes)
              </p>
              <MidiNotesPreview notes={previewData.midiNotes} />
            </div>
          )}

          {previewData.automationPoints && previewData.automationPoints.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <p style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '6px' }}>Automation Curve</p>
              <AutomationPreview points={previewData.automationPoints} />
            </div>
          )}

          {previewData.paramChanges && previewData.paramChanges.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <p style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '6px' }}>Parameter Changes</p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ color: '#64748b' }}>
                    <th style={{ textAlign: 'left', padding: '4px 8px' }}>Parameter</th>
                    <th style={{ textAlign: 'right', padding: '4px 8px' }}>Current</th>
                    <th style={{ textAlign: 'right', padding: '4px 8px' }}>Suggested</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.paramChanges.map(p => (
                    <tr key={p.paramName} style={{ borderTop: '1px solid #1e293b' }}>
                      <td style={{ color: '#d1d5db', padding: '4px 8px' }}>{p.paramName}</td>
                      <td style={{ color: '#94a3b8', textAlign: 'right', padding: '4px 8px' }}>
                        {p.currentValue}{p.unit ?? ''}
                      </td>
                      <td style={{ color: '#22c55e', textAlign: 'right', padding: '4px 8px' }}>
                        {p.suggestedValue}{p.unit ?? ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {previewData.textSuggestion && (
            <div
              style={{
                backgroundColor: '#0f172a',
                border: '1px solid #1e293b',
                borderRadius: '6px',
                padding: '10px',
                color: '#d1d5db',
                fontSize: '13px',
                lineHeight: 1.5,
              }}
            >
              {previewData.textSuggestion}
            </div>
          )}
        </div>

        {/* Description */}
        <p style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '16px' }}>
          {action.description}
        </p>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            onClick={onReject}
            style={{
              padding: '7px 16px',
              borderRadius: '6px',
              border: '1px solid #374151',
              backgroundColor: 'transparent',
              color: '#ef4444',
              fontSize: '13px',
              cursor: 'pointer',
            }}
            type="button"
          >
            Reject
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '7px 16px',
              borderRadius: '6px',
              border: '1px solid #374151',
              backgroundColor: 'transparent',
              color: '#94a3b8',
              fontSize: '13px',
              cursor: 'pointer',
            }}
            type="button"
          >
            Close
          </button>
          <button
            onClick={onApply}
            style={{
              padding: '7px 16px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: '#22c55e',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
            type="button"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}
