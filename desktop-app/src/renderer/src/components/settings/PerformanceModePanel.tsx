import { useEffect } from 'react'
import { usePerformanceModeStore, type PerformanceMode } from '../../store/performanceModeStore'

const MODES: { id: PerformanceMode; label: string; description: string }[] = [
  {
    id: 'quality',
    label: 'Quality',
    description: 'All visuals on: waveforms, spectrum analyzer, animations, meters. Best for powerful machines.',
  },
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'Waveforms and meters on, spectrum off, FPS capped at 30. Good for mid-range hardware.',
  },
  {
    id: 'studio',
    label: 'Studio',
    description: 'Minimal visuals for maximum audio stability. Perf HUD shown. No animations or spectrum.',
  },
  {
    id: 'low-config',
    label: 'Low Config',
    description: 'Minimum GPU/CPU use. No waveforms, spectrum, meters or animations. 32-track cap.',
  },
]

const CHIP_KEYS: Array<{ key: keyof ReturnType<typeof usePerformanceModeStore.getState>['config']; label: string }> = [
  { key: 'showWaveforms',       label: 'Waveforms' },
  { key: 'showSpectrumAnalyzer',label: 'Spectrum' },
  { key: 'showAnimations',      label: 'Animations' },
  { key: 'showMeterBars',       label: 'Meters' },
  { key: 'useGPULayers',        label: 'GPU Layers' },
  { key: 'showPerfHUD',         label: 'Perf HUD' },
]

const MODE_ORDER: PerformanceMode[] = ['quality', 'balanced', 'studio', 'low-config']

export default function PerformanceModePanel() {
  const { mode, config, setMode } = usePerformanceModeStore()

  // Ctrl+Shift+M cycles through modes
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.shiftKey && e.key === 'M') {
        e.preventDefault()
        const idx = MODE_ORDER.indexOf(mode)
        const next = MODE_ORDER[(idx + 1) % MODE_ORDER.length]
        setMode(next)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mode, setMode])

  return (
    <div style={{ background: '#0c0c18', border: '1px solid #1c1c2e', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#334155' }}>
          Performance Mode
        </span>
        <span style={{ fontSize: 9, color: '#334155' }} title="Keyboard shortcut to cycle modes">
          Ctrl+Shift+M cycles modes
        </span>
      </div>

      {/* Mode buttons */}
      <div style={{ display: 'flex', gap: 6 }}>
        {MODES.map(({ id, label, description }) => {
          const active = mode === id
          return (
            <button
              key={id}
              title={description}
              onClick={() => setMode(id)}
              style={{
                flex: 1,
                padding: '5px 4px',
                borderRadius: 6,
                fontSize: 10,
                fontWeight: active ? 700 : 400,
                cursor: 'pointer',
                background: active ? 'rgba(139,92,246,0.22)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${active ? '#8b5cf6' : 'rgba(255,255,255,0.07)'}`,
                color: active ? '#a78bfa' : '#475569',
                transition: 'all 0.12s',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Config chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {CHIP_KEYS.map(({ key, label }) => {
          const on = config[key] as boolean
          return (
            <span
              key={key}
              style={{
                fontSize: 9,
                fontWeight: 600,
                padding: '2px 7px',
                borderRadius: 20,
                background: on ? 'rgba(139,92,246,0.18)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${on ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.07)'}`,
                color: on ? '#a78bfa' : '#334155',
              }}
            >
              {label}
            </span>
          )
        })}
        <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#334155' }}>
          {config.throttleCanvasFPS === 0 ? 'Unlimited FPS' : `${config.throttleCanvasFPS} FPS`}
        </span>
        {config.maxVisibleTracks !== -1 && (
          <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#334155' }}>
            Max {config.maxVisibleTracks} tracks
          </span>
        )}
      </div>
    </div>
  )
}
