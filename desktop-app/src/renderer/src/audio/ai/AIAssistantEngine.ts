// ─── AIAssistantEngine ────────────────────────────────────────────────────────
// Main orchestration. Processes commands through local pipeline, with optional cloud path.

import type { Project } from '../../types/project'
import { analyzeProject } from './MusicAnalyzer'
import type { ProjectAnalysis } from './MusicAnalyzer'
import { parseCommand } from './CommandParser'
import { executeCommand } from './MusicCommandExecutor'
import type { ExecutionResult } from './MusicCommandExecutor'
import { buildContext } from './ProjectContextBuilder'
import { useTransportStore } from '../../store/transportStore'

export interface AIResponse {
  text:     string              // natural language response (FR)
  result:   ExecutionResult | null
  analysis: ProjectAnalysis | null
  source:   'local' | 'cloud'
}

// Cloud response type guard
interface CloudResponse {
  available: boolean
  text?:     string
}

function isCloudResponse(v: unknown): v is CloudResponse {
  return typeof v === 'object' && v !== null && 'available' in v
}

class AIAssistantEngine {
  /**
   * Check if cloud AI is available via Electron IPC.
   */
  isCloudEnabled(): boolean {
    return typeof window !== 'undefined' &&
      typeof window.electronAPI?.aiProcessCommand === 'function'
  }

  /**
   * Analyze a project and return ProjectAnalysis.
   */
  analyzeProject(project: Project): ProjectAnalysis {
    return analyzeProject(project)
  }

  /**
   * Handle direct DAW transport/BPM commands via string matching.
   * Returns a result if the command was handled, null otherwise.
   */
  private handleDawCommand(text: string): ExecutionResult | null {
    const t = text.toLowerCase().trim()

    // Play
    if (t === 'play' || t === 'jouer') {
      useTransportStore.getState().play()
      return {
        success:  true,
        message:  'Lecture démarrée.',
        changes:  [{ type: 'no_op', detail: 'play()' }],
        warnings: [],
      }
    }

    // Stop / Pause
    if (t === 'stop' || t === 'pause' || t === 'arrêt' || t === 'arret') {
      useTransportStore.getState().stop()
      return {
        success:  true,
        message:  'Lecture arrêtée.',
        changes:  [{ type: 'no_op', detail: 'stop()' }],
        warnings: [],
      }
    }

    // Double BPM
    if (t === 'double bpm' || t === 'double le bpm' || t === 'doubler le bpm') {
      const current = useTransportStore.getState().bpm
      const next    = Math.min(300, current * 2)
      useTransportStore.getState().setBpm(next)
      return {
        success:  true,
        message:  `BPM doublé: ${current} → ${next}.`,
        changes:  [{ type: 'set_bpm', detail: `BPM → ${next}` }],
        warnings: [],
      }
    }

    // Half BPM
    if (t === 'half bpm' || t === 'divise bpm' || t === 'divise le bpm' || t === 'moitié bpm' || t === 'demi bpm') {
      const current = useTransportStore.getState().bpm
      const next    = Math.max(40, Math.round(current / 2))
      useTransportStore.getState().setBpm(next)
      return {
        success:  true,
        message:  `BPM divisé: ${current} → ${next}.`,
        changes:  [{ type: 'set_bpm', detail: `BPM → ${next}` }],
        warnings: [],
      }
    }

    // Set BPM to N: "set bpm 140", "bpm 140", "bpm à 140"
    const bpmMatch = t.match(/(?:set\s+bpm|bpm\s+[aà]?)\s+(\d+(?:\.\d+)?)/)
      ?? t.match(/^bpm\s+(\d+(?:\.\d+)?)$/)
    if (bpmMatch) {
      const value = parseFloat(bpmMatch[1])
      if (!isNaN(value) && value >= 40 && value <= 300) {
        useTransportStore.getState().setBpm(value)
        return {
          success:  true,
          message:  `Tempo réglé à ${value} BPM.`,
          changes:  [{ type: 'set_bpm', detail: `BPM → ${value}` }],
          warnings: [],
        }
      }
    }

    return null
  }

  /**
   * Process a natural-language command against the current project.
   * Falls back to local processing if cloud is unavailable or fails.
   */
  async processCommand(text: string, project: Project): Promise<AIResponse> {
    const analysis = analyzeProject(project)

    // Fast-path: handle direct DAW transport/BPM commands without going through AI pipeline
    const dawResult = this.handleDawCommand(text)
    if (dawResult) {
      return {
        text:     dawResult.message,
        result:   dawResult,
        analysis,
        source:   'local',
      }
    }

    const cmd      = parseCommand(text)

    // Try cloud path if available
    if (this.isCloudEnabled() && window.electronAPI?.aiProcessCommand) {
      try {
        const ctx         = buildContext(project, analysis)
        const cloudResult = await window.electronAPI.aiProcessCommand(ctx.summary, text)

        if (isCloudResponse(cloudResult) && cloudResult.available && cloudResult.text) {
          const result = executeCommand(cmd, analysis)
          return {
            text:     cloudResult.text,
            result,
            analysis,
            source:   'cloud',
          }
        }
      } catch (err) {
        console.warn('[AIAssistantEngine] Cloud path failed, falling back to local:', err)
      }
    }

    // Local path
    const result = executeCommand(cmd, analysis)
    const text_  = buildFrenchResponse(result, cmd.intent)

    return {
      text:     text_,
      result,
      analysis,
      source:   'local',
    }
  }
}

/**
 * Build a friendly French response from the execution result.
 */
function buildFrenchResponse(
  result: ExecutionResult,
  intent: string,
): string {
  if (!result.success) {
    return result.message
  }

  // The message is already in French from MusicCommandExecutor
  let response = result.message

  if (result.warnings.length > 0) {
    response += ` (${result.warnings[0]})`
  }

  // Add musical context
  if (intent === 'generate_pattern') {
    response += ' Le clip a été inséré dans le projet.'
  } else if (intent === 'analyze') {
    // Message already contains full analysis
  }

  return response
}

export const aiAssistant = new AIAssistantEngine()
