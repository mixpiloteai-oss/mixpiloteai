// ─── CommandParser ────────────────────────────────────────────────────────────
// Real rule-based NLP — NO AI hallucination, NO random.
// Pure tokenization + keyword matching.

export type CommandIntent =
  | 'generate_pattern'
  | 'add_buildup'
  | 'add_drop'
  | 'humanize'
  | 'modify_pattern'
  | 'set_bpm'
  | 'transpose'
  | 'set_key'
  | 'add_chord'
  | 'analyze'
  | 'unknown'

export type TargetInstrument =
  | 'kick' | 'snare' | 'hihat' | 'bass' | 'lead' | 'pad' | 'melody' | 'all' | 'unknown'

export type StyleTag =
  | 'tribe' | 'techno' | 'house' | 'ambient' | 'aggressive' | 'soft' | 'groovy' | 'straight' | 'unknown'

export interface ParsedCommand {
  raw:       string
  intent:    CommandIntent
  target:    TargetInstrument
  style:     StyleTag
  value:     number | null     // BPM, interval size, etc.
  direction: 'increase' | 'decrease' | 'none'
  confidence: number           // 0–1
}

// ── Normalization ─────────────────────────────────────────────────────────────

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

const INTENT_KEYWORDS: Record<CommandIntent, string[]> = {
  generate_pattern: ['fais un', 'genere', 'cree un', 'add a', 'generate', 'make a', 'cree', 'generer', 'fais'],
  add_buildup:      ['montee', 'buildup', 'build up', 'rise', 'crescendo', 'monte la tension'],
  add_drop:         ['drop', 'fais un drop', 'chute', 'breakdown', 'fais tomber'],
  humanize:         ['humanize', 'humaniser', 'humanise', 'rends humain', 'groove', 'swing'],
  modify_pattern:   ['rends', 'modifie', 'change', 'make it', 'plus', 'moins', 'more', 'less', 'modifies'],
  set_bpm:          ['bpm', 'tempo', 'vitesse', 'speed', 'beats per minute'],
  transpose:        ['transpose', 'octave', 'quinte', 'quarte', 'semi', 'demi-ton'],
  set_key:          ['tonalite', 'key', 'mineur', 'majeur', 'minor', 'major', 'en do', 'en re', 'en mi', 'en fa', 'en sol', 'en la', 'en si', 'note la ', 'gamme'],
  add_chord:        ['accord', 'chord', 'ajoute un accord', 'add chord'],
  analyze:          ['analyse', 'analyze', 'montre', 'show', 'info', 'quoi', 'what', 'dis moi', 'tell me'],
  unknown:          [],
}

// Priority ordering for intent detection (most specific first)
const INTENT_PRIORITY: CommandIntent[] = [
  'add_buildup',
  'add_drop',
  'humanize',
  'set_bpm',
  'transpose',
  'add_chord',
  'analyze',
  'generate_pattern',
  'modify_pattern',
  'set_key',
]

const TARGET_KEYWORDS: Record<TargetInstrument, string[]> = {
  kick:    ['kick', 'grosse caisse', 'bass drum', ' bd '],
  snare:   ['snare', 'caisse claire', 'clap'],
  hihat:   ['hat', 'hihat', 'hi-hat', 'cymbale', 'cymbal', 'charleston', 'chapeau'],
  bass:    ['bass', 'basse', ' sub ', 'low end'],
  lead:    ['lead', 'melodie', 'melody', 'synth lead', 'melodique'],
  pad:     ['pad', 'nappe', 'strings', 'cordes'],
  melody:  ['melodie', 'melody', 'melodique', 'theme', 'motif'],
  all:     ['tout', 'all', 'everything', 'tous'],
  unknown: [],
}

const STYLE_KEYWORDS: Record<StyleTag, string[]> = {
  tribe:      ['tribe', 'tribal', 'minimal', 'chicago', 'tribo'],
  techno:     ['techno', 'industriel', 'industrial', 'detroit', 'berlinois', 'berlin'],
  house:      ['house', 'deep house', 'funky house', 'garage'],
  ambient:    ['ambient', 'atmospherique', 'drone', 'chillout', 'chill'],
  aggressive: ['agressif', 'agressive', 'aggressive', 'hard', 'fort', 'loud', 'heavy', 'brutal'],
  soft:       ['doux', 'soft', 'gentle', 'calme', 'calm', 'quiet', 'leger'],
  groovy:     ['groovy', 'funky', 'swing', 'groove'],
  straight:   ['straight', 'rigide', 'strict', 'robotique', 'quantize'],
  unknown:    [],
}

// ── Detection helpers ─────────────────────────────────────────────────────────

function detectIntent(text: string): { intent: CommandIntent; signals: number } {
  for (const intent of INTENT_PRIORITY) {
    const keywords = INTENT_KEYWORDS[intent]
    const matched  = keywords.filter(kw => text.includes(kw)).length
    if (matched > 0) {
      return { intent, signals: matched }
    }
  }
  return { intent: 'unknown', signals: 0 }
}

function detectTarget(text: string): TargetInstrument {
  for (const [target, keywords] of Object.entries(TARGET_KEYWORDS) as [TargetInstrument, string[]][]) {
    if (target === 'unknown') continue
    if (keywords.some(kw => text.includes(kw))) return target
  }
  return 'unknown'
}

function detectStyle(text: string): StyleTag {
  for (const [style, keywords] of Object.entries(STYLE_KEYWORDS) as [StyleTag, string[]][]) {
    if (style === 'unknown') continue
    if (keywords.some(kw => text.includes(kw))) return style
  }
  return 'unknown'
}

function detectDirection(text: string): 'increase' | 'decrease' | 'none' {
  const increaseWords = ['plus', 'more', 'harder', 'louder', 'augmente', 'increase', 'fort', 'haut', 'higher']
  const decreaseWords = ['moins', 'less', 'softer', 'lighter', 'diminue', 'decrease', 'doux', 'bas', 'lower']

  if (increaseWords.some(w => text.includes(w))) return 'increase'
  if (decreaseWords.some(w => text.includes(w))) return 'decrease'
  return 'none'
}

function extractValue(text: string): number | null {
  // Match numbers (integer or decimal), possibly followed by BPM context
  const match = text.match(/\b(\d+(?:\.\d+)?)\b/)
  if (match) {
    const n = parseFloat(match[1])
    if (!isNaN(n)) return n
  }
  return null
}

function computeConfidence(
  intent: CommandIntent,
  intentSignals: number,
  target: TargetInstrument,
  style: StyleTag,
): number {
  if (intent === 'unknown') return 0

  let score = 0
  // Intent match contributes most
  score += Math.min(intentSignals * 0.4, 0.6)
  // Known target adds weight
  if (target !== 'unknown') score += 0.2
  // Known style adds weight
  if (style !== 'unknown') score += 0.2

  return Math.min(1, score)
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Parse a natural-language music command (FR/EN) into a structured ParsedCommand.
 * Pure, deterministic, no AI, no Math.random.
 */
export function parseCommand(text: string): ParsedCommand {
  const raw        = text
  const normalized = normalize(text)

  // Add spaces around text for easier word-boundary matching
  const padded = ` ${normalized} `

  const { intent, signals } = detectIntent(padded)
  const target    = detectTarget(padded)
  const style     = detectStyle(padded)
  const direction = detectDirection(padded)
  const value     = extractValue(normalized)
  const confidence = computeConfidence(intent, signals, target, style)

  return { raw, intent, target, style, value, direction, confidence }
}
