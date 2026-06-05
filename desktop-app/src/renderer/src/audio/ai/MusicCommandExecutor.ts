// ─── MusicCommandExecutor ────────────────────────────────────────────────────
// Executes parsed commands on the project. Returns a structured result.

import type { MidiNote } from '../../types/project'
import type { ParsedCommand } from './CommandParser'
import type { ProjectAnalysis } from './MusicAnalyzer'
import {
  generateKickPattern,
  generateBassPattern,
  generateHihatPattern,
  generateBuildup,
  generateDrop,
  generateHardtekKick,
  generateHardtekBass,
  generateHardtekHihat,
  generateHardtekFull,
} from './PatternGenerator'

export interface ExecutionResult {
  success:     boolean
  message:     string           // human-readable description (FR)
  changes:     CommandChange[]
  warnings:    string[]
  /** MIDI notes produced by this result, if any. */
  notes?:      MidiNote[]
  /** Logical pattern type: 'kick' | 'bass' | 'hihat' | 'buildup' | 'drop' etc. */
  patternType?: string
  /** Suggested track name for insertion. */
  trackName?:  string
}

export interface CommandChange {
  type:     'add_clip' | 'add_notes' | 'modify_notes' | 'set_bpm' | 'set_key' | 'no_op'
  trackId?: string
  clipId?:  string
  detail:   string
}

/**
 * Apply deterministic humanization to notes.
 * Uses sin-based sequence — no Math.random().
 * amount: 0.0–1.0
 */
export function applyHumanization(notes: MidiNote[], amount: number): MidiNote[] {
  return notes.map((note, i) => {
    const timingOffset = Math.sin(i * 2.39996) * amount * 0.125
    const velocityDelta = Math.round(Math.sin(i * 1.61803) * amount * 15)

    const newStartBeat = Math.max(0, note.startBeat + timingOffset)
    const newVelocity  = Math.max(1, Math.min(127, note.velocity + velocityDelta))

    return { ...note, startBeat: newStartBeat, velocity: newVelocity }
  })
}

/**
 * Execute a parsed command against the current project analysis.
 * Returns a structured result describing what should be done.
 * Does NOT mutate state directly.
 */
/**
 * Handle hardtek/mentalcore-specific pattern commands.
 * Detected by raw text keyword match before the main intent switch.
 */
export function executeHardtekCommand(
  raw: string,
  analysis: ProjectAnalysis,
): ExecutionResult | null {
  const t    = raw.toLowerCase()
  const bars = analysis.loopLength > 0 ? Math.min(4, analysis.loopLength) : 4

  // Detect subtype: kick / bass / hihat / full (default)
  let pattern
  let patternType: string
  let trackName: string

  if (/(kick|grosse caisse)/.test(t)) {
    pattern     = generateHardtekKick(bars)
    patternType = 'kick'
    trackName   = 'AI Hardtek Kick'
  } else if (/(bass|basse)/.test(t)) {
    pattern     = generateHardtekBass(bars)
    patternType = 'bass'
    trackName   = 'AI Hardtek Bass'
  } else if (/(hat|hihat|cymbale)/.test(t)) {
    pattern     = generateHardtekHihat(bars)
    patternType = 'hihat'
    trackName   = 'AI Hardtek Hihat'
  } else {
    pattern     = generateHardtekFull(bars)
    patternType = 'full'
    trackName   = 'AI Hardtek Full'
  }

  const midiNotes: MidiNote[] = pattern.notes.map((n, i) => ({
    id:          `ai-note-${Date.now()}-${i}`,
    pitch:       n.pitch,
    startBeat:   n.startBeat,
    lengthBeats: n.lengthBeats,
    velocity:    n.velocity,
  }))

  return {
    success:     true,
    message:     `Pattern hardtek "${pattern.name}" généré avec ${pattern.notes.length} notes sur ${bars} bars. Style: 160+ BPM, kicks accentués, basse distorsée.`,
    changes:     [{ type: 'add_notes', detail: `${pattern.notes.length} notes — ${pattern.name}` }],
    warnings:    [],
    notes:       midiNotes,
    patternType,
    trackName,
  }
}

export function executeCommand(cmd: ParsedCommand, analysis: ProjectAnalysis): ExecutionResult {
  const changes:  CommandChange[] = []
  const warnings: string[]        = []

  // Hardtek / mentalcore: check raw text before standard intent dispatch
  const rawLower = cmd.raw.toLowerCase()
  if (/(hardtek|hard tek|mentalcore|mental core|hard core hardcore)/.test(rawLower)) {
    const result = executeHardtekCommand(cmd.raw, analysis)
    if (result) return result
  }

  switch (cmd.intent) {
    case 'generate_pattern': {
      const target = cmd.target === 'unknown' ? 'kick' : cmd.target
      const style  = cmd.style === 'unknown' ? 'techno' : cmd.style
      const bars   = analysis.loopLength > 0 ? Math.min(4, analysis.loopLength) : 4

      let pattern
      if (target === 'kick') {
        pattern = generateKickPattern(style, bars)
      } else if (target === 'bass') {
        pattern = generateBassPattern(style, bars)
      } else if (target === 'hihat') {
        pattern = generateHihatPattern(style, bars)
      } else {
        pattern = generateKickPattern(style, bars)
        warnings.push(`Cible "${target}" non reconnue, génération d'un kick par défaut.`)
      }

      // Convert GeneratedNote[] → MidiNote[] for project insertion
      const midiNotes: MidiNote[] = pattern.notes.map((n, i) => ({
        id:          `ai-note-${Date.now()}-${i}`,
        pitch:       n.pitch,
        startBeat:   n.startBeat,
        lengthBeats: n.lengthBeats,
        velocity:    n.velocity,
      }))

      changes.push({
        type:   'add_notes',
        detail: `Généré ${pattern.notes.length} notes — pattern "${pattern.name}" (${bars} bars)`,
      })

      return {
        success:     true,
        message:     `Pattern ${pattern.name} généré avec ${pattern.notes.length} notes en style ${style}.`,
        changes,
        warnings,
        notes:       midiNotes,
        patternType: target,
        trackName:   `AI ${target.charAt(0).toUpperCase() + target.slice(1)}`,
      }
    }

    case 'add_buildup': {
      const bars    = analysis.loopLength > 0 ? Math.min(4, analysis.loopLength) : 4
      const pattern = generateBuildup(bars)

      const midiNotes: MidiNote[] = pattern.notes.map((n, i) => ({
        id:          `ai-note-${Date.now()}-${i}`,
        pitch:       n.pitch,
        startBeat:   n.startBeat,
        lengthBeats: n.lengthBeats,
        velocity:    n.velocity,
      }))

      changes.push({
        type:   'add_notes',
        detail: `Montée générée: ${pattern.notes.length} notes sur ${bars} bars`,
      })

      return {
        success:     true,
        message:     `Montée générée sur ${bars} bars avec crescendo de vélocité 60→127.`,
        changes,
        warnings,
        notes:       midiNotes,
        patternType: 'buildup',
        trackName:   'AI Buildup',
      }
    }

    case 'add_drop': {
      const bars    = analysis.loopLength > 0 ? Math.min(4, analysis.loopLength) : 4
      const pattern = generateDrop(bars)

      const midiNotes: MidiNote[] = pattern.notes.map((n, i) => ({
        id:          `ai-note-${Date.now()}-${i}`,
        pitch:       n.pitch,
        startBeat:   n.startBeat,
        lengthBeats: n.lengthBeats,
        velocity:    n.velocity,
      }))

      changes.push({
        type:   'add_notes',
        detail: `Drop généré: ${pattern.notes.length} notes sur ${bars} bars`,
      })

      return {
        success:     true,
        message:     `Drop généré: silence en bar 1 puis kicks à pleine vélocité sur ${bars - 1} bars.`,
        changes,
        warnings,
        notes:       midiNotes,
        patternType: 'drop',
        trackName:   'AI Drop',
      }
    }

    case 'humanize': {
      const amount  = 0.7  // 70% humanization
      const target  = cmd.target !== 'unknown' ? cmd.target : 'all'

      changes.push({
        type:   'modify_notes',
        detail: `Humanisation (${Math.round(amount * 100)}%) sur ${target}: décalage timing ±${(amount * 0.125 * 480).toFixed(0)} ticks, vélocité ±${Math.round(amount * 15)}`,
      })

      return {
        success: true,
        message: `Humanisation appliquée sur ${target}: timing et vélocité légèrement variés pour un rendu plus naturel.`,
        changes,
        warnings,
      }
    }

    case 'modify_pattern': {
      const target = cmd.target !== 'unknown' ? cmd.target : 'all'

      if (cmd.direction === 'increase' && cmd.style === 'aggressive') {
        changes.push({
          type:   'modify_notes',
          detail: `Vélocité +15, durée -25% sur ${target}`,
        })
        return {
          success: true,
          message: `Pattern ${target} rendu plus agressif: vélocité augmentée de 15, notes raccourcies de 25%.`,
          changes,
          warnings,
        }
      }

      if (cmd.direction === 'increase') {
        changes.push({ type: 'modify_notes', detail: `Vélocité +10 sur ${target}` })
        return {
          success: true,
          message: `Pattern ${target} rendu plus fort: vélocité augmentée de 10.`,
          changes, warnings,
        }
      }

      if (cmd.direction === 'decrease') {
        changes.push({ type: 'modify_notes', detail: `Vélocité -10 sur ${target}` })
        return {
          success: true,
          message: `Pattern ${target} rendu plus doux: vélocité réduite de 10.`,
          changes, warnings,
        }
      }

      changes.push({ type: 'no_op', detail: 'Direction non détectée' })
      return {
        success: false,
        message: `Modification non précise: indiquez "plus" ou "moins" pour modifier le pattern.`,
        changes, warnings,
      }
    }

    case 'set_bpm': {
      if (cmd.value !== null && cmd.value >= 40 && cmd.value <= 300) {
        changes.push({ type: 'set_bpm', detail: `BPM → ${cmd.value}` })
        return {
          success: true,
          message: `Tempo réglé à ${cmd.value} BPM.`,
          changes, warnings,
        }
      }

      return {
        success: false,
        message: `BPM non reconnu. Précisez une valeur entre 40 et 300 (ex: "mets le bpm à 128").`,
        changes: [{ type: 'no_op', detail: 'Valeur BPM manquante ou hors limites' }],
        warnings,
      }
    }

    case 'transpose': {
      const interval = cmd.value ?? 12
      const dir      = cmd.direction === 'decrease' ? -1 : 1
      const semitones = dir * interval

      changes.push({ type: 'modify_notes', detail: `Transpose ${semitones > 0 ? '+' : ''}${semitones} demi-tons` })

      return {
        success: true,
        message: `Transposition de ${semitones > 0 ? '+' : ''}${semitones} demi-tons appliquée.`,
        changes, warnings,
      }
    }

    case 'set_key': {
      changes.push({ type: 'set_key', detail: `Tonalité: ${cmd.raw}` })
      return {
        success: true,
        message: `Tonalité mise à jour d'après la commande. Vérifiez les notes pour la cohérence harmonique.`,
        changes, warnings,
      }
    }

    case 'add_chord': {
      const key = analysis.detectedKey ? analysis.detectedKey.name : 'inconnue'
      changes.push({ type: 'add_notes', detail: `Accord ajouté en ${key}` })
      return {
        success: true,
        message: `Accord généré dans la tonalité ${key}.`,
        changes, warnings,
      }
    }

    case 'analyze': {
      const key     = analysis.detectedKey ? analysis.detectedKey.name : 'indéterminée'
      const energy  = (analysis.energy * 100).toFixed(0)
      changes.push({ type: 'no_op', detail: 'Analyse affichée' })
      return {
        success: true,
        message: `Analyse: ${analysis.bpm} BPM, tonalité ${key}, style ${analysis.style}, énergie ${energy}%. ${analysis.activeTracks} pistes actives, ${analysis.totalNotes} notes au total.`,
        changes, warnings,
      }
    }

    case 'unknown':
    default: {
      return {
        success: false,
        message: `Commande non reconnue. Essayez: "fais un kick tribe", "humanize les hats", "ajoute une montée", ou "analyse le projet".`,
        changes: [{ type: 'no_op', detail: 'Intent inconnu' }],
        warnings: [`Commande "${cmd.raw}" non comprise.`],
      }
    }
  }
}
