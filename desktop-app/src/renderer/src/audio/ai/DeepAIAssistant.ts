// ─── DeepAIAssistant.ts ───────────────────────────────────────────────────────
// Orchestrates the full deep AI pipeline for a user command.

import { musicContextEngine } from './MusicContextEngine'
import type { MusicContext, ProjectSnapshot } from './MusicContextEngine'
import { parseAdvancedCommand } from './AdvancedCommandParser'
import type { AdvancedParsedCommand } from './AdvancedCommandParser'
import { commandActionPlanner } from './CommandActionPlanner'
import type { ActionPlan } from './CommandActionPlanner'
import { liveSuggestionEngine } from './LiveSuggestionEngine'
import type { AISuggestion } from './LiveSuggestionEngine'

export interface DeepAIResult {
  context: MusicContext
  parsedCommand: AdvancedParsedCommand
  plan: ActionPlan
  suggestions: AISuggestion[]
  responseText: string
  source: 'local' | 'cloud'
}

interface CloudResponse {
  available: boolean
  text?: string
}

function isCloudResponse(v: unknown): v is CloudResponse {
  return typeof v === 'object' && v !== null && 'available' in v
}

class DeepAIAssistant {
  /**
   * Process a natural-language command through the full deep AI pipeline.
   */
  async processCommand(text: string, snapshot: ProjectSnapshot): Promise<DeepAIResult> {
    // Step 1: Build context
    const context = await musicContextEngine.buildContext(snapshot)

    // Step 2: Parse command
    const parsedCommand = parseAdvancedCommand(text, context)

    // Step 3: Plan actions if confidence > 0.6
    let plan: ActionPlan
    if (parsedCommand.confidence > 0.6) {
      plan = commandActionPlanner.planActions(parsedCommand, context)
    } else {
      plan = {
        actions: [],
        estimatedDuration: 0,
        affectedTracks: [],
        description: 'Low confidence — no actions planned',
      }
    }

    // Step 4: Generate suggestions
    const suggestions = liveSuggestionEngine.generateSuggestions(context)

    // Step 5: Build response text
    const prefix = parsedCommand.confidence > 0.7 ? 'Je comprends' : 'Je vais essayer'
    const firstSuggestion = suggestions[0]
    const suggestionHint = firstSuggestion ? ` ${firstSuggestion.title}.` : ''
    const responseText = `${prefix}: ${plan.description}.${suggestionHint}`

    // Step 6: Cloud fallback for low confidence
    let source: 'local' | 'cloud' = 'local'
    if (parsedCommand.confidence < 0.4) {
      try {
        const api = typeof window !== 'undefined' ? window.electronAPI?.aiProcessCommand : undefined
        if (typeof api === 'function') {
          const cloudResult = await api(context.contextSummary + '\n' + text, text)
          if (isCloudResponse(cloudResult) && cloudResult.available) {
            source = 'cloud'
          }
        }
      } catch {
        // Silently fall back to local
      }
    }

    return {
      context,
      parsedCommand,
      plan,
      suggestions,
      responseText,
      source,
    }
  }
}

export const deepAIAssistant = new DeepAIAssistant()
