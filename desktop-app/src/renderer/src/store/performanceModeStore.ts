import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type PerformanceMode = 'quality' | 'balanced' | 'studio' | 'low-config'

export interface PerformanceModeConfig {
  showWaveforms: boolean       // render clip waveforms in arrangement
  showSpectrumAnalyzer: boolean // per-channel spectrum in mixer
  showAnimations: boolean      // CSS transitions and fade effects
  showMeterBars: boolean       // peak/RMS meter bars in mixer
  reducedParticles: boolean    // VU meter and visual bling
  maxVisibleTracks: number     // cap tracks shown simultaneously (-1 = unlimited)
  throttleCanvasFPS: number    // max FPS for canvas renders (0 = unlimited)
  useGPULayers: boolean        // promote scrollable canvases to GPU layers
  showPerfHUD: boolean         // audio perf overlay
}

const PRESETS: Record<PerformanceMode, PerformanceModeConfig> = {
  quality: {
    showWaveforms: true, showSpectrumAnalyzer: true, showAnimations: true,
    showMeterBars: true, reducedParticles: false, maxVisibleTracks: -1,
    throttleCanvasFPS: 0, useGPULayers: true, showPerfHUD: false,
  },
  balanced: {
    showWaveforms: true, showSpectrumAnalyzer: false, showAnimations: true,
    showMeterBars: true, reducedParticles: true, maxVisibleTracks: -1,
    throttleCanvasFPS: 30, useGPULayers: true, showPerfHUD: false,
  },
  studio: {
    // Studio mode: maximum audio stability, minimal visual work
    showWaveforms: false, showSpectrumAnalyzer: false, showAnimations: false,
    showMeterBars: true, reducedParticles: true, maxVisibleTracks: -1,
    throttleCanvasFPS: 24, useGPULayers: true, showPerfHUD: true,
  },
  'low-config': {
    // Low-config: minimum GPU/CPU, for laptops or low-end hardware
    showWaveforms: false, showSpectrumAnalyzer: false, showAnimations: false,
    showMeterBars: false, reducedParticles: true, maxVisibleTracks: 32,
    throttleCanvasFPS: 15, useGPULayers: false, showPerfHUD: false,
  },
}

interface PerformanceModeState {
  mode: PerformanceMode
  config: PerformanceModeConfig
  setMode: (mode: PerformanceMode) => void
}

export const usePerformanceModeStore = create<PerformanceModeState>()(
  persist(
    (set) => ({
      mode: 'balanced',
      config: PRESETS['balanced'],
      setMode: (mode) => set({ mode, config: PRESETS[mode] }),
    }),
    { name: 'nt-performance-mode' }
  )
)

// Quick selector hooks
export const usePerfConfig = () => usePerformanceModeStore(s => s.config)
export const usePerfMode = () => usePerformanceModeStore(s => s.mode)
