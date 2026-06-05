// ─── LiveSuggestionEngine.ts ──────────────────────────────────────────────────
// Layer 5: Watches project and generates live AI suggestions.

import type { MusicContext, ProjectSnapshot } from './MusicContextEngine'
import { musicContextEngine } from './MusicContextEngine'
import type { MusicStyle } from './deep/AnalysisTypes'

export type SuggestionType = 'warning' | 'idea' | 'fix' | 'enhancement'

export interface AISuggestion {
  id: string
  type: SuggestionType
  title: string
  description: string
  command: string
  priority: number  // 0-1
  category: 'arrangement' | 'mixing' | 'sound' | 'groove' | 'harmony'
}

const STYLE_IDEAS: Partial<Record<MusicStyle, AISuggestion[]>> = {
  house: [
    {
      id: 'idea-house-piano',
      type: 'idea',
      title: 'Add soulful piano chords',
      description: 'House music thrives on gospel-inspired chord progressions. Try adding a soulful piano stab.',
      command: 'add harmony',
      priority: 0.55,
      category: 'harmony',
    },
    {
      id: 'idea-house-offbeat',
      type: 'idea',
      title: 'Add offbeat hi-hat groove',
      description: 'Classic house feel comes from open hi-hats on the offbeats.',
      command: 'add groove',
      priority: 0.5,
      category: 'groove',
    },
  ],
  techno: [
    {
      id: 'idea-techno-acid',
      type: 'idea',
      title: 'Add acid 303 bassline',
      description: 'Techno is defined by its hypnotic, repetitive patterns. A 303-style acid line would fit perfectly.',
      command: 'fais une montée acid',
      priority: 0.6,
      category: 'sound',
    },
    {
      id: 'idea-techno-perc',
      type: 'idea',
      title: 'Add industrial percussion',
      description: 'Add metallic percussion or noise hits to intensify the techno feel.',
      command: 'plus agressif',
      priority: 0.5,
      category: 'groove',
    },
  ],
  dnb: [
    {
      id: 'idea-dnb-reese',
      type: 'idea',
      title: 'Add reese bass',
      description: 'Drum & bass benefits from a powerful sub bass with slight detuning.',
      command: 'generate bassline',
      priority: 0.6,
      category: 'sound',
    },
  ],
  trap: [
    {
      id: 'idea-trap-808',
      type: 'idea',
      title: 'Add 808 sub bass',
      description: 'Trap needs a punchy 808 sub bass that slides between notes.',
      command: 'generate bassline',
      priority: 0.6,
      category: 'sound',
    },
  ],
  hiphop: [
    {
      id: 'idea-hiphop-sample',
      type: 'idea',
      title: 'Humanize the drums',
      description: 'Classic hip-hop has a laid-back feel with slightly off-the-grid drum hits.',
      command: 'humanize',
      priority: 0.55,
      category: 'groove',
    },
  ],
}

const DEFAULT_IDEAS: AISuggestion[] = [
  {
    id: 'idea-default-groove',
    type: 'idea',
    title: 'Add tribal groove',
    description: 'Tribal percussion can add organic energy to your track.',
    command: 'ajoute groove tribe',
    priority: 0.45,
    category: 'groove',
  },
  {
    id: 'idea-default-dynamics',
    type: 'idea',
    title: 'Increase dynamic range',
    description: 'Your mix could benefit from more contrast between soft and loud moments.',
    command: 'plus de dynamique',
    priority: 0.4,
    category: 'mixing',
  },
]

let suggestionCounter = 0

function genId(): string {
  return `suggestion-${Date.now()}-${++suggestionCounter}`
}

class LiveSuggestionEngine {
  private intervalId: ReturnType<typeof setInterval> | null = null
  private subscribers: Array<(suggestions: AISuggestion[]) => void> = []

  /**
   * Start polling for suggestions every 5 seconds.
   */
  start(getSnapshot: () => ProjectSnapshot): void {
    if (this.intervalId !== null) return

    this.intervalId = setInterval(async () => {
      try {
        const snapshot = getSnapshot()
        const context = await musicContextEngine.buildContext(snapshot)
        const suggestions = this.generateSuggestions(context)
        this.subscribers.forEach(cb => cb(suggestions))
      } catch {
        // Silently ignore polling errors
      }
    }, 5000)
  }

  /**
   * Stop the polling interval.
   */
  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  /**
   * Subscribe to suggestion updates. Returns unsubscribe function.
   */
  onSuggestions(cb: (suggestions: AISuggestion[]) => void): () => void {
    this.subscribers.push(cb)
    return () => {
      this.subscribers = this.subscribers.filter(s => s !== cb)
    }
  }

  /**
   * Generate ranked suggestions from a MusicContext.
   */
  generateSuggestions(context: MusicContext): AISuggestion[] {
    const suggestions: AISuggestion[] = []

    // High kick/bass clash → sidechain suggestion (priority 0.9)
    if (context.kickBass.frequencyClashRisk === 'high') {
      suggestions.push({
        id: genId(),
        type: 'fix',
        title: 'Fix kick/bass frequency clash',
        description: context.kickBass.recommendation,
        command: 'fix kick bass',
        priority: 0.9,
        category: 'mixing',
      })
    }

    // Low headroom → clipping warning (priority 0.95)
    if (context.mix.headroomScore < 0.1) {
      suggestions.push({
        id: genId(),
        type: 'warning',
        title: 'Clipping risk detected',
        description: 'Average velocity is very high — risk of digital clipping. Reduce master level or individual track velocities.',
        command: 'plus de dynamique',
        priority: 0.95,
        category: 'mixing',
      })
    }

    // Low dynamic range → more dynamics (priority 0.85)
    if (context.arrangement.dynamicRange < 0.2) {
      suggestions.push({
        id: genId(),
        type: 'enhancement',
        title: 'Increase dynamic range',
        description: 'Your arrangement has little energy variation. Add buildups and breakdowns for more contrast.',
        command: 'plus de dynamique',
        priority: 0.85,
        category: 'arrangement',
      })
    }

    // No drop structure in electronic styles → suggest drop (priority 0.8)
    const electronicStyles: MusicStyle[] = ['house', 'techno', 'dnb']
    if (!context.arrangement.hasDropStructure && electronicStyles.includes(context.style.primaryStyle)) {
      suggestions.push({
        id: genId(),
        type: 'idea',
        title: 'Add a drop section',
        description: `${context.style.primaryStyle} tracks typically have a buildup → drop structure. Add one for more impact.`,
        command: 'add drop',
        priority: 0.8,
        category: 'arrangement',
      })
    }

    // Jazz without swing → humanize (priority 0.75)
    if (context.groove.swingAmount < 0.05 && context.style.primaryStyle === 'jazz') {
      suggestions.push({
        id: genId(),
        type: 'fix',
        title: 'Add swing feel',
        description: 'Jazz tracks need swing timing. Humanize to add natural timing deviations.',
        command: 'humanize',
        priority: 0.75,
        category: 'groove',
      })
    }

    // Few sections → suggest more structure (priority 0.6)
    if (context.arrangement.sections.length < 3) {
      suggestions.push({
        id: genId(),
        type: 'idea',
        title: 'Add more arrangement sections',
        description: 'Your track has few distinct sections. Consider adding intro, verse, chorus, or bridge sections.',
        command: 'add buildup',
        priority: 0.6,
        category: 'arrangement',
      })
    }

    // Style-specific creative ideas
    const styleIdeas = STYLE_IDEAS[context.style.primaryStyle] ?? DEFAULT_IDEAS
    for (const idea of styleIdeas.slice(0, 2)) {
      suggestions.push({ ...idea, id: genId() })
    }

    // If no style-specific ideas, add defaults
    if (styleIdeas.length === 0) {
      for (const idea of DEFAULT_IDEAS.slice(0, 2)) {
        suggestions.push({ ...idea, id: genId() })
      }
    }

    // Sort by priority descending, return top 6
    return suggestions
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 6)
  }
}

export const liveSuggestionEngine = new LiveSuggestionEngine()
