// ============================================================
// NEUROTEK AI — Core TypeScript Types
// ============================================================

export type Genre =
  | 'mentalcore' | 'tribe' | 'hardtek' | 'acidcore'
  | 'hard-techno' | 'tekno' | 'industrial' | 'neurofunk';

export type TrackType =
  | 'kick' | 'bass' | 'melody' | 'fx' | 'percussion'
  | 'master' | 'vocal' | 'pad' | 'arp' | 'acid';

export type Mood =
  | 'dark' | 'hypnotic' | 'aggressive' | 'euphoric'
  | 'industrial' | 'psychedelic' | 'tribal' | 'minimal';

export type PlaybackState = 'stopped' | 'playing' | 'paused' | 'recording';

export type ViewType =
  | 'dashboard' | 'templates' | 'tracks' | 'mix' | 'live'
  | 'chat' | 'packs' | 'daw' | 'coach' | 'analytics'
  | 'plans' | 'legal' | 'audio' | 'launcher' | 'onboarding'
  | 'piano-roll' | 'arrangement' | 'mixer' | 'spectrum';

// ─── Piano Roll / Sequencer ──────────────────────────────────
export interface Note {
  id: string;
  pitch: number;      // MIDI note number 21–108
  beat: number;       // start position in beats (float, 0-based)
  duration: number;   // length in beats (float)
  velocity: number;   // 0–127
  channel: string;    // channel strip ID
}

export interface Pattern {
  id: string;
  name: string;
  channelId: string;
  notes: Note[];
  lengthBars: number;
  color: string;
}

export interface ArrangementClip {
  id: string;
  patternId: string;
  trackId: string;
  startBar: number;
  durationBars: number;
  color: string;
}

// ─── Mixer ──────────────────────────────────────────────────
export interface EQBand {
  freq: number;
  gain: number;       // –12 to +12 dB
  q: number;          // 0.1–10
  type: 'lowshelf' | 'peaking' | 'highshelf';
  enabled: boolean;
}

export interface CompressorSettings {
  threshold: number;  // dB –60 to 0
  ratio: number;      // 1–20
  attack: number;     // ms
  release: number;    // ms
  makeupGain: number; // dB 0–24
  enabled: boolean;
}

export interface MixerChannel {
  id: string;
  name: string;
  type: TrackType | 'return';
  volume: number;
  pan: number;
  muted: boolean;
  soloed: boolean;
  eq: [EQBand, EQBand, EQBand];
  compressor: CompressorSettings;
  reverbSend: number;
  delaySend: number;
  color: string;
}

// ─── Project Save ────────────────────────────────────────────
export interface ProjectSave {
  version: string;
  id: string;
  name: string;
  bpm: number;
  masterVolume: number;
  timeSignature: [number, number];
  patterns: Pattern[];
  arrangement: ArrangementClip[];
  mixerChannels: MixerChannel[];
  createdAt: string;
  updatedAt: string;
}

// ─── App State ───────────────────────────────────────────────
export interface TrackFX {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  params?: Record<string, number>;
}

export interface VuMeterState {
  left: number;
  right: number;
  peak: number;
  clipping: boolean;
}

export interface SpectrumBand {
  frequency: number;
  gain: number;
}

export interface Track {
  id: string;
  name: string;
  type: TrackType;
  genre: Genre;
  mood: Mood;
  bpm: number;
  key: string;
  duration: number;
  url?: string;
  waveform?: number[];
  waveformData?: number[];
  color?: string;
  muted?: boolean;
  soloed?: boolean;
  volume?: number;
  pan?: number;
  order?: number;
  clipCount?: number;
  fx?: TrackFX[];
  createdAt: string;
  tags: string[];
}

export interface Template {
  id: string;
  name: string;
  genre: Genre;
  mood: Mood;
  bpm: number;
  description: string;
  previewUrl?: string;
  tags: string[];
  tracks: Partial<Track>[];
  routing?: string[];
}

export type SubscriptionPlan = 'free' | 'creator' | 'studio' | 'learning';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  attachments?: string[];
  codeBlock?: string;
  suggestions?: string[];
}

export interface AudioEngineState {
  playbackState: PlaybackState;
  bpm: number;
  position: number;
  masterVolume: number;
  masterVu: VuMeterState;
  trackVu: Record<string, number>;
  spectrum: SpectrumBand[];
  latency: number;
  sampleRate: number;
  isInitialised: boolean;
}

export interface AppNotification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export interface MixConflict {
  id: string;
  type: string;
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  autoApplyable?: boolean;
}

export interface MixSuggestion {
  id: string;
  type: string;
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  autoApplyable?: boolean;
}

export interface MixAnalysis {
  trackId: string;
  lufs: number;
  peak: number;
  dynamicRange: number;
  frequencyBalance: Record<string, number>;
  suggestions: MixSuggestion[];
  conflicts: MixConflict[];
  score?: number;
  loudness?: number;
  analyzedAt: string;
}

export interface PadCell {
  id: string;
  label?: string;
  color: string;
  isActive?: boolean;
  isEmpty?: boolean;
  trackId?: string;
}

export interface Scene {
  id: string;
  name: string;
  color: string;
  pads: PadCell[];
}

export interface LiveSession {
  id: string;
  hostId: string;
  participants: string[];
  bpm: number;
  genre: Genre;
  startedAt: string;
  isRecording: boolean;
  pads?: PadCell[];
  scenes?: Scene[];
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  plan: 'free' | 'creator' | 'studio' | 'learning';
}

export interface QuotaInfo {
  used: number;
  limit: number;
  remaining: number;
  plan: string;
  resetsAt?: string;
}

export interface AppState {
  auth: { user: AuthUser | null; isAuthenticated: boolean; quota: QuotaInfo | null };
  currentView: ViewType;
  projects: Project[];
  activeProject: Project | null;
  activeTemplate: Template | null;
  chatMessages: ChatMessage[];
  isLoading: boolean;
  loadingMessage: string;
  audioEngine: AudioEngineState;
  notifications: AppNotification[];
  sidebarCollapsed: boolean;
  mixAnalysis: MixAnalysis | null;
  liveSession: LiveSession | null;
  // Actions
  setView: (view: ViewType) => void;
  setActiveProject: (project: Project | null) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  toggleProjectStar: (id: string) => void;
  addChatMessage: (message: ChatMessage) => void;
  clearChat: () => void;
  setLoading: (loading: boolean, message?: string) => void;
  updateAudioEngine: (updates: Partial<AudioEngineState>) => void;
  addNotification: (notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
  markNotificationRead: (id: string) => void;
  toggleSidebar: () => void;
  setActiveTemplate: (template: Template | null) => void;
  setMixAnalysis: (analysis: MixAnalysis | null) => void;
  setLiveSession: (session: LiveSession | null) => void;
  setAuth: (user: AuthUser, quota: QuotaInfo) => void;
  clearAuth: () => void;
  updateQuota: (quota: QuotaInfo) => void;
  updateTrack: (projectId: string, trackId: string, updates: Partial<Track>) => void;
}

export interface Project {
  id: string;
  name: string;
  genre: Genre;
  mood?: Mood;
  bpm: number;
  key?: string;
  tracks: Track[];
  coverColor: string;
  isStarred: boolean;
  isPublic: boolean;
  timeSaved?: number;
  createdAt: string;
  updatedAt: string;
}
