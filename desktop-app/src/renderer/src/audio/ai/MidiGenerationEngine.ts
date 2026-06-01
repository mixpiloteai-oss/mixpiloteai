// ─── MidiGenerationEngine.ts ──────────────────────────────────────────────────
// Top-level orchestrator for all MIDI/automation generation.

import type { MusicalStyle } from './MusicAnalyzer'
import type { ProjectAnalysis } from './MusicAnalyzer'
import type { GeneratedPattern } from './PatternGenerator'
import type { AutomationType, AutomationShape } from './AutomationGenerator'
import type { DrumStyle } from './DrumPatternLibrary'
import type { BasslineStyle } from './BasslineGenerator'
import type { MelodyContour } from './MelodyGenerator'
import { getPattern, createVariation } from './DrumPatternLibrary'
import { generateBassline } from './BasslineGenerator'
import { generateMelody } from './MelodyGenerator'
import { generateAutomation } from './AutomationGenerator'
import { styleToScale } from './MusicTheory'
import { GenerationHistory } from './GenerationHistory'

export type GenerationTarget =
  | 'drums' | 'bassline' | 'melody' | 'chords'
  | 'transition_buildup' | 'transition_drop'
  | 'automation'

export interface GenerationRequest {
  target:    GenerationTarget
  bars:      number
  seed?:     number
  style:     MusicalStyle
  key:       { root: number; mode: 'major' | 'minor' } | null
  bpm:       number
  // optional overrides
  drumStyle?:       DrumStyle
  bassStyle?:       BasslineStyle
  melodyContour?:   MelodyContour
  automationType?:  AutomationType
  automationShape?: AutomationShape
}

export interface GenerationResult {
  request:    GenerationRequest
  pattern:    GeneratedPattern | null
  automation: import('./AutomationGenerator').AutomationCurve | null
  label:      string
  warnings:   string[]
}

export class MidiGenerationEngine {
  generate(req: GenerationRequest): GenerationResult {
    const warnings: string[] = []
    const seed = req.seed ?? (Date.now() & 0xffffffff)
    const key   = req.key ?? { root: 0, mode: 'major' as const }
    const bars  = req.bars

    let pattern: GeneratedPattern | null = null
    let automation: import('./AutomationGenerator').AutomationCurve | null = null
    let label = ''

    switch (req.target) {
      case 'drums': {
        const drumStyle: DrumStyle = req.drumStyle ?? 'four-on-the-floor'
        pattern = getPattern(drumStyle, bars, seed)
        label = `Drums (${drumStyle}, ${bars} bars)`
        break
      }

      case 'bassline': {
        const bassStyle: BasslineStyle = req.bassStyle ?? 'root_only'
        pattern = generateBassline({
          key,
          style: req.style,
          bassStyle,
          bars,
          octave: 2,
          seed,
        })
        label = `Bassline (${bassStyle}, ${bars} bars)`
        break
      }

      case 'melody': {
        const scale = styleToScale(req.style, key.mode)
        pattern = generateMelody({
          key,
          scale,
          style: req.style,
          bars,
          startOctave: 4,
          noteDensity: 'medium',
          contour: req.melodyContour ?? 'random_walk',
          seed,
        })
        label = `Melody (${req.style}, ${bars} bars)`
        break
      }

      case 'chords': {
        const scale = styleToScale(req.style, key.mode)
        pattern = generateMelody({
          key,
          scale,
          style: req.style,
          bars,
          startOctave: 4,
          noteDensity: 'sparse',
          contour: 'neighbor',
          seed,
        })
        label = `Chords (${req.style}, ${bars} bars)`
        break
      }

      case 'transition_buildup': {
        const drumStyle: DrumStyle = req.drumStyle ?? 'four-on-the-floor'
        const base = getPattern(drumStyle, bars, seed)
        pattern = createVariation(base, 'fill', seed)
        automation = generateAutomation('filter_sweep_up', bars, 'exponential', seed)
        label = `Transition Buildup (${bars} bars)`
        break
      }

      case 'transition_drop': {
        const drumStyle: DrumStyle = req.drumStyle ?? 'four-on-the-floor'
        pattern = getPattern(drumStyle, bars, seed)
        label = `Transition Drop (${bars} bars)`
        break
      }

      case 'automation': {
        const automationType: AutomationType = req.automationType ?? 'filter_sweep_up'
        const automationShape: AutomationShape = req.automationShape ?? 'linear'
        automation = generateAutomation(automationType, bars, automationShape, seed)
        label = `Automation (${automationType}, ${bars} bars)`
        break
      }

      default:
        warnings.push(`Unknown generation target: ${req.target as string}`)
        label = 'Unknown'
    }

    const result: GenerationResult = {
      request: { ...req, seed },
      pattern,
      automation,
      label,
      warnings,
    }

    generationHistory.push({
      timestamp:  Date.now(),
      label,
      pattern,
      automation,
      accepted:   false,
    })

    return result
  }

  getSuggestions(analysis: ProjectAnalysis): GenerationRequest[] {
    const suggestions: GenerationRequest[] = []
    const key = analysis.detectedKey
      ? { root: analysis.detectedKey.root, mode: analysis.detectedKey.mode }
      : { root: 0, mode: 'major' as const }

    // Map detected style to drum style
    const drumStyle: DrumStyle = (() => {
      switch (analysis.style) {
        case 'techno':        return 'techno'
        case 'house':         return 'house'
        case 'hip-hop':       return 'boom-bap'
        case 'drum-and-bass': return 'dnb'
        case 'ambient':       return 'four-on-the-floor'
        default:              return 'four-on-the-floor'
      }
    })()

    const bassStyle: BasslineStyle = (() => {
      switch (analysis.style) {
        case 'techno':   return 'syncopated'
        case 'house':    return 'groove'
        case 'hip-hop':  return 'root_only'
        default:         return 'walking'
      }
    })()

    const base = {
      bars:  4,
      style: analysis.style,
      key,
      bpm:   analysis.bpm,
    }

    if (!analysis.hasKick) {
      suggestions.push({ ...base, target: 'drums', drumStyle })
    }

    if (!analysis.hasBass) {
      suggestions.push({ ...base, target: 'bassline', bassStyle })
    }

    if (!analysis.hasHarmony && analysis.hasKick && analysis.hasBass) {
      suggestions.push({ ...base, target: 'melody', melodyContour: 'random_walk' })
    }

    // Always suggest transitions
    suggestions.push({ ...base, target: 'transition_buildup', drumStyle })
    suggestions.push({ ...base, target: 'automation', automationType: 'filter_sweep_up', automationShape: 'exponential' })

    return suggestions.slice(0, 5)
  }
}

export const generationHistory  = new GenerationHistory()
export const midiGenerationEngine = new MidiGenerationEngine()
