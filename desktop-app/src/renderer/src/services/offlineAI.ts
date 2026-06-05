// ─── Offline AI — Lightweight local heuristics ───────────────────────────────
// Used when the network is unavailable.  No model, no network calls.
// All outputs are deterministic rule-based suggestions.

// ─── Chord progressions ───────────────────────────────────────────────────────

const PROGRESSIONS: Record<string, number[][]> = {
  hardtek:   [[0,4,7],[5,9,12],[7,11,14],[3,7,10]],
  techno:    [[0,3,7],[5,8,12],[7,10,14],[2,5,9]],
  industrial:[[0,3,6],[5,8,11],[7,10,13],[2,5,8]],
  trap:      [[0,3,7],[5,8,12],[0,3,7],[7,10,14]],
  lofi:      [[0,4,7,11],[5,9,12,16],[7,11,14,17],[2,5,9,12]],
  ambient:   [[0,4,7,11],[5,9,12,16],[9,12,16,19],[7,11,14,17]],
  default:   [[0,4,7],[5,9,12],[7,11,14],[3,7,10]],
}

function detectGenre(text: string): string {
  const t = text.toLowerCase()
  if (/hardtek|acidtek|hardcore/.test(t))  return 'hardtek'
  if (/techno|industrial|dark/.test(t))    return 'industrial'
  if (/trap|drill|hip.?hop/.test(t))       return 'trap'
  if (/lofi|lo.?fi|chill/.test(t))         return 'lofi'
  if (/ambient|pad|drone/.test(t))         return 'ambient'
  if (/techno/.test(t))                    return 'techno'
  return 'default'
}

export function suggestProgression(context: string): { semitones: number[][]; label: string } {
  const genre = detectGenre(context)
  return { semitones: PROGRESSIONS[genre]!, label: genre }
}

// ─── BPM ranges ───────────────────────────────────────────────────────────────

const BPM_RANGES: Record<string, { min: number; max: number; typical: number }> = {
  hardtek:    { min: 160, max: 200, typical: 185 },
  techno:     { min: 130, max: 150, typical: 140 },
  industrial: { min: 125, max: 145, typical: 135 },
  trap:       { min: 120, max: 145, typical: 135 },
  lofi:       { min: 70,  max: 95,  typical: 85  },
  ambient:    { min: 60,  max: 100, typical: 80  },
  hiphop:     { min: 80,  max: 100, typical: 90  },
  house:      { min: 120, max: 130, typical: 125 },
  dnb:        { min: 165, max: 180, typical: 174 },
  default:    { min: 120, max: 145, typical: 130 },
}

export function suggestBPM(context: string): { min: number; max: number; typical: number } {
  const genre = detectGenre(context)
  return BPM_RANGES[genre] ?? BPM_RANGES.default!
}

// ─── Mix tips ─────────────────────────────────────────────────────────────────

const MIX_TIPS: Record<string, string[]> = {
  kick: [
    'High-pass at 40 Hz to remove rumble, boost punch around 80–100 Hz.',
    'Side-chain compress pads and bass to the kick for groove and clarity.',
    'Transient shaper: fast attack to clip the initial hit, slow release for body.',
  ],
  bass: [
    'Keep fundamentals below 80 Hz; cut harsh sub resonances around 50–60 Hz.',
    'Parallel compress: blend dry + compressed signal for punch without killing dynamics.',
    'Use a high-shelf cut above 600 Hz if the bass is fighting the mid range.',
  ],
  vocals: [
    'De-ess with a dynamic EQ around 6–10 kHz, not a static cut.',
    'Reverb pre-delay of 20–40 ms separates the dry signal from the tail.',
    'Automate gain riding before compression to control peaks naturally.',
  ],
  synth: [
    'Stereo-narrow below 200 Hz to keep low mids mono and clean in the mix.',
    'Filter automation: high-pass sweep up on risers, low-pass sweep down on drops.',
    'Short room reverb (15–25 ms) adds depth without washing out transients.',
  ],
  general: [
    'Reference your mix on multiple playback systems (headphones, car, phone speaker).',
    'Take regular breaks — ears fatigue quickly; fresh ears catch more issues.',
    'Compare your mix at low volume (60–70 dB SPL); the balance should still read.',
  ],
}

export function getMixTip(context: string): string {
  const t = context.toLowerCase()
  let tips = MIX_TIPS.general!
  if (/kick|drum|percussion/.test(t)) tips = MIX_TIPS.kick!
  else if (/bass|sub/.test(t))        tips = MIX_TIPS.bass!
  else if (/vocal|voice|sing/.test(t)) tips = MIX_TIPS.vocals!
  else if (/synth|pad|lead/.test(t))  tips = MIX_TIPS.synth!
  return tips[Math.floor(Math.random() * tips.length)]!
}

// ─── Melody / pattern seed ────────────────────────────────────────────────────

/** Generate a simple melody seed using a scale pattern. Returns MIDI note offsets. */
export function generateMelodySeed(
  rootMidi: number,
  bars = 4,
  density: 'sparse' | 'medium' | 'dense' = 'medium',
): { pitch: number; beat: number; duration: number; velocity: number }[] {
  const scale  = [0, 2, 4, 7, 9]   // pentatonic major
  const stepsPerBar = density === 'sparse' ? 2 : density === 'medium' ? 4 : 8
  const notes: { pitch: number; beat: number; duration: number; velocity: number }[] = []
  let beat = 0
  for (let b = 0; b < bars; b++) {
    for (let s = 0; s < stepsPerBar; s++) {
      const deg      = scale[Math.floor(Math.sin(beat * 0.7 + b) * 2.5 + 2.5) % scale.length]!
      const octave   = Math.floor(Math.sin(beat * 0.3) + 1)
      const pitch    = rootMidi + deg + octave * 12
      const duration = density === 'dense' ? 0.25 : 0.5
      const velocity = Math.round(80 + Math.sin(beat * 1.3) * 20)
      notes.push({ pitch: Math.min(127, Math.max(0, pitch)), beat, duration, velocity })
      beat += 4 / stepsPerBar
    }
  }
  return notes
}

// ─── Offline AI response formatter ───────────────────────────────────────────

export interface OfflineAIResponse {
  text:    string
  offline: true
}

/** Generate a best-effort offline AI response for common DAW queries. */
export function offlineAIChat(message: string): OfflineAIResponse {
  const m = message.toLowerCase()

  if (/chord|progression/.test(m)) {
    const prog = suggestProgression(message)
    return {
      text: `[Offline] Suggested chord progression for ${prog.label}: the intervals are ${prog.semitones.map(c => c.join('-')).join(', ')}. Start on your root note and space each chord 2–4 beats apart for groove.`,
      offline: true,
    }
  }

  if (/bpm|tempo/.test(m)) {
    const bpm = suggestBPM(message)
    return {
      text: `[Offline] For this style, typical BPM range is ${bpm.min}–${bpm.max} (most common: ${bpm.typical} BPM). Set your transport and feel free to experiment within this range.`,
      offline: true,
    }
  }

  if (/mix|eq|compress|reverb|effect/.test(m)) {
    return {
      text: `[Offline] Mix tip: ${getMixTip(message)}`,
      offline: true,
    }
  }

  return {
    text: '[Offline] AI features require an internet connection. Your project is saved locally — all DAW tools (piano roll, mixer, MIDI, VST, export) work without the network. Reconnect to access full AI assistance.',
    offline: true,
  }
}
