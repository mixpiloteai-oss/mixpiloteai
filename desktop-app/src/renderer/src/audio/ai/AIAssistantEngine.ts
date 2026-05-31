// ─── AIAssistantEngine ────────────────────────────────────────────────────────
// Main orchestration. Processes commands through local pipeline, with optional cloud path.

import type { Project } from '../../types/project'
import { analyzeProject } from './MusicAnalyzer'
import type { ProjectAnalysis } from './MusicAnalyzer'
import { parseCommand } from './CommandParser'
import { executeCommand } from './MusicCommandExecutor'
import type { ExecutionResult } from './MusicCommandExecutor'
import { buildContext } from './ProjectContextBuilder'

export interface AIResponse {
  text:     string              // natural language response (FR)
  result:   ExecutionResult | null
  analysis: ProjectAnalysis | null
  source:   'local' | 'cloud'
}

// Type for the electronAPI window global
interface ElectronAPIWithAI {
  aiProcessCommand?: (ctx: string, cmd: string) => Promise<unknown>
}

declare global {
  interface Window {
    electronAPI?: ElectronAPIWithAI
  }
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
   * Process a natural-language command against the current project.
   * Falls back to local processing if cloud is unavailable or fails.
   */
  async processCommand(text: string, project: Project): Promise<AIResponse> {
    const analysis = analyzeProject(project)
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
    response += ' Ajoutez-le à une piste MIDI pour l\'entendre.'
  } else if (intent === 'analyze') {
    // Message already contains full analysis
  }

  return response
}

export const aiAssistant = new AIAssistantEngine()
