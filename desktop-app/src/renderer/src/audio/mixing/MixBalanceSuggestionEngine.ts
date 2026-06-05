// ─── MixBalanceSuggestionEngine ───────────────────────────────────────────────
// Analyzes master bus spectrum for overall mix balance issues.

import type { SpectrumData } from '../analysis/FrequencyAnalyzer'

export interface MixIssue {
  type:        string
  description: string
  severity:    'info' | 'warning' | 'critical'
}

export interface MixBalanceSuggestion {
  lowBalance:  number  // energy ratio in 20–250 Hz
  midBalance:  number  // energy ratio in 250 Hz–4 kHz
  highBalance: number  // energy ratio in 4 kHz–20 kHz
  issues:      MixIssue[]
  summary:     string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function energyInRange(spectrum: SpectrumData, minHz: number, maxHz: number): number {
  const { frequencies, magnitudes } = spectrum
  let sum   = 0
  let count = 0
  for (let k = 0; k < frequencies.length; k++) {
    const f  = frequencies[k] ?? 0
    const db = magnitudes[k] ?? -Infinity
    if (f >= minHz && f <= maxHz && isFinite(db)) {
      const lin = Math.pow(10, db / 20)
      sum += lin
      count++
    }
  }
  return count > 0 ? sum / count : 0
}

// ─── Public API ───────────────────────────────────────────────────────────────

export class MixBalanceSuggestionEngine {
  analyzeBalance(
    masterSpectrum: SpectrumData,
    _sampleRate: number,
  ): MixBalanceSuggestion {
    const lowEnergy  = energyInRange(masterSpectrum, 20, 250)
    const midEnergy  = energyInRange(masterSpectrum, 250, 4000)
    const highEnergy = energyInRange(masterSpectrum, 4000, 20000)

    const total = lowEnergy + midEnergy + highEnergy
    const lowBalance  = total > 0 ? lowEnergy  / total : 0
    const midBalance  = total > 0 ? midEnergy  / total : 0
    const highBalance = total > 0 ? highEnergy / total : 0

    const issues: MixIssue[] = []

    // Boomy: too much low end
    if (lowBalance > 0.5) {
      issues.push({
        type:        'boomy',
        description: `Low end dominates mix (${(lowBalance * 100).toFixed(1)}% of energy). Consider low-shelf cut or high-pass on non-bass elements.`,
        severity:    lowBalance > 0.65 ? 'critical' : 'warning',
      })
    }

    // Thin: too little low end
    if (lowBalance < 0.15) {
      issues.push({
        type:        'thin',
        description: `Mix lacks low-end energy (${(lowBalance * 100).toFixed(1)}%). Consider adding warmth or checking bass/kick levels.`,
        severity:    lowBalance < 0.08 ? 'critical' : 'warning',
      })
    }

    // Muddy: 200–500 Hz dominates high end
    const mudEnergy = energyInRange(masterSpectrum, 200, 500)
    const mudRatio  = highEnergy > 0 ? mudEnergy / highEnergy : 0
    if (mudRatio > 1.5) {
      issues.push({
        type:        'muddy',
        description: `Mud buildup in 200–500 Hz range (${(mudRatio).toFixed(2)}x the high energy). Apply selective cuts in this range.`,
        severity:    mudRatio > 2.5 ? 'critical' : 'warning',
      })
    }

    // Harsh: too much high energy
    if (highBalance > 0.45) {
      issues.push({
        type:        'harsh',
        description: `Mix has excessive high-frequency energy (${(highBalance * 100).toFixed(1)}%). May sound harsh or fatiguing.`,
        severity:    'warning',
      })
    }

    // Lacking air
    if (highBalance < 0.05) {
      issues.push({
        type:        'dull',
        description: `Mix lacks high-frequency air (${(highBalance * 100).toFixed(1)}%). Consider adding high-shelf boost on master or airy elements.`,
        severity:    'info',
      })
    }

    // Midrange imbalance
    if (midBalance < 0.2) {
      issues.push({
        type:        'hollow',
        description: `Midrange energy is low (${(midBalance * 100).toFixed(1)}%). Mix may sound hollow.`,
        severity:    'info',
      })
    }

    // Generate summary
    let summary = 'Mix balance: '
    if (issues.length === 0) {
      summary += 'Well balanced across frequency ranges.'
    } else {
      const criticals = issues.filter((i) => i.severity === 'critical').length
      const warnings  = issues.filter((i) => i.severity === 'warning').length
      summary += `${issues.length} issue(s) detected`
      if (criticals > 0) summary += ` (${criticals} critical)`
      if (warnings  > 0) summary += ` (${warnings} warning)`
      summary += '.'
    }

    return { lowBalance, midBalance, highBalance, issues, summary }
  }
}

export const mixBalanceSuggestionEngine = new MixBalanceSuggestionEngine()
