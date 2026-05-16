// ============================================================
// NEUROTEK AI — Built-in Packs Data
// ============================================================

export type PackType =
  | 'template'
  | 'fxRack'
  | 'drumKit'
  | 'liveScene'
  | 'preset'
  | 'chain'
  | 'aiWorkflow';

export interface BuiltinPack {
  id: string;
  name: string;
  description: string;
  type: PackType;
  genre: string[];
  tags: string[];
  downloads: number;
  rating: number;
  ratingCount: number;
  isBuiltin: true;
  isFree: true;
  fileSize: string;
  version: string;
  author: string;
  tracks?: Array<{ name: string; type: string; color: string }>;
}

export const BUILTIN_PACKS: BuiltinPack[] = [
  {
    id: 'builtin-drum-essentials',
    name: 'Drum Essentials',
    description: 'Professional drum templates for tekno, tribe and mentalcore.',
    type: 'drumKit', genre: ['tribe', 'mentalcore', 'hardtek'],
    tags: ['kick', 'percussion', 'essential', 'tribe', '145bpm'],
    downloads: 2847, rating: 4.8, ratingCount: 312,
    isBuiltin: true, isFree: true, fileSize: '2.4 MB', version: '1.0.0', author: 'NEUROTEK Team',
    tracks: [
      { name: 'Kick 4/4', type: 'kick', color: '#ef4444' },
      { name: 'Tribal Perc', type: 'percussion', color: '#ec4899' },
      { name: 'Open HH', type: 'percussion', color: '#f59e0b' },
      { name: 'Clap Roll', type: 'percussion', color: '#ec4899' },
    ],
  },
  {
    id: 'builtin-tribe-essentials',
    name: 'Tribe Essentials',
    description: 'Deep tribal grooves with hypnotic percussion sequences.',
    type: 'template', genre: ['tribe', 'tribal'],
    tags: ['tribal', 'hypnotic', 'groove', 'shaman', '148bpm'],
    downloads: 1956, rating: 4.7, ratingCount: 214,
    isBuiltin: true, isFree: true, fileSize: '3.1 MB', version: '1.0.0', author: 'NEUROTEK Team',
    tracks: [
      { name: 'Tribal Kick', type: 'kick', color: '#7c3aed' },
      { name: 'Shaman Drum', type: 'percussion', color: '#ec4899' },
      { name: 'Acid Bass', type: 'bass', color: '#06b6d4' },
      { name: 'Atmosphere', type: 'pad', color: '#10b981' },
    ],
  },
  {
    id: 'builtin-mentalcore-toolkit',
    name: 'Mentalcore Toolkit',
    description: 'Full production toolkit for mentalcore music.',
    type: 'template', genre: ['mentalcore', 'industrial'],
    tags: ['mentalcore', 'industrial', 'dark', 'distortion', '155bpm'],
    downloads: 3102, rating: 4.9, ratingCount: 408,
    isBuiltin: true, isFree: true, fileSize: '4.8 MB', version: '2.0.0', author: 'NEUROTEK Team',
    tracks: [
      { name: 'Distorted Kick', type: 'kick', color: '#ef4444' },
      { name: 'Industrial Perc', type: 'percussion', color: '#6b7280' },
      { name: 'Dark Sub', type: 'bass', color: '#1e1b4b' },
      { name: 'Terror Synth', type: 'melody', color: '#7c3aed' },
    ],
  },
  {
    id: 'builtin-acid-starter',
    name: 'Acid Starter Pack',
    description: 'Classic 303 acid basslines with resonant filter sweeps.',
    type: 'preset', genre: ['acidcore', 'acid-techno'],
    tags: ['acid', '303', 'bassline', 'filter', 'resonance'],
    downloads: 2214, rating: 4.6, ratingCount: 187,
    isBuiltin: true, isFree: true, fileSize: '1.8 MB', version: '1.2.0', author: 'NEUROTEK Team',
    tracks: [
      { name: 'Acid Bass 303', type: 'acid', color: '#06b6d4' },
      { name: 'Filter LFO', type: 'fx', color: '#f59e0b' },
    ],
  },
  {
    id: 'builtin-hardtek-live',
    name: 'Hardtek Live Pack',
    description: 'Ready-to-launch live performance pack with 8 scenes.',
    type: 'liveScene', genre: ['hardtek', 'tekno'],
    tags: ['live', 'performance', 'hardtek', 'scenes', 'loops'],
    downloads: 1687, rating: 4.7, ratingCount: 156,
    isBuiltin: true, isFree: true, fileSize: '5.2 MB', version: '1.0.0', author: 'NEUROTEK Team',
    tracks: [
      { name: 'Intro Scene', type: 'pad', color: '#7c3aed' },
      { name: 'Peak Scene', type: 'kick', color: '#ef4444' },
    ],
  },
  {
    id: 'builtin-fx-essentials',
    name: 'FX Essentials',
    description: 'Essential FX chains for every track type.',
    type: 'fxRack', genre: ['all'],
    tags: ['fx', 'reverb', 'delay', 'distortion', 'mastering'],
    downloads: 4521, rating: 4.9, ratingCount: 512,
    isBuiltin: true, isFree: true, fileSize: '0.8 MB', version: '3.0.0', author: 'NEUROTEK Team',
  },
  {
    id: 'builtin-bass-toolkit',
    name: 'Bass Toolkit',
    description: 'Bassline templates for hardtek, neurofunk and industrial.',
    type: 'chain', genre: ['hardtek', 'neurofunk', 'industrial'],
    tags: ['bass', 'sidechain', 'sub', 'neurofunk', 'industrial'],
    downloads: 2891, rating: 4.8, ratingCount: 267,
    isBuiltin: true, isFree: true, fileSize: '1.4 MB', version: '1.1.0', author: 'NEUROTEK Team',
    tracks: [
      { name: 'Sub Bass', type: 'bass', color: '#1e40af' },
      { name: 'Kick Sidechain', type: 'kick', color: '#ef4444' },
    ],
  },
];

export const PACK_TYPE_COLORS: Record<PackType, string> = {
  template: '#7c3aed', fxRack: '#06b6d4', drumKit: '#ef4444',
  liveScene: '#f59e0b', preset: '#10b981', chain: '#ec4899', aiWorkflow: '#a78bfa',
};

export const PACK_TYPE_LABELS: Record<PackType, string> = {
  template: 'Template', fxRack: 'FX Rack', drumKit: 'Drum Kit',
  liveScene: 'Live Scene', preset: 'Preset', chain: 'Chain', aiWorkflow: 'AI Workflow',
};
