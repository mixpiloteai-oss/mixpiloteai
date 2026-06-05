// ─── Local AI Engine ──────────────────────────────────────────────────────────
// Main coordinator for all local (offline) AI analysis.
// Uses requestIdleCallback for non-blocking scheduling.
// Minimum 3-second interval between full analyses to avoid CPU spikes.

import { AudioEngine }      from '../../audio/AudioEngine'
import { analyzeMix, type MixAnalysis }          from '../../audio/analysis/MixAnalyzer'
import { analyzeStructure, type StructureAnalysis } from '../../audio/analysis/StructureAnalyzer'
import { clippingDetector, type ClippingReport } from '../../audio/analysis/ClippingDetector'
import { adviseArrangement, type ArrangementAdvice, type TrackSummary } from './ArrangementAdvisor'
import { adviseProjectOrganization, type ProjectOrgAdvice } from './SampleOrganizer'

export interface LocalAIResult {
  mix:          MixAnalysis | null
  structure:    StructureAnalysis | null
  clipping:     ClippingReport
  arrangement:  ArrangementAdvice | null
  organization: ProjectOrgAdvice | null
  analyzedAt:   number   // Date.now()
}

type Listener = (result: LocalAIResult) => void

const MIN_INTERVAL_MS = 3_000

class LocalAIEngine {
  private listeners:   Set<Listener> = new Set()
  private lastRun:     number = 0
  private idleHandle:  number | null = null
  private result:      LocalAIResult = {
    mix: null, structure: null,
    clipping: clippingDetector.getReport(),
    arrangement: null, organization: null, analyzedAt: 0,
  }

  // Context injected from React via setContext()
  private ctx: {
    tracks:       TrackSummary[]
    totalBars:    number
    bpm:          number
    waveformData: number[]
    trackNames:   string[]
    pluginCount:  number
    sampleCount:  number
  } | null = null

  constructor() {
    // Keep clipping report fresh in result whenever detector fires
    clippingDetector.subscribe(report => {
      this.result = { ...this.result, clipping: report }
      this.emit()
    })
  }

  setContext(ctx: LocalAIEngine['ctx']): void {
    this.ctx = ctx
  }

  /** Schedule a full analysis on the next idle frame, respecting the min interval. */
  requestAnalysis(): void {
    if (this.idleHandle !== null) return   // already queued
    const since = Date.now() - this.lastRun
    const delay = Math.max(0, MIN_INTERVAL_MS - since)

    if (delay === 0) {
      this.idleHandle = requestIdleCallback(() => { this.idleHandle = null; this.run() }, { timeout: 2000 })
    } else {
      setTimeout(() => {
        this.idleHandle = requestIdleCallback(() => { this.idleHandle = null; this.run() }, { timeout: 2000 })
      }, delay)
    }
  }

  getResult(): LocalAIResult { return this.result }

  subscribe(cb: Listener): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  /** Attach the master AnalyserNode so clipping + mix analysis work. */
  attachAudioEngine(): void {
    try {
      const engine = AudioEngine.getInstance()
      clippingDetector.attach(engine.masterAnalyser)
    } catch {
      // AudioEngine may not be initialized yet in headless/test environments
    }
  }

  detach(): void {
    clippingDetector.detach()
    if (this.idleHandle !== null) { cancelIdleCallback(this.idleHandle); this.idleHandle = null }
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private run(): void {
    this.lastRun = Date.now()

    let mix:         MixAnalysis | null = null
    let structure:   StructureAnalysis | null = null
    let arrangement: ArrangementAdvice | null = null
    let organization: ProjectOrgAdvice | null = null

    // Mix analysis from live audio
    try {
      const engine = AudioEngine.getInstance()
      mix = analyzeMix(engine.masterAnalyser)
    } catch { /* AudioEngine not ready */ }

    // Structure from waveform data
    if (this.ctx && this.ctx.waveformData.length > 0) {
      structure = analyzeStructure(this.ctx.waveformData)
    }

    // Arrangement advice
    if (this.ctx) {
      arrangement = adviseArrangement(this.ctx.tracks, this.ctx.totalBars, this.ctx.bpm, structure)
      organization = adviseProjectOrganization(this.ctx.trackNames, this.ctx.pluginCount, this.ctx.sampleCount)
    }

    this.result = {
      mix,
      structure,
      clipping: clippingDetector.getReport(),
      arrangement,
      organization,
      analyzedAt: Date.now(),
    }
    this.emit()
  }

  private emit(): void {
    const r = this.result
    this.listeners.forEach(cb => cb(r))
  }
}

export const localAIEngine = new LocalAIEngine()
