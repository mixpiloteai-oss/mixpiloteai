import { useEffect, useRef } from 'react'
import { useProjectStore }  from '../store/projectStore'
import { useTransportStore } from '../store/transportStore'
import { useLocalAIStore }  from '../store/localAIStore'
import { localAIEngine }    from '../services/ai/LocalAIEngine'
import type { TrackSummary } from '../services/ai/ArrangementAdvisor'

const ANALYSIS_INTERVAL_MS = 8_000  // trigger every 8s while active

export function useLocalAI(): void {
  const project  = useProjectStore(s => s.project)
  const bpm      = useTransportStore(s => s.bpm)
  const setResult   = useLocalAIStore(s => s.setResult)
  const setAnalyzing = useLocalAIStore(s => s.setAnalyzing)
  const attachedRef = useRef(false)

  // Attach audio engine once
  useEffect(() => {
    if (attachedRef.current) return
    attachedRef.current = true
    localAIEngine.attachAudioEngine()
    return () => { localAIEngine.detach(); attachedRef.current = false }
  }, [])

  // Subscribe to results
  useEffect(() => {
    return localAIEngine.subscribe(result => setResult(result))
  }, [setResult])

  // Push project context whenever project/bpm changes
  useEffect(() => {
    if (!project) return
    const tracks: TrackSummary[] = project.tracks.map(t => ({
      name:      t.name,
      clipCount: t.clips.length,
      fillPct:   t.clips.reduce((s, c) => s + c.lengthBars, 0) / Math.max(1, project.totalBars) * 100,
    }))
    // Rough waveform proxy: clip coverage per bar
    const coverage: number[] = Array.from({ length: project.totalBars }, (_, bar) => {
      const bar1 = bar + 1
      let total = 0
      for (const t of project.tracks) {
        for (const c of t.clips) {
          if (bar1 >= c.startBar && bar1 < c.startBar + c.lengthBars) { total++; break }
        }
      }
      return total / Math.max(1, project.tracks.length)
    })

    localAIEngine.setContext({
      tracks,
      totalBars:    project.totalBars,
      bpm,
      waveformData: coverage,
      trackNames:   project.tracks.map(t => t.name),
      pluginCount:  0,    // plugin count not tracked in projectStore yet
      sampleCount:  project.tracks.reduce((s, t) => s + t.clips.length, 0),
    })
  }, [project, bpm])

  // Periodic analysis trigger
  useEffect(() => {
    setAnalyzing(true)
    localAIEngine.requestAnalysis()
    const id = setInterval(() => {
      setAnalyzing(true)
      localAIEngine.requestAnalysis()
    }, ANALYSIS_INTERVAL_MS)
    return () => clearInterval(id)
  }, [setAnalyzing])
}
