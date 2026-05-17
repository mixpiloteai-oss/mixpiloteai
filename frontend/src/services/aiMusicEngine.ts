// ============================================================
// NEUROTEK AI — AI Music Production Engine
// Generative pattern algorithms for Mentalcore, Hardtek, etc.
// No external deps — pure algorithmic generation.
// ============================================================

import type { Genre, TrackType } from '../types';

export interface GeneratedNote {
  pitch: number;   // MIDI 21–108
  beat: number;    // start in beats (0-based)
  duration: number;
  velocity: number;
}

export interface GeneratedPattern {
  notes: GeneratedNote[];
  lengthBars: number;
  bpm: number;
  genre: Genre;
  trackType: TrackType;
  description: string;
}

export interface GeneratedProject {
  name: string;
  genre: Genre;
  bpm: number;
  patterns: Array<{ trackType: TrackType; pattern: GeneratedPattern }>;
  arrangement: Array<{ trackType: TrackType; clips: Array<{ startBar: number; durationBars: number }> }>;
}

// ── MIDI helpers ──────────────────────────────────────────────

function noteToMidi(name: string, octave: number): number {
  const notes: Record<string, number> = {
    C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4,
    F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9,
    'A#': 10, Bb: 10, B: 11,
  };
  return (octave + 1) * 12 + (notes[name] ?? 0);
}

function midiFromScale(degree: number, root: number, scale: number[]): number {
  const octaveShift = Math.floor(degree / scale.length);
  const idx = ((degree % scale.length) + scale.length) % scale.length;
  return root + scale[idx] + octaveShift * 12;
}

const SCALES = {
  phrygian:     [0, 1, 3, 5, 7, 8, 10],
  minor:        [0, 2, 3, 5, 7, 8, 10],
  dorian:       [0, 2, 3, 5, 7, 9, 10],
  chromatic:    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  pentatonicMin:[0, 3, 5, 7, 10],
  wholetone:    [0, 2, 4, 6, 8, 10],
  diminished:   [0, 2, 3, 5, 6, 8, 9, 11],
};

// ── Seeded RNG (deterministic) ────────────────────────────────

function createRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// ── Genre BPM ranges ──────────────────────────────────────────

const GENRE_BPM: Record<Genre, number> = {
  mentalcore:  210,
  hardtek:     170,
  tribe:       155,
  acidcore:    180,
  'hard-techno': 145,
  tekno:       145,
  industrial:  160,
  neurofunk:   175,
};

const GENRE_ROOT: Record<Genre, number> = {
  mentalcore:  noteToMidi('C', 2),
  hardtek:     noteToMidi('A', 2),
  tribe:       noteToMidi('D', 2),
  acidcore:    noteToMidi('F', 2),
  'hard-techno': noteToMidi('E', 2),
  tekno:       noteToMidi('G', 2),
  industrial:  noteToMidi('B', 1),
  neurofunk:   noteToMidi('C', 2),
};

const GENRE_SCALE: Record<Genre, keyof typeof SCALES> = {
  mentalcore:  'phrygian',
  hardtek:     'minor',
  tribe:       'dorian',
  acidcore:    'phrygian',
  'hard-techno': 'minor',
  tekno:       'dorian',
  industrial:  'diminished',
  neurofunk:   'dorian',
};

// ── Kick patterns ─────────────────────────────────────────────

const KICK_PATTERNS: Record<Genre, number[]> = {
  mentalcore:  [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5],
  hardtek:     [0, 1, 2, 3],
  tribe:       [0, 0.75, 1.5, 2.25, 3, 3.75],
  acidcore:    [0, 0.5, 1.5, 2, 2.5, 3.5],
  'hard-techno': [0, 1, 2, 3],
  tekno:       [0, 0.5, 1, 2, 2.5, 3],
  industrial:  [0, 0.25, 1.75, 2, 3.25, 3.5],
  neurofunk:   [0, 0.5, 1.5, 2.25, 3, 3.5],
};

// ── Generators ───────────────────────────────────────────────

function generateKick(genre: Genre, bars = 2, seed = 0): GeneratedPattern {
  const rng = createRng(seed);
  const bpm = GENRE_BPM[genre];
  const pattern = KICK_PATTERNS[genre] ?? [0, 1, 2, 3];
  const beatsPerBar = 4;
  const notes: GeneratedNote[] = [];

  for (let bar = 0; bar < bars; bar++) {
    const offset = bar * beatsPerBar;
    const patternVariant = bar > 0 && rng() < 0.2
      ? pattern.slice(0, -1)
      : pattern;

    for (const beat of patternVariant) {
      notes.push({
        pitch: noteToMidi('C', 1),
        beat: offset + beat,
        duration: 0.1,
        velocity: Math.round(100 + rng() * 27),
      });
    }
  }

  return { notes, lengthBars: bars, bpm, genre, trackType: 'kick', description: `${genre} kick pattern` };
}

function generateBass(genre: Genre, bars = 2, seed = 0): GeneratedPattern {
  const rng = createRng(seed + 1);
  const bpm = GENRE_BPM[genre];
  const root = GENRE_ROOT[genre];
  const scaleKey = GENRE_SCALE[genre];
  const scale = SCALES[scaleKey];
  const beatsPerBar = 4;
  const notes: GeneratedNote[] = [];

  const bassRhythms: Record<Genre, number[]> = {
    mentalcore:  [0, 0.5, 1, 2, 2.5, 3, 3.5],
    hardtek:     [0, 1, 2, 3],
    tribe:       [0, 0.75, 2, 2.75],
    acidcore:    [0, 0.25, 0.75, 1, 2, 2.5, 3.25],
    'hard-techno': [0, 1, 2, 3],
    tekno:       [0, 0.5, 2, 3],
    industrial:  [0, 0.5, 1.5, 2, 3.25],
    neurofunk:   [0, 0.5, 1, 1.75, 2.5, 3, 3.5],
  };
  const rhythm = bassRhythms[genre] ?? [0, 1, 2, 3];
  const bassNotes = [0, 0, 0, 2, 4, 5, 7];

  for (let bar = 0; bar < bars; bar++) {
    const offset = bar * beatsPerBar;
    for (const beat of rhythm) {
      const degree = bassNotes[Math.floor(rng() * bassNotes.length)];
      const pitch = midiFromScale(degree, root, scale);
      notes.push({ pitch, beat: offset + beat, duration: 0.2 + rng() * 0.3, velocity: Math.round(85 + rng() * 30) });
    }
  }

  return { notes, lengthBars: bars, bpm, genre, trackType: 'bass', description: `${genre} bass pattern` };
}

function generateMelody(genre: Genre, bars = 4, seed = 0): GeneratedPattern {
  const rng = createRng(seed + 2);
  const bpm = GENRE_BPM[genre];
  const root = GENRE_ROOT[genre] + 24;
  const scaleKey = GENRE_SCALE[genre];
  const scale = SCALES[scaleKey];
  const beatsPerBar = 4;
  const notes: GeneratedNote[] = [];
  const stepDurations = [0.25, 0.5, 0.75, 1.0];
  let beat = 0;
  let lastDegree = 0;
  const totalBeats = bars * beatsPerBar;

  while (beat < totalBeats) {
    const motion = rng() < 0.7
      ? (rng() < 0.5 ? 1 : -1)
      : Math.round(rng() * 7 - 3);
    lastDegree = Math.max(0, Math.min(scale.length * 3 - 1, lastDegree + motion));
    const pitch = midiFromScale(lastDegree, root, scale);
    const dur = stepDurations[Math.floor(rng() * stepDurations.length)];
    if (beat + dur > totalBeats) break;
    if (rng() > 0.15) {
      notes.push({ pitch, beat, duration: dur * 0.85, velocity: Math.round(70 + rng() * 40) });
    }
    beat += dur;
  }

  return { notes, lengthBars: bars, bpm, genre, trackType: 'melody', description: `${genre} melody` };
}

function generateAcidBass(genre: Genre, bars = 2, seed = 0): GeneratedPattern {
  const rng = createRng(seed + 3);
  const bpm = GENRE_BPM[genre];
  const root = GENRE_ROOT[genre];
  const scale = SCALES.phrygian;
  const beatsPerBar = 4;
  const notes: GeneratedNote[] = [];
  const totalBeats = bars * beatsPerBar;
  const step = 0.25;
  let beat = 0;
  let lastDegree = 0;

  while (beat < totalBeats) {
    if (rng() > 0.25) {
      const degree = rng() < 0.6 ? lastDegree : Math.floor(rng() * 8);
      lastDegree = degree;
      const pitch = midiFromScale(degree, root, scale);
      const accented = beat % 0.5 === 0 && rng() > 0.5;
      notes.push({
        pitch, beat,
        duration: rng() < 0.3 ? 0.5 : 0.2,
        velocity: accented ? Math.round(100 + rng() * 27) : Math.round(60 + rng() * 40),
      });
    }
    beat += step;
  }

  return { notes, lengthBars: bars, bpm, genre, trackType: 'acid', description: `${genre} acid riff` };
}

function generatePercussion(genre: Genre, bars = 2, seed = 0): GeneratedPattern {
  const rng = createRng(seed + 4);
  const bpm = GENRE_BPM[genre];
  const beatsPerBar = 4;
  const notes: GeneratedNote[] = [];
  const hihat = noteToMidi('F#', 3);
  const snare  = noteToMidi('A', 2);
  const clap   = noteToMidi('D', 3);
  const openHH = noteToMidi('A#', 3);

  for (let bar = 0; bar < bars; bar++) {
    const offset = bar * beatsPerBar;
    for (const snBeat of [1, 3]) {
      notes.push({ pitch: snare, beat: offset + snBeat, duration: 0.1, velocity: 100 });
    }
    if (rng() > 0.4) {
      notes.push({ pitch: clap, beat: offset + 1 + rng() * 0.5, duration: 0.1, velocity: 80 });
    }
    const hhBeats = genre === 'mentalcore'
      ? [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75]
      : [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5];
    for (const b of hhBeats) {
      if (rng() > 0.15) {
        const isOpen = rng() > 0.85;
        notes.push({ pitch: isOpen ? openHH : hihat, beat: offset + b, duration: isOpen ? 0.3 : 0.1, velocity: Math.round(50 + rng() * 50) });
      }
    }
  }

  notes.sort((a, b) => a.beat - b.beat);
  return { notes, lengthBars: bars, bpm, genre, trackType: 'percussion', description: `${genre} percussion` };
}

function generatePad(genre: Genre, bars = 4, seed = 0): GeneratedPattern {
  const rng = createRng(seed + 5);
  const bpm = GENRE_BPM[genre];
  const root = GENRE_ROOT[genre] + 12;
  const scaleKey = GENRE_SCALE[genre];
  const scale = SCALES[scaleKey];
  const notes: GeneratedNote[] = [];
  const chordIntervals = [0, 2, 4];
  const chordChanges = [0, 2, 4, 6];

  for (const changeBar of chordChanges) {
    if (changeBar >= bars) break;
    const chordRoot = Math.floor(rng() * 3);
    const chordDur  = 2 * 4;
    for (const interval of chordIntervals) {
      const pitch = midiFromScale(chordRoot + interval, root, scale);
      notes.push({ pitch, beat: changeBar * 4, duration: chordDur - 0.1, velocity: Math.round(55 + rng() * 30) });
    }
  }

  return { notes, lengthBars: bars, bpm, genre, trackType: 'pad', description: `${genre} pad` };
}

// ── Arrangement builder ──────────────────────────────────────

function buildArrangement(genre: Genre): GeneratedProject['arrangement'] {
  const rng = createRng(Date.now() % 9999);
  const sections = [
    { label: 'intro',  bars: 8  },
    { label: 'build',  bars: 8  },
    { label: 'drop1',  bars: 16 },
    { label: 'break',  bars: 8  },
    { label: 'drop2',  bars: 16 },
    { label: 'outro',  bars: 8  },
  ];

  let currentBar = 0;
  const kickClips:   Array<{ startBar: number; durationBars: number }> = [];
  const bassClips:   Array<{ startBar: number; durationBars: number }> = [];
  const melodyClips: Array<{ startBar: number; durationBars: number }> = [];
  const percClips:   Array<{ startBar: number; durationBars: number }> = [];
  const padClips:    Array<{ startBar: number; durationBars: number }> = [];
  const acidClips:   Array<{ startBar: number; durationBars: number }> = [];

  for (const section of sections) {
    const { label, bars } = section;
    if (label !== 'intro') kickClips.push({ startBar: currentBar, durationBars: bars });
    if (label === 'drop1' || label === 'drop2' || label === 'build') {
      bassClips.push({ startBar: currentBar, durationBars: bars });
      percClips.push({ startBar: currentBar, durationBars: bars });
    }
    if (label === 'drop1' || label === 'drop2') {
      if (rng() > 0.3) melodyClips.push({ startBar: currentBar, durationBars: bars });
      if (genre === 'acidcore' || genre === 'tribe') acidClips.push({ startBar: currentBar, durationBars: bars });
    }
    if (label === 'build' || label === 'break') padClips.push({ startBar: currentBar, durationBars: bars });
    currentBar += bars;
  }

  return [
    { trackType: 'kick',       clips: kickClips },
    { trackType: 'bass',       clips: bassClips },
    { trackType: 'percussion', clips: percClips },
    { trackType: 'melody',     clips: melodyClips },
    { trackType: 'pad',        clips: padClips },
    { trackType: 'acid',       clips: acidClips },
  ];
}

// ── Public API ────────────────────────────────────────────────

export function generatePatternForTrack(
  trackType: TrackType,
  genre: Genre,
  bars = 2,
  seed?: number,
): GeneratedPattern {
  const s = seed ?? Date.now() % 100000;
  switch (trackType) {
    case 'kick':       return generateKick(genre, bars, s);
    case 'bass':       return generateBass(genre, bars, s);
    case 'melody':     return generateMelody(genre, bars, s);
    case 'acid':       return generateAcidBass(genre, bars, s);
    case 'percussion': return generatePercussion(genre, bars, s);
    case 'pad':        return generatePad(genre, bars, s);
    default:           return generateMelody(genre, bars, s);
  }
}

export function generateFullProject(genre: Genre, seed?: number): GeneratedProject {
  const s = seed ?? Date.now() % 100000;
  const bpm = GENRE_BPM[genre];
  const trackTypes: TrackType[] = ['kick', 'bass', 'percussion', 'melody', 'pad', 'acid'];
  const patterns = trackTypes.map((trackType) => ({
    trackType,
    pattern: generatePatternForTrack(trackType, genre, 4, s),
  }));
  const arrangement = buildArrangement(genre);
  return {
    name: `${genre.charAt(0).toUpperCase() + genre.slice(1)} Project`,
    genre, bpm, patterns, arrangement,
  };
}

export function suggestBpmForGenre(genre: Genre): number {
  return GENRE_BPM[genre];
}

export function getSupportedGenres(): Genre[] {
  return ['mentalcore', 'hardtek', 'tribe', 'acidcore', 'hard-techno', 'tekno', 'industrial', 'neurofunk'];
}

export function getGenreDescription(genre: Genre): string {
  const descriptions: Record<Genre, string> = {
    mentalcore:    'Ultra-fast mental breakcore with relentless kick patterns and chaotic rhythms',
    hardtek:       'Raw tekno with distorted kicks and underground energy',
    tribe:         'Hypnotic tribal grooves with dense percussion and bass',
    acidcore:      'Ferocious acid lines over a wall of kicks — pure energy',
    'hard-techno': 'Dark industrial techno with heavy compression and drive',
    tekno:         'Free party tekno — repetitive, hypnotic, communal',
    industrial:    'Cold, mechanical rhythms with dissonant textures',
    neurofunk:     'Futuristic bass music with warped neuro sounds',
  };
  return descriptions[genre] ?? genre;
}
