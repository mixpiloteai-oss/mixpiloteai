// ─── AdvancedCommandParser.ts ─────────────────────────────────────────────────
// Extended command parser with FR/EN bilingual support and music context awareness.

import type { MusicContext } from './MusicContextEngine'

export type CommandIntent =
  | 'acid_ramp'
  | 'more_aggressive'
  | 'cleaner_bass'
  | 'add_groove'
  | 'humanize'
  | 'more_dynamics'
  | 'add_buildup'
  | 'add_drop'
  | 'add_breakdown'
  | 'add_transition'
  | 'remove_section'
  | 'change_style'
  | 'change_energy'
  | 'fix_kick_bass'
  | 'add_harmony'
  | 'generate_melody'
  | 'generate_drums'
  | 'generate_bassline'
  | 'detect_key'
  | 'quantize'
  | 'reverse_section'
  | 'unknown'

export interface CommandParameters {
  style?: string
  intensity?: number
  targetTrack?: string
  bars?: number
  curve?: string
  value?: number
}

export interface AdvancedParsedCommand {
  intent: CommandIntent
  confidence: number
  parameters: CommandParameters
  rawText: string
  language: 'fr' | 'en' | 'mixed'
  contextualHints: string[]
}

// ── Normalization ──────────────────────────────────────────────────────────────

function removeAccents(text: string): string {
  return text
    .replace(/[éèêë]/g, 'e')
    .replace(/[àâä]/g, 'a')
    .replace(/[ùûü]/g, 'u')
    .replace(/[îï]/g, 'i')
    .replace(/[ôö]/g, 'o')
    .replace(/[ç]/g, 'c')
    .replace(/[ñ]/g, 'n')
}

function normalize(text: string): string {
  return removeAccents(text.toLowerCase().trim())
}

// ── Keyword maps ──────────────────────────────────────────────────────────────

interface IntentMapping {
  keywords: string[]
  params?: Partial<CommandParameters>
}

const INTENT_MAP: Array<{ intent: CommandIntent; mappings: IntentMapping[] }> = [
  {
    intent: 'acid_ramp',
    mappings: [
      { keywords: ['acid ramp', 'montee acid', 'fais une montee acid', 'acid line'] },
      { keywords: ['acid'] },
    ],
  },
  {
    intent: 'more_aggressive',
    mappings: [
      { keywords: ['plus agressif', 'more aggressive', 'harder', 'plus dur', 'agressif'] },
      { keywords: ['hard', 'brutal', 'violent'] },
    ],
  },
  {
    intent: 'cleaner_bass',
    mappings: [
      { keywords: ['basse plus propre', 'cleaner bass', 'nettoie la basse', 'clean bass', 'rends la basse plus propre'] },
      { keywords: ['propre', 'clean'] },
    ],
  },
  {
    intent: 'add_groove',
    mappings: [
      { keywords: ['groove tribe', 'tribal', 'groove africain', 'ajoute groove tribe'], params: { style: 'tribal' } },
      { keywords: ['add groove', 'ajoute groove', 'ajoute du groove'] },
    ],
  },
  {
    intent: 'humanize',
    mappings: [
      { keywords: ['humanize hats', 'humanize', 'humaniser', 'humain', 'plus humain', 'humanise'] },
      { keywords: ['rends humain'] },
    ],
  },
  {
    intent: 'more_dynamics',
    mappings: [
      { keywords: ['plus de dynamique', 'more dynamics', 'dynamic range', 'plus dynamique'] },
      { keywords: ['dynamics', 'dynamique'] },
    ],
  },
  {
    intent: 'add_buildup',
    mappings: [
      { keywords: ['montee', 'buildup', 'build up', 'build', 'crescendo', 'add buildup', 'add a buildup', 'ajoute une montee'] },
    ],
  },
  {
    intent: 'add_drop',
    mappings: [
      { keywords: ['add drop', 'fais un drop', 'gros drop', 'chute'] },
      { keywords: ['drop'] },
    ],
  },
  {
    intent: 'add_breakdown',
    mappings: [
      { keywords: ['breakdown', 'break', 'add breakdown'] },
    ],
  },
  {
    intent: 'add_transition',
    mappings: [
      { keywords: ['transition', 'bridge', 'lier', 'add transition'] },
    ],
  },
  {
    intent: 'fix_kick_bass',
    mappings: [
      { keywords: ['kick bass', 'bass clash', 'sidechain', 'fix kick', 'basse kick'] },
      { keywords: ['kick'] },
    ],
  },
  {
    intent: 'add_harmony',
    mappings: [
      { keywords: ['add harmony', 'ajoute harmonie', 'harmonise', 'harmonize'] },
    ],
  },
  {
    intent: 'generate_melody',
    mappings: [
      { keywords: ['generate melody', 'cree une melodie', 'make melody', 'melodie'] },
    ],
  },
  {
    intent: 'generate_drums',
    mappings: [
      { keywords: ['generate drums', 'cree une batterie', 'make drums', 'generate drum'] },
    ],
  },
  {
    intent: 'generate_bassline',
    mappings: [
      { keywords: ['generate bassline', 'cree une ligne de basse', 'make bassline', 'bassline'] },
    ],
  },
  {
    intent: 'detect_key',
    mappings: [
      { keywords: ['detect key', 'detecte la tonalite', 'quelle tonalite', 'find key', 'what key'] },
    ],
  },
  {
    intent: 'quantize',
    mappings: [
      { keywords: ['quantize', 'quantise', 'quantifier', 'grille', 'snap to grid'] },
    ],
  },
  {
    intent: 'reverse_section',
    mappings: [
      { keywords: ['reverse', 'inverser', 'retourner'] },
    ],
  },
]

// ── Language detection ────────────────────────────────────────────────────────

const FR_WORDS = ['le', 'la', 'les', 'un', 'une', 'des', 'et', 'ou', 'est', 'de', 'du', 'en',
  'plus', 'moins', 'avec', 'pour', 'sur', 'dans', 'fais', 'rends', 'ajoute', 'basse', 'montee',
  'plus', 'dynamique', 'propre', 'agressif', 'humain', 'tribal', 'groove', 'batterie']

const EN_WORDS = ['the', 'a', 'an', 'and', 'or', 'is', 'add', 'make', 'more', 'less', 'with',
  'for', 'on', 'in', 'generate', 'create', 'build', 'drop', 'bass', 'kick', 'snare',
  'drums', 'melody', 'harmony', 'buildup', 'humanize', 'quantize', 'reverse', 'detect']

function detectLanguage(text: string): 'fr' | 'en' | 'mixed' {
  const tokens = text.split(/\s+/)
  let frCount = 0
  let enCount = 0

  for (const token of tokens) {
    if (FR_WORDS.includes(token)) frCount++
    if (EN_WORDS.includes(token)) enCount++
  }

  if (frCount > 0 && enCount > 0) return 'mixed'
  if (frCount > enCount) return 'fr'
  if (enCount > frCount) return 'en'
  return 'en' // default
}

// ── Parameter extraction ──────────────────────────────────────────────────────

function extractBars(text: string): number | undefined {
  const match = text.match(/(\d+)\s*(?:bars?|mesures?)/i)
  if (match) {
    const n = parseInt(match[1]!, 10)
    if (!isNaN(n) && n > 0) return n
  }
  return undefined
}

function extractIntensity(text: string): number | undefined {
  if (/beaucoup\s+plus|much\s+more|tres\s+|very\s+/.test(text)) return 0.9
  if (/un\s+peu|a\s+bit|slightly|leger/.test(text)) return 0.3
  if (/plus|more/.test(text)) return 0.7
  return undefined
}

// ── Simple Levenshtein distance ───────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]!
      } else {
        dp[i]![j] = 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!)
      }
    }
  }
  return dp[m]![n]!
}

// ── Main parser ───────────────────────────────────────────────────────────────

/**
 * Parse a natural-language music command (FR/EN) into an AdvancedParsedCommand.
 */
export function parseAdvancedCommand(text: string, context?: MusicContext): AdvancedParsedCommand {
  const normalized = normalize(text)
  const padded = ` ${normalized} `

  let bestIntent: CommandIntent = 'unknown'
  let bestConfidence = 0
  let bestParams: CommandParameters = {}

  for (const { intent, mappings } of INTENT_MAP) {
    for (const { keywords, params } of mappings) {
      for (const kw of keywords) {
        if (padded.includes(kw)) {
          // Exact match → high confidence
          const confidence = 0.95
          if (confidence > bestConfidence) {
            bestConfidence = confidence
            bestIntent = intent
            bestParams = { ...params }
          }
          break
        }
        // Fuzzy match: check each word token
        const words = padded.trim().split(/\s+/)
        for (const word of words) {
          if (word.length >= 4 && kw.length >= 4) {
            const dist = levenshtein(word, kw)
            if (dist <= 2) {
              const confidence = 0.7
              if (confidence > bestConfidence) {
                bestConfidence = confidence
                bestIntent = intent
                bestParams = { ...params }
              }
            }
          }
        }
      }
    }
  }

  // Extract parameters
  const bars = extractBars(text)
  if (bars !== undefined) bestParams.bars = bars

  const intensity = extractIntensity(normalized)
  if (intensity !== undefined) bestParams.intensity = intensity

  // Language detection
  const language = detectLanguage(normalized)

  // Contextual hints from MusicContext
  const contextualHints: string[] = []
  if (context) {
    if (context.kickBass.frequencyClashRisk === 'high') {
      contextualHints.push('High kick/bass clash detected')
    }
    if (context.arrangement.hasDropStructure) {
      contextualHints.push('Drop structure present')
    }
    if (context.style.primaryStyle !== 'unknown') {
      contextualHints.push(`Style: ${context.style.primaryStyle}`)
    }
  }

  return {
    intent: bestIntent,
    confidence: bestConfidence,
    parameters: bestParams,
    rawText: text,
    language,
    contextualHints,
  }
}

export const advancedCommandParser = { parseCommand: parseAdvancedCommand }
