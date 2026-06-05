// ─── WorkflowAnalyzer ────────────────────────────────────────────────────────
// Orchestrates all workflow analysis into a single result.

import type { Project } from '../../types/project'
import { analyzeMix } from './MixingAssistant'
import type { MixingAnalysis } from './MixingAssistant'
import { detectSections } from './SectionDetector'
import type { ArrangementSection } from './SectionDetector'
import { analyzeOrganization } from './TrackOrganizer'
import type { OrganizationSuggestions } from './TrackOrganizer'
import { getContextualTips } from './WorkflowTipEngine'
import type { Tip } from './WorkflowTipEngine'
import { getAllTemplates, getTemplateDiff } from './TemplateLibrary'
import type { ProjectTemplate, TemplateDiff } from './TemplateLibrary'
import { analyzeProject } from '../ai/MusicAnalyzer'

export interface WorkflowAnalysis {
  mixing:        MixingAnalysis
  sections:      ArrangementSection[]
  organization:  OrganizationSuggestions
  tips:          Tip[]
  templateMatch: { template: ProjectTemplate | null; diff: TemplateDiff | null }
  score:         number
  analyzedAt:    number
}

export function analyzeWorkflow(project: Project): WorkflowAnalysis {
  const mixing       = analyzeMix(project)
  const sections     = detectSections(project)
  const organization = analyzeOrganization(project)
  const tips         = getContextualTips(project, mixing, 5)

  // Find best template match
  const projectAnalysis  = analyzeProject(project)
  const detectedStyle    = projectAnalysis.style
  const allTemplates     = getAllTemplates()
  const matchedTemplate  = allTemplates.find(t => t.style === detectedStyle) ?? null
  const diff             = matchedTemplate ? getTemplateDiff(project, matchedTemplate) : null

  // Organization score
  const orgPenalty      = (organization.colors.length + organization.names.length + organization.groups.length) * 5
  const organizationScore = Math.max(0, Math.min(100, 100 - orgPenalty))

  // Overall score
  const score = Math.round((mixing.score + organizationScore) / 2)

  return {
    mixing,
    sections,
    organization,
    tips,
    templateMatch: { template: matchedTemplate, diff },
    score,
    analyzedAt: Date.now(),
  }
}
