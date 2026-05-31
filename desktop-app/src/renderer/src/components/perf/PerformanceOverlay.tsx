import { useState, useEffect } from 'react'
import { usePerfMonitorStore } from '../../store/perfMonitorStore'

function fpsColor(fps: number): string {
  if (fps > 50) return '#10b981'   // green
  if (fps > 30) return '#f59e0b'   // orange
  return '#ef4444'                  // red
}

function Sparkline({ data, width = 120, height = 32 }: {
  data: number[]; width?: number; height?: number
}) {
  if (data.length < 2) return <svg width={width} height={height} />
  const max = Math.max(120, ...data)
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - (v / max) * height
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke="#10b981" strokeWidth={1.5} opacity={0.8} />
    </svg>
  )
}

export default function PerformanceOverlay() {
  const [visible, setVisible] = useState(false)
  const snapshot    = usePerfMonitorStore(s => s.snapshot)
  const historyFps  = usePerfMonitorStore(s => s.historyFps)
  const monitoring  = usePerfMonitorStore(s => s.monitoring)
  const start       = usePerfMonitorStore(s => s.startMonitoring)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F12') {
        e.preventDefault()
        setVisible(v => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Auto-start monitoring when overlay becomes visible
  useEffect(() => {
    if (visible && !monitoring) start()
  }, [visible, monitoring, start])

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed', top: 8, right: 8, zIndex: 9999,
      background: 'rgba(10,10,20,0.88)', backdropFilter: 'blur(4px)',
      border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
      padding: '8px 12px', minWidth: 160, fontFamily: 'monospace',
      fontSize: 11, color: '#e2e8f0', lineHeight: '1.6',
      userSelect: 'none',
    }}>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
        PERFORMANCE  <span style={{ float: 'right', cursor: 'pointer' }}
          onClick={() => setVisible(false)}>✕</span>
      </div>

      {!snapshot ? (
        <div style={{ color: 'rgba(255,255,255,0.4)' }}>monitoring inactive</div>
      ) : (
        <>
          <div>
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>FPS </span>
            <span style={{ color: fpsColor(snapshot.fps), fontWeight: 700, fontSize: 14 }}>
              {snapshot.fps.toFixed(0)}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.35)', marginLeft: 6 }}>
              min {snapshot.fpsMin.toFixed(0)}
            </span>
          </div>
          <div>
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>Frame </span>
            {snapshot.frameTimeMs.toFixed(1)} ms
          </div>
          {snapshot.memoryMb > 0 && (
            <div>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>Mem </span>
              {snapshot.memoryMb.toFixed(0)} / {snapshot.memoryLimitMb.toFixed(0)} MB
            </div>
          )}
          {snapshot.audioLatencyMs > 0 && (
            <div>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>Audio </span>
              {snapshot.audioLatencyMs.toFixed(1)} ms
            </div>
          )}
          <div style={{ marginTop: 6 }}>
            <Sparkline data={historyFps} />
          </div>
        </>
      )}
    </div>
  )
}
