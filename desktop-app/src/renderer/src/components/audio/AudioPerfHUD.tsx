// Minimal HUD showing audio performance metrics.
// Only renders when enabled (Ctrl+Shift+P keyboard shortcut).
import { useState, useEffect } from 'react'
import type { AudioPerformanceSnapshot } from '../../audio/PerformanceMonitor'

interface AudioPerfHUDProps {
  perfMonitor?: { subscribe: (fn: (s: AudioPerformanceSnapshot) => void) => () => void } | null
}

export default function AudioPerfHUD({ perfMonitor }: AudioPerfHUDProps) {
  const [visible, setVisible] = useState(false)
  const [snap, setSnap] = useState<AudioPerformanceSnapshot | null>(null)

  // Toggle with Ctrl+Shift+P (P for "performance")
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'P') setVisible(v => !v)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (!visible || !perfMonitor) return
    return perfMonitor.subscribe(setSnap)
  }, [visible, perfMonitor])

  if (!visible || !snap) return null

  const dropoutColor =
    snap.dropoutCount === 0 ? '#22c55e' : snap.dropoutCount < 3 ? '#f59e0b' : '#ef4444'

  return (
    <div style={{
      position: 'fixed', bottom: 40, right: 16, zIndex: 9999,
      background: 'rgba(0,0,0,0.85)', border: '1px solid #1a1a2e',
      borderRadius: 8, padding: '8px 12px', fontSize: 11, fontFamily: 'monospace',
      color: '#94a3b8', backdropFilter: 'blur(8px)', lineHeight: 1.7,
      pointerEvents: 'none',
    }}>
      <div style={{ color: '#e2e8f0', fontWeight: 700, marginBottom: 4 }}>Audio Performance</div>
      <div>Base latency: <span style={{ color: '#8b5cf6' }}>{snap.baseLatencyMs.toFixed(1)} ms</span></div>
      <div>Output latency: <span style={{ color: '#8b5cf6' }}>{snap.outputLatencyMs.toFixed(1)} ms</span></div>
      <div>Total: <span style={{ color: '#8b5cf6' }}>{(snap.baseLatencyMs + snap.outputLatencyMs).toFixed(1)} ms</span></div>
      <div>CPU estimate: <span style={{ color: snap.cpuEstimateMs > 5 ? '#f59e0b' : '#22c55e' }}>{snap.cpuEstimateMs.toFixed(2)} ms</span></div>
      <div>Sample rate: <span style={{ color: '#475569' }}>{snap.sampleRate} Hz</span></div>
      <div>Dropouts: <span style={{ color: dropoutColor }}>{snap.dropoutCount}</span></div>
      <div style={{ marginTop: 4, fontSize: 10, color: '#334155' }}>Ctrl+Shift+P to toggle</div>
    </div>
  )
}
