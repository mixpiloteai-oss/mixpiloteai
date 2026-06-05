// ─── MiniPianoRoll.tsx ────────────────────────────────────────────────────────
// Compact canvas-based preview of a GeneratedPattern. Read-only.

import { useRef, useEffect } from 'react'
import type { GeneratedPattern } from '../../audio/ai/PatternGenerator'

interface MiniPianoRollProps {
  pattern: GeneratedPattern
  height?: number
  width?:  number
}

export default function MiniPianoRoll({
  pattern,
  height = 120,
  width  = 400,
}: MiniPianoRollProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, width, height)

    // Background
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, width, height)

    if (pattern.notes.length === 0) {
      ctx.fillStyle = '#555'
      ctx.font = '14px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('No preview', width / 2, height / 2)
      return
    }

    // Compute pitch and time ranges
    const pitches    = pattern.notes.map(n => n.pitch)
    const minPitch   = Math.min(...pitches) - 2
    const maxPitch   = Math.max(...pitches) + 2
    const pitchRange = maxPitch - minPitch || 1

    const startBeats = pattern.notes.map(n => n.startBeat)
    const endBeats   = pattern.notes.map(n => n.startBeat + n.lengthBeats)
    const minBeat    = Math.min(...startBeats)
    const maxBeat    = Math.max(...endBeats)
    const beatRange  = maxBeat - minBeat || 1

    const pad = 4

    for (const note of pattern.notes) {
      const x = pad + ((note.startBeat - minBeat) / beatRange) * (width - pad * 2)
      const y = height - pad - ((note.pitch - minPitch) / pitchRange) * (height - pad * 2)
      const w = Math.max(2, (note.lengthBeats / beatRange) * (width - pad * 2))
      const h = Math.max(2, (height - pad * 2) / pitchRange)

      const vel = note.velocity / 127
      const hue = 120 + (1 - vel) * 120  // green → blue
      ctx.fillStyle = `hsla(${hue}, 70%, 55%, 0.8)`
      ctx.fillRect(x, y - h / 2, Math.max(1, w - 1), h)
    }
  }, [pattern.notes.length, pattern.bars, width, height])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ display: 'block', borderRadius: 6, background: '#1a1a2e' }}
      aria-label="MIDI pattern preview"
    />
  )
}
