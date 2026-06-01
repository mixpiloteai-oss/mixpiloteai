// ─── MasteringAssistant ───────────────────────────────────────────────────────
// Analyzes master bus and generates mastering readiness report.

import { DynamicsAnalyzer } from '../analysis/DynamicsAnalyzer'
import { FrequencyAnalyzer } from '../analysis/FrequencyAnalyzer'
import { StereoAnalyzer } from '../analysis/StereoAnalyzer'
import { MixBalanceSuggestionEngine } from './MixBalanceSuggestionEngine'
import type { MixIssue } from './MixBalanceSuggestionEngine'

export type MasteringSuggestionType =
  | 'limiting'
  | 'eq'
  | 'saturation'
  | 'compression'
  | 'stereo-width'

export interface MasteringSuggestion {
  type:   MasteringSuggestionType
  params: Record<string, number | string>
  reason: string
}

export interface MasteringReport {
  lufs:         number
  peakDb:       number
  dynamicRange: number
  stereoWidth:  number
  suggestions:  MasteringSuggestion[]
  readyToMaster: boolean
  issues:        MixIssue[]
}

// ─── Public API ───────────────────────────────────────────────────────────────

export class MasteringAssistant {
  private readonly dynAnalyzer    = new DynamicsAnalyzer()
  private readonly freqAnalyzer   = new FrequencyAnalyzer()
  private readonly stereoAnalyzer = new StereoAnalyzer()
  private readonly balanceEngine  = new MixBalanceSuggestionEngine()

  analyzeMaster(
    masterBus: Float32Array,
    sampleRate: number,
    targetLUFS = -14,
  ): MasteringReport {
    const dynamics  = this.dynAnalyzer.analyzeDynamics(masterBus, sampleRate)
    const lufs      = this.dynAnalyzer.computeLUFS(masterBus, sampleRate)
    const spectrum  = this.freqAnalyzer.analyzeSpectrum(masterBus, sampleRate)
    const balance   = this.balanceEngine.analyzeBalance(spectrum, sampleRate)

    // Stereo width: use same channel as both L and R for mono master analysis
    // For stereo, caller should pass interleaved or use left channel
    const stereoResult = this.stereoAnalyzer.analyzeStereo(masterBus, masterBus)
    const stereoWidth  = stereoResult.stereoWidth

    const suggestions: MasteringSuggestion[] = []
    const issues: MixIssue[] = [...balance.issues]

    const lufsOffset = lufs - targetLUFS
    const readyLufs  = isFinite(lufs) && Math.abs(lufsOffset) <= 2
    const readyPeak  = dynamics.peakDb < -0.3
    const readyDR    = dynamics.dynamicRange > 6

    // LUFS suggestions
    if (!isFinite(lufs) || Math.abs(lufsOffset) > 2) {
      const gainAdj = isFinite(lufs) ? -(lufsOffset) : 0
      suggestions.push({
        type:   'limiting',
        params: { targetLUFS, currentLUFS: isFinite(lufs) ? lufs : -70, gainAdjustmentDb: gainAdj },
        reason: isFinite(lufs)
          ? `Integrated loudness ${lufs.toFixed(1)} LUFS is ${Math.abs(lufsOffset).toFixed(1)} dB ${lufsOffset > 0 ? 'above' : 'below'} target ${targetLUFS} LUFS`
          : 'Signal is too quiet for reliable LUFS measurement',
      })
    }

    // True peak limiting
    if (!readyPeak) {
      suggestions.push({
        type:   'limiting',
        params: { ceilingDb: -0.3, currentPeakDb: dynamics.peakDb },
        reason: `True peak ${dynamics.peakDb.toFixed(1)} dBFS exceeds -0.3 dBFS ceiling for streaming platforms`,
      })
      issues.push({
        type:        'peak',
        description: `Peak level ${dynamics.peakDb.toFixed(1)} dBFS will cause clipping after codec processing`,
        severity:    'critical',
      })
    }

    // Dynamic range
    if (!readyDR) {
      suggestions.push({
        type:   'compression',
        params: { dynamicRange: dynamics.dynamicRange, targetDR: 6 },
        reason: `Dynamic range ${dynamics.dynamicRange.toFixed(1)} dB is below recommended 6 dB minimum`,
      })
    }

    // High crest factor → suggest saturation/compression
    if (dynamics.crestFactor > 18) {
      suggestions.push({
        type:   'saturation',
        params: { crestFactor: dynamics.crestFactor },
        reason: `High crest factor (${dynamics.crestFactor.toFixed(1)} dB) suggests sparse transients — subtle saturation could add density`,
      })
    }

    // EQ from balance
    if (balance.lowBalance > 0.5) {
      suggestions.push({
        type:   'eq',
        params: { frequencyHz: 80, gainDb: -2, type: 'shelf' },
        reason: 'Reduce boomy low end with gentle low-shelf cut',
      })
    }
    if (balance.highBalance < 0.05) {
      suggestions.push({
        type:   'eq',
        params: { frequencyHz: 10000, gainDb: 1.5, type: 'shelf' },
        reason: 'Add air with gentle high-shelf boost',
      })
    }

    // Stereo width
    if (stereoWidth < 0.1) {
      suggestions.push({
        type:   'stereo-width',
        params: { currentWidth: stereoWidth, targetWidth: 0.3 },
        reason: 'Master is nearly mono — consider stereo widening if appropriate for genre',
      })
    }

    const readyToMaster = readyLufs && readyPeak && readyDR && issues.filter((i) => i.severity === 'critical').length === 0

    return {
      lufs:          isFinite(lufs) ? lufs : -70,
      peakDb:        dynamics.peakDb,
      dynamicRange:  dynamics.dynamicRange,
      stereoWidth,
      suggestions,
      readyToMaster,
      issues,
    }
  }
}

export const masteringAssistant = new MasteringAssistant()
