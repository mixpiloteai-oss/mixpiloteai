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
  | 'onboarding';

// -------------------------------------------------------
// Project & Track
// -------------------------------------------------------

export interface TrackFX {
  name: string;
  type: 'eq' | 'compressor' | 'reverb' | 'delay' | 'distortion' | 'filter' | 'limiter';
  enabled: boolean;
  params: Record<string, number | string>;
}

export interface Track {
  id: string;
  name: string;
  type: TrackType;
  volume: number;         // 0–127
  pan: number;            // -64 to +64
  muted: boolean;
  soloed: boolean;
  color: string;
  bpm?: number;
  key?: string;
  fx: TrackFX[];
  waveformData?: number[];  // Normalised amplitude values 0–1
  clipCount: number;
  groupId?: string;
  order: number;
}

export interface Project {
  id: string;
  name: string;
  genre: Genre;
  bpm: number;
  key: string;
  mood: Mood;
  tracks: Track[];
  createdAt: string;
  updatedAt: string;
  duration: number;       // seconds
  isStarred: boolean;
  coverColor: string;     // CSS gradient string
  tags: string[];
  timeSaved: number;      // AI-saved minutes
}

// -------------------------------------------------------
// Template System
// -------------------------------------------------------

export interface TrackTemplate {
  name: string;
  type: TrackType;
  color: string;
  suggestedFX: TrackFX[];
  volumeDefault: number;
  notes?: string;
}

export interface Template {
  id: string;
  name: string;
  genre: Genre;
  bpm: number;
  mood: Mood;
  description: string;
  tracks: TrackTemplate[];
  routing: RoutingNode[];
  generatedAt: string;
  aiConfidence: number;   // 0–1
}

export interface RoutingNode {
  id: string;
  label: string;
  type: 'track' | 'bus' | 'master' | 'send';
  color: string;
  children: string[];
}

// -------------------------------------------------------
// AI Chat
// -------------------------------------------------------

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  isTyping?: boolean;
  suggestions?: string[];
  codeBlock?: {
    language: string;
    code: string;
  };
}

export interface ChatContext {
  activeProject?: Project;
  genre?: Genre;
  bpm?: number;
}

// -------------------------------------------------------
// Audio Engine
// -------------------------------------------------------

export interface VuMeterState {
  left: number;     // 0–1
  right: number;    // 0–1
  peak: number;     // 0–1 (held peak)
  clipping: boolean;
}

export interface SpectrumBand {
  frequency: number;  // Hz
  gain: number;       // 0–1 normalised
}

export interface AudioEngineState {
  playbackState: PlaybackState;
  bpm: number;
  position: number;       // bars
  masterVolume: number;   // 0–1
  masterVu: VuMeterState;
  trackVu: Record<string, VuMeterState>;
  spectrum: SpectrumBand[];
  latency: number;        // ms
  sampleRate: number;
  isInitialised: boolean;
}

// -------------------------------------------------------
// Mix Assistant
// -------------------------------------------------------

export interface FrequencyConflict {
  trackA: string;
  trackB: string;
  frequency: number;
  severity: 'low' | 'medium' | 'high';
  suggestion: string;
}

export interface MixSuggestion {
  id: string;
  trackId?: string;
  type: 'eq' | 'compression' | 'sidechain' | 'volume' | 'panning' | 'fx';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  autoApplyable: boolean;
}

export interface MixAnalysis {
  conflicts: FrequencyConflict[];
  suggestions: MixSuggestion[];
  loudness: {
    integrated: number;
    shortTerm: number;
    truePeak: number;
    lra: number;
  };
  score: number;  // 0–100
}

// -------------------------------------------------------
// Live Mode
// -------------------------------------------------------

export interface PadCell {
  id: string;
  row: number;
  col: number;
  label: string;
  color: string;
  isActive: boolean;
  clipId?: string;
  isEmpty: boolean;
}

export interface Scene {
  id: string;
  name: string;
  color: string;
  pads: string[];     // pad IDs
  isPlaying: boolean;
}

export interface LiveSession {
  scenes: Scene[];
  pads: PadCell[];
  masterBpm: number;
  isRecording: boolean;
}

// -------------------------------------------------------
// Auth & Subscription
// -------------------------------------------------------

export type Plan = 'free' | 'pro' | 'studio';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  plan: Plan;
}

export interface QuotaInfo {
  used: number;
  limit: number;
  remaining: number;
  resetAt?: string;
}

export interface SubscriptionPlan {
  id: Plan;
  name: string;
  price: number;
  currency: string;
  billing: string;
  color: string;
  popular?: boolean;
  features: string[];
  limits: Record<string, number | string>;
  cta: string;
}

export interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  quota: QuotaInfo | null;
}

// -------------------------------------------------------
// App Store Shape
// -------------------------------------------------------

export interface AppNotification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  timestamp: string;
  read: boolean;
}

export interface AppState {
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

  // Auth
  auth: AuthState;

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
  addNotification: (notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
  markNotificationRead: (id: string) => void;
  toggleSidebar: () => void;
  setActiveTemplate: (template: Template | null) => void;
  setMixAnalysis: (analysis: MixAnalysis | null) => void;
  setLiveSession: (session: LiveSession | null) => void;
  updateTrack: (projectId: string, trackId: string, updates: Partial<Track>) => void;

  // Auth actions
  setAuth: (user: AuthUser, quota: QuotaInfo) => void;
  clearAuth: () => void;
  updateQuota: (quota: QuotaInfo) => void;
}
