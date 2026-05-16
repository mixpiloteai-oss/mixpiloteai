// ============================================================
// NEUROTEK AI — Zustand App Store
// ============================================================
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type {
  AppState,
  Project,
  Track,
  Template,
  ChatMessage,
  ViewType,
  AudioEngineState,
  AppNotification,
  MixAnalysis,
  LiveSession,
  AuthUser,
  QuotaInfo,
} from '../types';
import { mockProjects, mockChatMessages, mockMixAnalysis, mockLiveSession } from '../data/mockData';

const initialAudioEngine: AudioEngineState = {
  playbackState: 'stopped',
  bpm: 200,
  position: 0,
  masterVolume: 0.85,
  masterVu: { left: 0, right: 0, peak: 0, clipping: false },
  trackVu: {},
  spectrum: Array.from({ length: 32 }, (_, i) => ({
    frequency: 20 * Math.pow(2, (i / 31) * 10),
    gain: Math.random() * 0.3,
  })),
  latency: 5.8,
  sampleRate: 44100,
  isInitialised: false,
};

export const useAppStore = create<AppState>()(
  subscribeWithSelector((set, get) => ({
    // ── State ──────────────────────────────────────────────
    auth: { user: null, isAuthenticated: false, quota: null },
    currentView: 'dashboard' as ViewType,
    projects: mockProjects,
    activeProject: mockProjects[0],
    activeTemplate: null,
    chatMessages: mockChatMessages,
    isLoading: false,
    loadingMessage: '',
    audioEngine: initialAudioEngine,
    notifications: [],
    sidebarCollapsed: false,
    mixAnalysis: mockMixAnalysis,
    liveSession: mockLiveSession,

    // ── Actions ──────────────────────────────────────────
    setView: (view: ViewType) => set({ currentView: view }),

    setActiveProject: (project: Project | null) =>
      set({
        activeProject: project,
        audioEngine: {
          ...get().audioEngine,
          bpm: project?.bpm ?? 140,
        },
      }),

    addProject: (project: Project) =>
      set((state) => ({ projects: [project, ...state.projects] })),

    updateProject: (id: string, updates: Partial<Project>) =>
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
        ),
        activeProject:
          state.activeProject?.id === id
            ? { ...state.activeProject, ...updates }
            : state.activeProject,
      })),

    deleteProject: (id: string) =>
      set((state) => ({
        projects: state.projects.filter((p) => p.id !== id),
        activeProject: state.activeProject?.id === id ? null : state.activeProject,
      })),

    toggleProjectStar: (id: string) =>
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === id ? { ...p, isStarred: !p.isStarred } : p
        ),
      })),

    addChatMessage: (message: ChatMessage) =>
      set((state) => ({ chatMessages: [...state.chatMessages, message] })),

    clearChat: () => set({ chatMessages: [] }),

    setLoading: (loading: boolean, message = '') =>
      set({ isLoading: loading, loadingMessage: message }),

    updateAudioEngine: (updates: Partial<AudioEngineState>) =>
      set((state) => ({ audioEngine: { ...state.audioEngine, ...updates } })),

    addNotification: (notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) =>
      set((state) => ({
        notifications: [
          {
            ...notif,
            id: `notif-${Date.now()}`,
            timestamp: new Date().toISOString(),
            read: false,
          },
          ...state.notifications,
        ],
      })),

    markNotificationRead: (id: string) =>
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n
        ),
      })),

    toggleSidebar: () =>
      set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

    setActiveTemplate: (template: Template | null) =>
      set({ activeTemplate: template }),

    setMixAnalysis: (analysis: MixAnalysis | null) =>
      set({ mixAnalysis: analysis }),

    setLiveSession: (session: LiveSession | null) =>
      set({ liveSession: session }),

    setAuth: (user: AuthUser, quota: QuotaInfo) =>
      set({ auth: { user, isAuthenticated: true, quota } }),

    clearAuth: () =>
      set({ auth: { user: null, isAuthenticated: false, quota: null } }),

    updateQuota: (quota: QuotaInfo) =>
      set((state) => ({ auth: { ...state.auth, quota } })),

    updateTrack: (projectId: string, trackId: string, updates: Partial<Track>) =>
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === projectId
            ? {
                ...p,
                tracks: p.tracks.map((t) =>
                  t.id === trackId ? { ...t, ...updates } : t
                ),
              }
            : p
        ),
        activeProject:
          state.activeProject?.id === projectId
            ? {
                ...state.activeProject,
                tracks: state.activeProject.tracks.map((t) =>
                  t.id === trackId ? { ...t, ...updates } : t
                ),
              }
            : state.activeProject,
      })),
  }))
);
