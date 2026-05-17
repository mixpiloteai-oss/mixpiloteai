// ============================================================
// NEUROTEK AI — Mock Data
// ============================================================
import type {
  Project,
  Track,
  Template,
  ChatMessage,
  MixAnalysis,
  LiveSession,
  PadCell,
  Scene,
  TemplateTrack,
  RoutingNode,
} from '../types';

function genWaveform(length = 64): number[] {
  return Array.from({ length }, () => Math.random() * 0.8 + 0.1);
}

const mentalcoreTracks: Track[] = [
  {
    id: 't1', name: 'KICK MASTER', type: 'kick', genre: 'mentalcore', mood: 'aggressive',
    volume: 110, pan: 0, muted: false, soloed: false, color: '#ef4444', bpm: 200, key: 'C',
    duration: 0, createdAt: '2024-11-10T14:32:00Z', tags: ['kick', 'mentalcore'],
    fx: [
      { id: 'fx-t1-1', name: 'Transient Shaper', type: 'compressor', enabled: true, params: { attack: 0, sustain: -6 } },
      { id: 'fx-t1-2', name: 'Distortion', type: 'distortion', enabled: true, params: { drive: 75, mix: 0.4 } },
    ],
    waveformData: genWaveform(), clipCount: 32, order: 0,
  },
  {
    id: 't2', name: 'MENTAL BASS', type: 'bass', genre: 'mentalcore', mood: 'aggressive',
    volume: 100, pan: 0, muted: false, soloed: false, color: '#f59e0b', bpm: 200, key: 'C',
    duration: 0, createdAt: '2024-11-10T14:32:00Z', tags: ['bass', 'mentalcore'],
    fx: [
      { id: 'fx-t2-1', name: 'OTT Compressor', type: 'compressor', enabled: true, params: { depth: 0.8, time: 0.3 } },
      { id: 'fx-t2-2', name: 'Saturator', type: 'distortion', enabled: true, params: { drive: 40 } },
      { id: 'fx-t2-3', name: 'Sub Boost EQ', type: 'eq', enabled: true, params: { freq: 60, gain: 4 } },
    ],
    waveformData: genWaveform(), clipCount: 16, order: 1,
  },
  {
    id: 't3', name: 'ACID LEAD', type: 'acid', genre: 'mentalcore', mood: 'psychedelic',
    volume: 85, pan: -10, muted: false, soloed: false, color: '#06b6d4', bpm: 200, key: 'C',
    duration: 0, createdAt: '2024-11-10T14:32:00Z', tags: ['acid', 'mentalcore'],
    fx: [
      { id: 'fx-t3-1', name: 'Filter LFO', type: 'filter', enabled: true, params: { cutoff: 2000, resonance: 0.8, rate: 4 } },
      { id: 'fx-t3-2', name: 'Delay', type: 'delay', enabled: true, params: { time: '1/8', feedback: 0.3, mix: 0.25 } },
    ],
    waveformData: genWaveform(), clipCount: 8, order: 2,
  },
  {
    id: 't4', name: 'PSYCH FX', type: 'fx', genre: 'mentalcore', mood: 'psychedelic',
    volume: 70, pan: 20, muted: false, soloed: false, color: '#10b981', bpm: 200, key: 'C',
    duration: 0, createdAt: '2024-11-10T14:32:00Z', tags: ['fx', 'reverb'],
    fx: [
      { id: 'fx-t4-1', name: 'Reverb Space', type: 'reverb', enabled: true, params: { size: 0.9, damp: 0.4, mix: 0.5 } },
    ],
    waveformData: genWaveform(), clipCount: 4, order: 3,
  },
  {
    id: 't5', name: 'HI-HAT ROLL', type: 'percussion', genre: 'mentalcore', mood: 'aggressive',
    volume: 80, pan: 15, muted: false, soloed: false, color: '#ec4899', bpm: 200, key: 'C',
    duration: 0, createdAt: '2024-11-10T14:32:00Z', tags: ['hihat', 'percussion'],
    fx: [], waveformData: genWaveform(), clipCount: 64, order: 4,
  },
  {
    id: 't6', name: 'MASTER BUS', type: 'master', genre: 'mentalcore', mood: 'aggressive',
    volume: 100, pan: 0, muted: false, soloed: false, color: '#7c3aed', bpm: 200, key: 'C',
    duration: 0, createdAt: '2024-11-10T14:32:00Z', tags: ['master'],
    fx: [
      { id: 'fx-t6-1', name: 'Multiband Comp', type: 'compressor', enabled: true, params: { threshold: -6, ratio: 4 } },
      { id: 'fx-t6-2', name: 'Limiter', type: 'limiter', enabled: true, params: { ceiling: -0.3, release: 50 } },
    ],
    waveformData: genWaveform(), clipCount: 1, order: 5,
  },
];

const hardtekTracks: Track[] = [
  {
    id: 'h1', name: 'TEK KICK', type: 'kick', genre: 'hardtek', mood: 'aggressive',
    volume: 115, pan: 0, muted: false, soloed: false, color: '#ef4444', bpm: 145, key: 'C',
    duration: 0, createdAt: '2024-11-08T10:00:00Z', tags: ['kick', 'hardtek'],
    fx: [
      { id: 'fx-h1-1', name: 'Clipper', type: 'distortion', enabled: true, params: { ceiling: 0.9 } },
      { id: 'fx-h1-2', name: 'Sub EQ', type: 'eq', enabled: true, params: { freq: 55, gain: 6, q: 0.7 } },
    ],
    waveformData: genWaveform(), clipCount: 32, order: 0,
  },
  {
    id: 'h2', name: 'HARDTEK BASS', type: 'bass', genre: 'hardtek', mood: 'aggressive',
    volume: 95, pan: 0, muted: false, soloed: false, color: '#f59e0b', bpm: 145, key: 'C',
    duration: 0, createdAt: '2024-11-08T10:00:00Z', tags: ['bass', 'hardtek'],
    fx: [
      { id: 'fx-h2-1', name: 'Distortion', type: 'distortion', enabled: true, params: { drive: 60 } },
    ],
    waveformData: genWaveform(), clipCount: 16, order: 1,
  },
  {
    id: 'h3', name: 'TEK LEAD', type: 'melody', genre: 'hardtek', mood: 'dark',
    volume: 80, pan: -5, muted: false, soloed: false, color: '#06b6d4', bpm: 145, key: 'C',
    duration: 0, createdAt: '2024-11-08T10:00:00Z', tags: ['melody', 'hardtek'],
    fx: [
      { id: 'fx-h3-1', name: 'Delay', type: 'delay', enabled: true, params: { time: '1/4', feedback: 0.4 } },
    ],
    waveformData: genWaveform(), clipCount: 8, order: 2,
  },
  {
    id: 'h4', name: 'PERC LOOP', type: 'percussion', genre: 'hardtek', mood: 'tribal',
    volume: 85, pan: 0, muted: false, soloed: false, color: '#ec4899', bpm: 145, key: 'C',
    duration: 0, createdAt: '2024-11-08T10:00:00Z', tags: ['percussion', 'hardtek'],
    fx: [], waveformData: genWaveform(), clipCount: 32, order: 3,
  },
];

export const mockProjects: Project[] = [
  {
    id: 'p1',
    name: 'NEUROSHOCK 200',
    genre: 'mentalcore',
    bpm: 200,
    key: 'C',
    mood: 'aggressive',
    tracks: mentalcoreTracks,
    createdAt: '2024-11-10T14:32:00Z',
    updatedAt: '2024-11-15T09:18:00Z',
    duration: 420,
    isStarred: true,
    coverColor: 'linear-gradient(135deg, #7c3aed 0%, #ef4444 100%)',
    tags: ['mental', 'hard', 'festival'],
    timeSaved: 47,
  },
  {
    id: 'p2',
    name: 'TRIBAL VISION',
    genre: 'tribe',
    bpm: 148,
    key: 'Am',
    mood: 'tribal',
    tracks: hardtekTracks,
    createdAt: '2024-11-08T10:00:00Z',
    updatedAt: '2024-11-13T16:45:00Z',
    duration: 360,
    isStarred: false,
    coverColor: 'linear-gradient(135deg, #f59e0b 0%, #10b981 100%)',
    tags: ['tribe', 'percussive', 'organic'],
    timeSaved: 32,
  },
  {
    id: 'p3',
    name: 'ACID STORM 145',
    genre: 'hardtek',
    bpm: 145,
    key: 'Gm',
    mood: 'psychedelic',
    tracks: hardtekTracks.slice(0, 3),
    createdAt: '2024-11-05T08:20:00Z',
    updatedAt: '2024-11-14T11:30:00Z',
    duration: 390,
    isStarred: true,
    coverColor: 'linear-gradient(135deg, #06b6d4 0%, #7c3aed 100%)',
    tags: ['acid', '303', 'rave'],
    timeSaved: 28,
  },
  {
    id: 'p4',
    name: 'DARK MATTER',
    genre: 'hard-techno',
    bpm: 155,
    key: 'Dm',
    mood: 'dark',
    tracks: mentalcoreTracks.slice(0, 4),
    createdAt: '2024-10-28T19:00:00Z',
    updatedAt: '2024-11-12T20:00:00Z',
    duration: 480,
    isStarred: false,
    coverColor: 'linear-gradient(135deg, #1e1e30 0%, #ef4444 100%)',
    tags: ['techno', 'industrial', 'dark'],
    timeSaved: 55,
  },
  {
    id: 'p5',
    name: 'PSYTRANCE ODYSSEY',
    genre: 'mentalcore',
    bpm: 148,
    key: 'Em',
    mood: 'hypnotic',
    tracks: mentalcoreTracks.slice(0, 5),
    createdAt: '2024-10-20T12:00:00Z',
    updatedAt: '2024-11-10T14:00:00Z',
    duration: 520,
    isStarred: false,
    coverColor: 'linear-gradient(135deg, #ec4899 0%, #06b6d4 100%)',
    tags: ['psytrance', 'hypnotic', 'melodic'],
    timeSaved: 41,
  },
];

const tmpl1Tracks: TemplateTrack[] = [
  { name: 'KICK LAYER 1', type: 'kick', color: '#ef4444', volumeDefault: 110,
    suggestedFX: [
      { name: 'Transient', type: 'compressor', enabled: true, params: { attack: 0, sustain: -6 } },
      { name: 'Saturator', type: 'distortion', enabled: true, params: { drive: 80 } },
    ],
    notes: 'Use a punchy 909-style kick, layer with sub-heavy 808' },
  { name: 'KICK LAYER 2 (sub)', type: 'kick', color: '#dc2626', volumeDefault: 90,
    suggestedFX: [
      { name: 'Sub EQ', type: 'eq', enabled: true, params: { freq: 50, gain: 8 } },
      { name: 'Limiter', type: 'limiter', enabled: true, params: { ceiling: 0.0 } },
    ] },
  { name: 'MENTAL BASS', type: 'bass', color: '#f59e0b', volumeDefault: 95,
    suggestedFX: [
      { name: 'OTT', type: 'compressor', enabled: true, params: { depth: 0.7 } },
      { name: 'Dist', type: 'distortion', enabled: true, params: { drive: 45 } },
    ],
    notes: 'Sidechain heavily to kick.' },
  { name: 'ACID 303', type: 'acid', color: '#06b6d4', volumeDefault: 80,
    suggestedFX: [
      { name: 'Filter Sweep', type: 'filter', enabled: true, params: { cutoff: 1800, res: 0.85 } },
      { name: '1/8 Delay', type: 'delay', enabled: true, params: { time: '1/8', feedback: 0.35 } },
    ],
    notes: 'Program classic 303 acid patterns. Resonance is key.' },
  { name: 'PSYCH FX LAYER', type: 'fx', color: '#10b981', volumeDefault: 65,
    suggestedFX: [
      { name: 'Big Reverb', type: 'reverb', enabled: true, params: { size: 0.95, mix: 0.55 } },
    ] },
  { name: 'HH ROLLS', type: 'percussion', color: '#ec4899', volumeDefault: 75,
    suggestedFX: [], notes: '1/32 rolls with velocity automation' },
];

const tmpl1Routing: RoutingNode[] = [
  { id: 'r1', label: 'KICK GROUP', type: 'bus', color: '#ef4444', children: ['r2', 'r3'] },
  { id: 'r2', label: 'Kick Layer 1', type: 'track', color: '#ef4444', children: [] },
  { id: 'r3', label: 'Kick Layer 2', type: 'track', color: '#dc2626', children: [] },
  { id: 'r4', label: 'BASS BUS', type: 'bus', color: '#f59e0b', children: ['r5'] },
  { id: 'r5', label: 'Mental Bass', type: 'track', color: '#f59e0b', children: [] },
  { id: 'r6', label: 'MASTER', type: 'master', color: '#7c3aed', children: ['r1', 'r4'] },
];

const tmpl2Tracks: TemplateTrack[] = [
  { name: 'TRIBE KICK', type: 'kick', color: '#ef4444', volumeDefault: 105,
    suggestedFX: [
      { name: 'Compressor', type: 'compressor', enabled: true, params: { threshold: -12, ratio: 6 } },
    ],
    notes: 'Slightly muffled, organic feel.' },
  { name: 'TRIBAL PERC', type: 'percussion', color: '#ec4899', volumeDefault: 90,
    suggestedFX: [], notes: 'Stack djembe, conga and bongo samples.' },
  { name: 'DEEP BASS', type: 'bass', color: '#f59e0b', volumeDefault: 100,
    suggestedFX: [
      { name: 'Warmth Sat', type: 'distortion', enabled: true, params: { drive: 20, mix: 0.3 } },
    ] },
  { name: 'TRIBAL LOOP FX', type: 'fx', color: '#10b981', volumeDefault: 60,
    suggestedFX: [
      { name: 'Flanger', type: 'filter', enabled: true, params: { rate: 0.5 } },
      { name: 'Reverb', type: 'reverb', enabled: true, params: { size: 0.7, mix: 0.4 } },
    ] },
];

const tmpl2Routing: RoutingNode[] = [
  { id: 'r1', label: 'DRUMS BUS', type: 'bus', color: '#ef4444', children: ['r2', 'r3'] },
  { id: 'r2', label: 'Tribe Kick', type: 'track', color: '#ef4444', children: [] },
  { id: 'r3', label: 'Tribal Perc', type: 'track', color: '#ec4899', children: [] },
  { id: 'r4', label: 'MASTER', type: 'master', color: '#7c3aed', children: ['r1'] },
];

export const mockTemplates: Template[] = [
  {
    id: 'tmpl1',
    name: 'Mentalcore Arsenal',
    genre: 'mentalcore',
    bpm: 200,
    mood: 'aggressive',
    description: 'Full mentalcore production template with layered kick, screaming acid lead and psychedelic FX chain.',
    aiConfidence: 0.94,
    generatedAt: new Date().toISOString(),
    tracks: tmpl1Tracks,
    routing: tmpl1Routing,
  },
  {
    id: 'tmpl2',
    name: 'Tribe Ritual',
    genre: 'tribe',
    bpm: 148,
    mood: 'tribal',
    description: 'Raw tribal tekno with layered percussion, deep bass, and hypnotic loops.',
    aiConfidence: 0.91,
    generatedAt: new Date().toISOString(),
    tracks: tmpl2Tracks,
    routing: tmpl2Routing,
  },
];

export const mockChatMessages: ChatMessage[] = [
  {
    id: 'msg1',
    role: 'assistant',
    content: "Welcome to NEUROTEK AI! I'm your dedicated production assistant for electronic music.",
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    suggestions: [
      'Generate a mentalcore template at 200 BPM',
      'Analyse my mix for frequency conflicts',
      'Suggest FX chain for acid bass',
      'Help me structure a tribe set',
    ],
  },
  {
    id: 'msg2',
    role: 'user',
    content: 'I need a kick drum chain for mentalcore at 200 BPM.',
    timestamp: new Date(Date.now() - 3540000).toISOString(),
  },
  {
    id: 'msg3',
    role: 'assistant',
    content: 'For a crushing mentalcore kick: Transient Shaper → EQ (+6dB at 55Hz) → Clipper (0.85 ceiling) → Bus Compressor → Limiter (-0.1dBTP).',
    timestamp: new Date(Date.now() - 3520000).toISOString(),
  },
];

export const mockMixAnalysis: MixAnalysis = {
  conflicts: [
    {
      trackA: 'KICK MASTER',
      trackB: 'MENTAL BASS',
      frequency: 80,
      severity: 'high',
      suggestion: 'High-pass the bass at 80Hz and apply sidechain compression.',
    },
    {
      trackA: 'MENTAL BASS',
      trackB: 'ACID LEAD',
      frequency: 300,
      severity: 'medium',
      suggestion: 'Cut 300Hz on the acid lead by -4dB.',
    },
    {
      trackA: 'HI-HAT ROLL',
      trackB: 'PSYCH FX',
      frequency: 8000,
      severity: 'low',
      suggestion: 'Reduce presence on FX layer above 8kHz.',
    },
  ],
  suggestions: [
    {
      id: 'sug1', trackId: 't1', type: 'compression',
      title: 'Kick needs more transient snap',
      description: 'Apply parallel compression with fast attack (0.1ms).',
      priority: 'high', autoApplyable: true,
    },
    {
      id: 'sug2', trackId: 't2', type: 'sidechain',
      title: 'Bass not ducking on kick',
      description: 'Add sidechain compression from kick to bass group.',
      priority: 'high', autoApplyable: true,
    },
    {
      id: 'sug3', type: 'volume',
      title: 'Master bus too loud',
      description: 'Integrated loudness is -6 LUFS. Target -9 LUFS.',
      priority: 'medium', autoApplyable: false,
    },
  ],
  loudness: { integrated: -6.2, shortTerm: -5.8, truePeak: -0.1, lra: 4.2 },
  score: 72,
  analyzedAt: new Date().toISOString(),
};

function makePad(id: string, row: number, col: number, label: string, color: string, active = false): PadCell {
  return { id, row, col, label, color, isActive: active, isEmpty: label === '' };
}

const livePads: PadCell[] = [
  makePad('pad-0-0', 0, 0, 'INTRO', '#7c3aed'),
  makePad('pad-0-1', 0, 1, 'KICK A', '#ef4444', true),
  makePad('pad-0-2', 0, 2, 'BASS A', '#f59e0b'),
  makePad('pad-0-3', 0, 3, 'ACID 1', '#06b6d4'),
  makePad('pad-1-0', 1, 0, 'BUILD', '#a78bfa'),
  makePad('pad-1-1', 1, 1, 'KICK B', '#ef4444'),
  makePad('pad-1-2', 1, 2, 'BASS B', '#f59e0b', true),
  makePad('pad-1-3', 1, 3, 'ACID 2', '#06b6d4'),
  makePad('pad-2-0', 2, 0, 'DROP', '#ec4899'),
  makePad('pad-2-1', 2, 1, 'PERC', '#ec4899'),
  makePad('pad-2-2', 2, 2, 'FX LYR', '#10b981'),
  makePad('pad-2-3', 2, 3, 'REVERB', '#10b981', true),
  makePad('pad-3-0', 3, 0, 'OUTRO', '#475569'),
  makePad('pad-3-1', 3, 1, '', '#1a1a2e'),
  makePad('pad-3-2', 3, 2, 'FX RET', '#10b981'),
  makePad('pad-3-3', 3, 3, 'CRASH', '#ef4444'),
];

const liveScenes: Scene[] = [
  { id: 'sc1', name: 'INTRO', color: '#7c3aed', pads: ['pad-0-0', 'pad-0-1'], isPlaying: false },
  { id: 'sc2', name: 'BUILD UP', color: '#a78bfa', pads: ['pad-1-0', 'pad-1-1', 'pad-1-2'], isPlaying: false },
  { id: 'sc3', name: 'PEAK DROP', color: '#ef4444', pads: ['pad-2-0', 'pad-2-1', 'pad-2-2', 'pad-2-3'], isPlaying: true },
  { id: 'sc4', name: 'BREAK', color: '#06b6d4', pads: ['pad-3-0'], isPlaying: false },
  { id: 'sc5', name: 'OUTRO', color: '#475569', pads: ['pad-3-0', 'pad-3-2'], isPlaying: false },
];

export const mockLiveSession: LiveSession = {
  scenes: liveScenes,
  pads: livePads,
  masterBpm: 200,
  bpm: 200,
  isRecording: false,
};

export const genreInfo: Record<string, { label: string; bpmRange: [number, number]; color: string; description: string }> = {
  mentalcore: { label: 'Mentalcore', bpmRange: [190, 220], color: '#7c3aed', description: 'Extreme psychedelic hardcore.' },
  tribe: { label: 'Tribe', bpmRange: [140, 155], color: '#f59e0b', description: 'Raw tribal tekno.' },
  hardtek: { label: 'Hardtek', bpmRange: [140, 155], color: '#ef4444', description: 'French hardtek / technoid.' },
  acidcore: { label: 'Acidcore', bpmRange: [160, 180], color: '#06b6d4', description: 'Acid-driven hardcore.' },
  'hard-techno': { label: 'Hard Techno', bpmRange: [145, 165], color: '#ec4899', description: 'Dark industrial techno.' },
  tekno: { label: 'Tekno', bpmRange: [150, 165], color: '#10b981', description: 'Free tekno. Raw, underground.' },
};

export const moodColors: Record<string, string> = {
  dark: '#1e1e30', hypnotic: '#7c3aed', aggressive: '#ef4444', euphoric: '#ec4899',
  industrial: '#475569', psychedelic: '#06b6d4', tribal: '#f59e0b', minimal: '#10b981',
};
