// ─── CommandActionPlanner.ts ──────────────────────────────────────────────────
// Maps AdvancedParsedCommand → ActionPlan.

import type { AdvancedParsedCommand } from './AdvancedCommandParser'
import type { MusicContext } from './MusicContextEngine'
import type { TrackType } from './deep/AnalysisTypes'

export type ActionType =
  | 'generate_pattern'
  | 'modify_pattern'
  | 'apply_effect'
  | 'set_parameter'
  | 'add_automation'
  | 'restructure'
  | 'suggest_only'

export interface PlannedAction {
  type: ActionType
  params: Record<string, unknown>
  priority: number
}

export interface ActionPlan {
  actions: PlannedAction[]
  estimatedDuration: number  // ms
  affectedTracks: string[]
  description: string
}

class CommandActionPlanner {
  /**
   * Plan a set of actions from a parsed command and music context.
   */
  planActions(cmd: AdvancedParsedCommand, context: MusicContext): ActionPlan {
    switch (cmd.intent) {
      case 'acid_ramp':
        return this.planAcidRamp(cmd, context)
      case 'more_aggressive':
        return this.planMoreAggressive(cmd, context)
      case 'cleaner_bass':
        return this.planCleanerBass(cmd, context)
      case 'add_groove':
        return this.planAddGroove(cmd, context)
      case 'humanize':
        return this.planHumanize(cmd, context)
      case 'more_dynamics':
        return this.planMoreDynamics(cmd, context)
      case 'add_buildup':
        return this.planAddBuildup(cmd, context)
      case 'add_drop':
        return this.planAddDrop(cmd, context)
      case 'add_breakdown':
        return this.planAddBreakdown(cmd, context)
      case 'fix_kick_bass':
        return this.planFixKickBass(cmd, context)
      default:
        return this.planSuggestOnly(cmd, context)
    }
  }

  private planAcidRamp(cmd: AdvancedParsedCommand, context: MusicContext): ActionPlan {
    const bars = cmd.parameters.bars ?? 4
    return {
      actions: [
        {
          type: 'generate_pattern',
          params: {
            style: 'acid',
            bars,
            rootNote: 36,
            filterSweep: true,
            intensity: cmd.parameters.intensity ?? 0.7,
          },
          priority: 1,
        },
        {
          type: 'add_automation',
          params: { type: 'filter', from: 200, to: 8000, bars },
          priority: 2,
        },
        {
          type: 'add_automation',
          params: { type: 'resonance', shape: 'triangle', bars },
          priority: 3,
        },
      ],
      estimatedDuration: 500,
      affectedTracks: this.findTracksByType(context, 'bass'),
      description: `Generate ${bars}-bar acid 303-style bassline with filter sweep automation`,
    }
  }

  private planMoreAggressive(cmd: AdvancedParsedCommand, context: MusicContext): ActionPlan {
    void cmd
    return {
      actions: [
        {
          type: 'modify_pattern',
          params: { velocityDelta: 20, target: 'drum' },
          priority: 1,
        },
        {
          type: 'set_parameter',
          params: { param: 'saturation', value: 0.6, target: 'master' },
          priority: 2,
        },
        {
          type: 'set_parameter',
          params: { param: 'compression', ratio: 4, target: 'master' },
          priority: 3,
        },
      ],
      estimatedDuration: 300,
      affectedTracks: this.findTracksByType(context, 'drum'),
      description: 'Increase drum velocity by +20, add saturation and compression on master',
    }
  }

  private planCleanerBass(cmd: AdvancedParsedCommand, context: MusicContext): ActionPlan {
    void cmd
    const actions: PlannedAction[] = [
      {
        type: 'apply_effect',
        params: { effect: 'high_pass', frequency: 40, target: 'bass' },
        priority: 1,
      },
      {
        type: 'modify_pattern',
        params: { velocitySpread: -0.3, target: 'bass' },
        priority: 2,
      },
    ]

    if (context.kickBass.overlapRatio > 0.3) {
      actions.push({
        type: 'apply_effect',
        params: { effect: 'sidechain', trigger: 'kick', amount: 0.7 },
        priority: 3,
      })
    }

    return {
      actions,
      estimatedDuration: 400,
      affectedTracks: this.findTracksByType(context, 'bass'),
      description: 'Apply 40Hz high-pass on bass, reduce velocity spread' +
        (context.kickBass.overlapRatio > 0.3 ? ', add sidechain compression' : ''),
    }
  }

  private planAddGroove(cmd: AdvancedParsedCommand, context: MusicContext): ActionPlan {
    const style = cmd.parameters.style ?? 'tribal'
    return {
      actions: [
        {
          type: 'generate_pattern',
          params: { drumStyle: style, bars: cmd.parameters.bars ?? 4 },
          priority: 1,
        },
      ],
      estimatedDuration: 500,
      affectedTracks: this.findTracksByType(context, 'drum'),
      description: `Generate ${style} drum groove pattern`,
    }
  }

  private planHumanize(cmd: AdvancedParsedCommand, context: MusicContext): ActionPlan {
    void cmd
    return {
      actions: [
        {
          type: 'modify_pattern',
          params: {
            timingDeviation: 0.015,
            velocityVariance: 15,
            style: 'natural',
          },
          priority: 1,
        },
      ],
      estimatedDuration: 200,
      affectedTracks: context.project.tracks.map(t => t.id),
      description: 'Apply ±0.015 beat timing deviation and ±15 velocity variance for humanization',
    }
  }

  private planMoreDynamics(cmd: AdvancedParsedCommand, context: MusicContext): ActionPlan {
    void cmd
    return {
      actions: [
        {
          type: 'set_parameter',
          params: { param: 'limiter_threshold', value: -6, target: 'master' },
          priority: 1,
        },
        {
          type: 'modify_pattern',
          params: { velocityVariance: 25, target: 'drum' },
          priority: 2,
        },
      ],
      estimatedDuration: 300,
      affectedTracks: this.findTracksByType(context, 'drum'),
      description: 'Reduce master limiter threshold to -6dB, increase drum velocity variance',
    }
  }

  private planAddBuildup(cmd: AdvancedParsedCommand, context: MusicContext): ActionPlan {
    const bars = cmd.parameters.bars ?? 4
    void context
    return {
      actions: [
        {
          type: 'add_automation',
          params: { type: 'filter', from: 400, to: 18000, bars, shape: 'exponential' },
          priority: 1,
        },
        {
          type: 'restructure',
          params: { type: 'density_increase', bars, factor: 2 },
          priority: 2,
        },
        {
          type: 'generate_pattern',
          params: { type: 'snare_roll', bars: 1, subdivision: '32nd' },
          priority: 3,
        },
        {
          type: 'generate_pattern',
          params: { type: 'pitch_riser', bars },
          priority: 4,
        },
      ],
      estimatedDuration: 800,
      affectedTracks: context.project.tracks.map(t => t.id),
      description: `Build ${bars}-bar buildup with filter sweep, density increase, and snare roll`,
    }
  }

  private planAddDrop(cmd: AdvancedParsedCommand, context: MusicContext): ActionPlan {
    const bars = cmd.parameters.bars ?? 4
    return {
      actions: [
        {
          type: 'restructure',
          params: { type: 'drop', bars, silence: 1 },
          priority: 1,
        },
        {
          type: 'generate_pattern',
          params: { type: 'four_on_floor', bars, velocity: 127 },
          priority: 2,
        },
        {
          type: 'restructure',
          params: { type: 'remove_clips', trackTypes: ['pad', 'chord'] },
          priority: 3,
        },
      ],
      estimatedDuration: 600,
      affectedTracks: context.project.tracks.map(t => t.id),
      description: `Create ${bars}-bar drop with 1-beat silence, four-on-floor kick, remove pad/chord clips`,
    }
  }

  private planAddBreakdown(cmd: AdvancedParsedCommand, context: MusicContext): ActionPlan {
    void cmd
    return {
      actions: [
        {
          type: 'restructure',
          params: { type: 'remove_clips', trackTypes: ['drum'] },
          priority: 1,
        },
        {
          type: 'apply_effect',
          params: { effect: 'reverb', amount: 0.8, target: 'lead' },
          priority: 2,
        },
        {
          type: 'modify_pattern',
          params: { densityReduction: 0.75 },
          priority: 3,
        },
      ],
      estimatedDuration: 500,
      affectedTracks: context.project.tracks.map(t => t.id),
      description: 'Create breakdown: remove drums, add reverb to melody, reduce note density by 75%',
    }
  }

  private planFixKickBass(cmd: AdvancedParsedCommand, context: MusicContext): ActionPlan {
    void cmd
    const actions: PlannedAction[] = [
      {
        type: 'apply_effect',
        params: { effect: 'sidechain', trigger: 'kick', amount: 0.8, target: 'bass' },
        priority: 1,
      },
      {
        type: 'apply_effect',
        params: { effect: 'eq', band: 'sub', frequency: 80, cut: -3, target: 'bass' },
        priority: 2,
      },
    ]

    return {
      actions,
      estimatedDuration: 400,
      affectedTracks: [
        ...this.findTracksByType(context, 'kick' as TrackType),
        ...this.findTracksByType(context, 'bass'),
      ],
      description: `Fix kick/bass clash: apply sidechain (ratio: ${context.kickBass.overlapRatio.toFixed(2)}) and EQ sub cut`,
    }
  }

  private planSuggestOnly(cmd: AdvancedParsedCommand, _context: MusicContext): ActionPlan {
    return {
      actions: [
        {
          type: 'suggest_only',
          params: { intent: cmd.intent, rawText: cmd.rawText },
          priority: 1,
        },
      ],
      estimatedDuration: 100,
      affectedTracks: [],
      description: `Suggestion for: "${cmd.rawText}"`,
    }
  }

  private findTracksByType(context: MusicContext, type: TrackType): string[] {
    return context.project.tracks
      .filter(t => t.type === type)
      .map(t => t.id)
  }
}

export const commandActionPlanner = new CommandActionPlanner()
