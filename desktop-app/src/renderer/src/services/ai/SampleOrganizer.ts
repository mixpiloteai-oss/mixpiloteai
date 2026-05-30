// ─── Sample Organizer ─────────────────────────────────────────────────────────
// Rule-based sample categorization and project organization suggestions.
// Zero network calls, zero model — pure string heuristics.

export type SampleCategory =
  | 'kick' | 'snare' | 'hihat' | 'clap' | 'percussion'
  | 'bass' | 'lead' | 'pad' | 'chord' | 'fx' | 'vocal'
  | 'loop' | 'oneshot' | 'unknown'

export interface SampleInfo {
  filename: string
  category: SampleCategory
  suggestedFolder: string
}

export interface OrganizationAdvice {
  categorized:   SampleInfo[]
  folderMap:     Record<string, string[]>   // suggestedFolder → filenames[]
  uncategorized: string[]
  suggestions:   string[]
}

// ── Category detection ────────────────────────────────────────────────────────

const PATTERNS: { pattern: RegExp; category: SampleCategory; folder: string }[] = [
  { pattern: /\bkick\b|kik\b|bd\b|bass.?drum/i,  category: 'kick',       folder: 'Drums/Kicks'     },
  { pattern: /\bsnare\b|snr\b|sd\b/i,            category: 'snare',      folder: 'Drums/Snares'    },
  { pattern: /\bhi.?hat\b|hh\b|cymbal\b/i,       category: 'hihat',      folder: 'Drums/HiHats'    },
  { pattern: /\bclap\b|clp\b/i,                  category: 'clap',       folder: 'Drums/Claps'     },
  { pattern: /\bperc\b|tom\b|rim\b|shaker\b/i,   category: 'percussion', folder: 'Drums/Percs'     },
  { pattern: /\bbass\b|sub\b/i,                  category: 'bass',       folder: 'Bass'            },
  { pattern: /\blead\b|arp\b|pluck\b|seq\b/i,    category: 'lead',       folder: 'Synths/Lead'     },
  { pattern: /\bpad\b|atmo\b|ambient\b|drone\b/i,category: 'pad',        folder: 'Synths/Pads'     },
  { pattern: /\bchord\b|stab\b|comping\b/i,      category: 'chord',      folder: 'Synths/Chords'   },
  { pattern: /\bvocal\b|voice\b|vox\b|spoken\b/i,category: 'vocal',      folder: 'Vocals'          },
  { pattern: /\bfx\b|riser\b|sweep\b|impact\b|transition\b/i,category:'fx',folder:'FX'            },
  { pattern: /loop/i,                            category: 'loop',       folder: 'Loops'           },
  { pattern: /one.?shot|hit\b/i,                 category: 'oneshot',    folder: 'OneShots'        },
]

export function categorizeSample(filename: string): SampleInfo {
  const base = filename.replace(/\.[^.]+$/, '')  // strip extension
  for (const rule of PATTERNS) {
    if (rule.pattern.test(base)) {
      return { filename, category: rule.category, suggestedFolder: rule.folder }
    }
  }
  return { filename, category: 'unknown', suggestedFolder: 'Misc' }
}

// ── Batch organizer ───────────────────────────────────────────────────────────

export function organizeSamples(filenames: string[]): OrganizationAdvice {
  const categorized: SampleInfo[]    = []
  const uncategorized: string[]      = []
  const folderMap: Record<string, string[]> = {}

  for (const fn of filenames) {
    const info = categorizeSample(fn)
    if (info.category === 'unknown') {
      uncategorized.push(fn)
    } else {
      categorized.push(info)
    }
    const folder = info.suggestedFolder
    if (!folderMap[folder]) folderMap[folder] = []
    folderMap[folder]!.push(fn)
  }

  const suggestions: string[] = []

  if (uncategorized.length > 3) {
    suggestions.push(`${uncategorized.length} samples couldn't be auto-categorized. Rename them with descriptive prefixes (kick_, bass_, lead_) for automatic sorting.`)
  }

  const kickCount = categorized.filter(s => s.category === 'kick').length
  if (kickCount > 8) {
    suggestions.push(`You have ${kickCount} kick samples. Audition and pick 1–2 favourites to keep your palette focused.`)
  }

  const hasLoop    = categorized.some(s => s.category === 'loop')
  const hasPercussion = categorized.some(s => ['kick','snare','hihat','clap','percussion'].includes(s.category))
  if (hasLoop && hasPercussion) {
    suggestions.push('You mix loops and one-shot drums. Keep them in separate folders to avoid accidentally layering doubled beats.')
  }

  const folders = Object.keys(folderMap).length
  if (folders > 8) {
    suggestions.push(`${folders} suggested folders detected. Use colour-coded groups in your browser to navigate faster.`)
  }

  return { categorized, folderMap, uncategorized, suggestions }
}

// ── Project organization advice ───────────────────────────────────────────────

export interface ProjectOrgAdvice {
  tips: string[]
}

export function adviseProjectOrganization(
  trackNames:    string[],
  totalPlugins:  number,
  sampleCount:   number,
): ProjectOrgAdvice {
  const tips: string[] = []

  const unnamed = trackNames.filter(n => /^track\s*\d+$/i.test(n))
  if (unnamed.length > 0) {
    tips.push(`${unnamed.length} track(s) have generic names. Rename each track after its role (e.g. Kick, Bass, Lead) for faster navigation.`)
  }

  if (totalPlugins > 20) {
    tips.push(`${totalPlugins} plugin instances active. Freeze CPU-heavy tracks (reverb, convolution) to reduce load.`)
  }

  if (sampleCount > 50) {
    tips.push(`${sampleCount} samples in use. Consolidate loops with the same tempo/key into a single folder to prevent duplicates.`)
  }

  if (trackNames.length > 16) {
    tips.push('More than 16 tracks detected. Group related tracks (all drum layers, all synths) into folders using your DAW\'s track groups.')
  }

  return { tips }
}
