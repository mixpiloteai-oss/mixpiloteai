// ============================================================
// NEUROTEK AI — Core TypeScript Types
// ============================================================

export type Genre =
  | 'mentalcore'
  | 'tribe'
  | 'hardtek'
  | 'acidcore'
  | 'hard-techno'
  | 'tekno'
  | 'industrial'
  | 'neurofunk';

export type TrackType =
  | 'kick'
  | 'bass'
  | 'melody'
  | 'fx'
  | 'percussion'
  | 'master'
  | 'vocal'
  | 'pad'
  | 'arp'
  | 'acid';

export type Mood =
  | 'dark'
  | 'hypnotic'
  | 'aggressive'
  | 'euphoric'
  | 'industrial'
  | 'psychedelic'
  | 'tribal'
  | 'minimal';

export type PlaybackState = 'stopped' | 'playing' | 'paused' | 'recording';

export type ViewType =
  | 'dashboard'
  | 'templates'
  | 'tracks'
  | 'mix'
  | 'live'
  | 'chat'
  | 'packs'
  | 'daw'
  | 'coach'
  | 'analytics'
  | 'plans'
  | 'legal'
  | 'audio'
  | 'launcher'
  | 'onboarding';
