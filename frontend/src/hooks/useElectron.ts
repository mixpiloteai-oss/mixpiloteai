// ============================================================
// useElectron — React hook for Electron desktop integration
// Safe to use in web context: falls back gracefully when
// window.electronAPI is not present.
// ============================================================

export interface SystemInfo {
  platform: string;
  arch: string;
  cpus: number;
  totalMemory: number;
  freeMemory: number;
  hostname: string;
}

export interface MidiDevice { id: number; name: string; }
export interface MidiDevices { inputs: MidiDevice[]; outputs: MidiDevice[]; total: number; }
export interface VSTPlugin { name: string; path: string; type: 'VST2' | 'VST3'; size?: number; }
export interface UpdateInfo { hasUpdate: boolean; version: string; }

export interface AudioDevice {
  id: string;
  name: string;
  channels: number;
  sampleRates: number[];
  isDefault: boolean;
}

export interface AudioDevices {
  inputs: AudioDevice[];
  outputs: AudioDevice[];
  defaultInput: string | null;
  defaultOutput: string | null;
}

export interface LatencyProfile {
  id: string;
  label: string;
  bufferSize: number;
  sampleRate: number;
}

export interface AutosaveStatus {
  lastSaveTime: number | null;
  hasPending: boolean;
  autosaveDir: string;
}

export interface AutosaveVersion {
  index: number;
  path: string;
  time: number;
}

export interface CrashInfo {
  wasCrash: boolean;
  checkpoint: unknown | null;
}

export interface AudioCacheEntry {
  key: string;
  url: string;
  size: number;
  mtime: number;
  hits: number;
  ext: string;
  filePath: string;
}

export interface AudioCacheStats {
  entryCount: number;
  totalSizeBytes: number;
  totalSizeMB: number;
  maxSizeMB: number;
  cacheDir: string;
}

export interface AudioCachePruneResult {
  pruned: number;
}

export interface DesktopSettings {
  audioOutputDevice: string;
  audioInputDevice: string;
  sampleRate: number;
  bufferSize: number;
  latencyProfile: string;
  midiInputDevice: string | null;
  midiOutputDevice: string | null;
  autosaveEnabled: boolean;
  autosaveIntervalMs: number;
  theme: string;
  defaultBpm: number;
  [key: string]: unknown;
}

declare global {
  interface Window {
    electronAPI?: {
      // System
      getSystemInfo: () => Promise<SystemInfo>;
      checkUpdate: () => Promise<UpdateInfo>;
      openExternal: (url: string) => Promise<void>;
      // Window
      minimize: () => Promise<void>;
      maximize: () => Promise<void>;
      close: () => Promise<void>;
      setAlwaysOnTop: (flag: boolean) => Promise<void>;
      // MIDI
      getMidiDevices: () => Promise<MidiDevices>;
      // VST
      scanVSTPlugins: () => Promise<VSTPlugin[]>;
      // Projects (filesystem)
      saveProject: (data: unknown) => Promise<string | null>;
      loadProject: () => Promise<unknown | null>;
      // Offline store
      offlineSave: (id: string, data: unknown) => Promise<boolean>;
      offlineLoad: (id: string) => Promise<unknown | null>;
      offlineList: () => Promise<unknown[]>;
      offlineDelete: (id: string) => Promise<boolean>;
      saveSetting: (key: string, val: unknown) => Promise<boolean>;
      loadSetting: (key: string) => Promise<unknown | null>;
      // Autosave
      autosaveSetData: (data: unknown) => Promise<boolean>;
      autosaveSaveNow: (data: unknown) => Promise<boolean>;
      autosaveLoadLatest: () => Promise<{ data: unknown; time: number } | null>;
      autosaveListVersions: () => Promise<AutosaveVersion[]>;
      autosaveGetStatus: () => Promise<AutosaveStatus>;
      // Crash recovery
      crashCheck: () => Promise<CrashInfo>;
      crashClearCheckpoint: () => Promise<boolean>;
      // Audio devices
      getAudioDevices: () => Promise<AudioDevices>;
      getLatencyProfiles: () => Promise<LatencyProfile[]>;
      // Desktop settings
      settingsGet: (key: string) => Promise<unknown>;
      settingsSet: (key: string, val: unknown) => Promise<boolean>;
      settingsGetAll: () => Promise<DesktopSettings>;
      settingsReset: (key?: string) => Promise<boolean>;
      // Audio cache
      audioCacheIsCached: (url: string) => Promise<boolean>;
      audioCacheGetPath: (url: string) => Promise<string | null>;
      audioCacheFetch: (url: string) => Promise<string | null>;
      audioCacheStore: (url: string, filePath: string) => Promise<boolean>;
      audioCacheEvict: (url: string) => Promise<boolean>;
      audioCacheStats: () => Promise<AudioCacheStats>;
      audioCacheList: () => Promise<AudioCacheEntry[]>;
      audioCachePrune: () => Promise<AudioCachePruneResult>;
      audioCacheClear: () => Promise<boolean>;
      // Events
      onNav: (cb: (view: string) => void) => void;
      onOpenSettings: (cb: () => void) => void;
      onPowerEvent: (cb: (event: string) => void) => void;
      onUpdateAvailable: (cb: (info: UpdateInfo) => void) => void;
      onTriggerSave: (cb: () => void) => void;
      onTriggerLoad: (cb: () => void) => void;
      onAutosaveComplete: (cb: (info: { time: number }) => void) => void;
      onCrashRecoveryAvailable: (cb: (info: { hasData: boolean; timestamp: number }) => void) => void;
      removeAllListeners: (channel: string) => void;
      // Debug
      debugGetBuildInfo: () => Promise<{
        version: string; buildDate: string; platform: string; arch: string;
        electron: string; node: string; chrome: string; isDev: boolean; channel: string;
      }>;
      debugGetPerfStats: () => Promise<{
        cpuPercent: number; memUsedMB: number; memTotalMB: number; memPercent: number;
        processMemMB: number; uptimeSec: number; pid: number; cpuCount: number; cpuModel: string;
      }>;
      debugListCrashLogs: () => Promise<Array<{
        timestamp: string; type: string; message: string; stack: string; system: string;
      }>>;
      debugClearCrashLogs: () => Promise<number>;
      debugOpenDevTools: () => Promise<void>;
      debugGetAppPaths: () => Promise<{
        userData: string; logs: string; temp: string; downloads: string; appPath: string; crashDir: string;
      }>;
      onPerfStats: (cb: (stats: {
        cpuPercent: number; memUsedMB: number; memTotalMB: number; memPercent: number;
        processMemMB: number; uptimeSec: number; pid: number; cpuCount: number; cpuModel: string;
      }) => void) => void;
      // Platform
      platform: string;
      isElectron: boolean;
    };
  }
}

const _noop = () => {};
const _noopAsync = () => Promise.resolve() as Promise<void>;

const webFallbacks = {
  getSystemInfo: (): Promise<SystemInfo> => Promise.resolve({
    platform: 'web', arch: 'unknown',
    cpus: navigator.hardwareConcurrency ?? 4,
    totalMemory: 0, freeMemory: 0,
    hostname: typeof window !== 'undefined' ? window.location.hostname : 'localhost',
  }),
  checkUpdate: (): Promise<UpdateInfo> => Promise.resolve({ hasUpdate: false, version: '1.0.0' }),
  openExternal: (url: string): Promise<void> => { window.open(url, '_blank', 'noopener,noreferrer'); return Promise.resolve(); },
  minimize: _noopAsync,
  maximize: _noopAsync,
  close: _noopAsync,
  setAlwaysOnTop: (_flag: boolean): Promise<void> => Promise.resolve(),
  getMidiDevices: (): Promise<MidiDevices> => Promise.resolve({ inputs: [], outputs: [], total: 0 }),
  scanVSTPlugins: (): Promise<VSTPlugin[]> => Promise.resolve([]),
  saveProject: (_data: unknown): Promise<string | null> => Promise.resolve(null),
  loadProject: (): Promise<unknown | null> => Promise.resolve(null),
  offlineSave: (_id: string, _data: unknown): Promise<boolean> => Promise.resolve(false),
  offlineLoad: (_id: string): Promise<unknown | null> => Promise.resolve(null),
  offlineList: (): Promise<unknown[]> => Promise.resolve([]),
  offlineDelete: (_id: string): Promise<boolean> => Promise.resolve(false),
  saveSetting: (_key: string, _val: unknown): Promise<boolean> => Promise.resolve(false),
  loadSetting: (_key: string): Promise<unknown | null> => Promise.resolve(null),
  autosaveSetData: (_data: unknown): Promise<boolean> => Promise.resolve(false),
  autosaveSaveNow: (_data: unknown): Promise<boolean> => Promise.resolve(false),
  autosaveLoadLatest: (): Promise<null> => Promise.resolve(null),
  autosaveListVersions: (): Promise<AutosaveVersion[]> => Promise.resolve([]),
  autosaveGetStatus: (): Promise<AutosaveStatus> => Promise.resolve({ lastSaveTime: null, hasPending: false, autosaveDir: '' }),
  crashCheck: (): Promise<CrashInfo> => Promise.resolve({ wasCrash: false, checkpoint: null }),
  crashClearCheckpoint: (): Promise<boolean> => Promise.resolve(false),
  getAudioDevices: (): Promise<AudioDevices> => Promise.resolve({ inputs: [], outputs: [], defaultInput: null, defaultOutput: null }),
  getLatencyProfiles: (): Promise<LatencyProfile[]> => Promise.resolve([]),
  settingsGet: (_key: string): Promise<unknown> => Promise.resolve(null),
  settingsSet: (_key: string, _val: unknown): Promise<boolean> => Promise.resolve(false),
  settingsGetAll: (): Promise<DesktopSettings> => Promise.resolve({} as DesktopSettings),
  settingsReset: (_key?: string): Promise<boolean> => Promise.resolve(false),
  audioCacheIsCached: (_url: string): Promise<boolean> => Promise.resolve(false),
  audioCacheGetPath: (_url: string): Promise<string | null> => Promise.resolve(null),
  audioCacheFetch: (_url: string): Promise<string | null> => Promise.resolve(null),
  audioCacheStore: (_url: string, _filePath: string): Promise<boolean> => Promise.resolve(false),
  audioCacheEvict: (_url: string): Promise<boolean> => Promise.resolve(false),
  audioCacheStats: (): Promise<AudioCacheStats> => Promise.resolve({ entryCount: 0, totalSizeBytes: 0, totalSizeMB: 0, maxSizeMB: 500, cacheDir: '' }),
  audioCacheList: (): Promise<AudioCacheEntry[]> => Promise.resolve([]),
  audioCachePrune: (): Promise<AudioCachePruneResult> => Promise.resolve({ pruned: 0 }),
  audioCacheClear: (): Promise<boolean> => Promise.resolve(false),
  onNav: (_cb: (view: string) => void) => _noop(),
  onOpenSettings: (_cb: () => void) => _noop(),
  onPowerEvent: (_cb: (event: string) => void) => _noop(),
  onUpdateAvailable: (_cb: (info: UpdateInfo) => void) => _noop(),
  onTriggerSave: (_cb: () => void) => _noop(),
  onTriggerLoad: (_cb: () => void) => _noop(),
  onAutosaveComplete: (_cb: (info: { time: number }) => void) => _noop(),
  onCrashRecoveryAvailable: (_cb: (info: { hasData: boolean; timestamp: number }) => void) => _noop(),
  removeAllListeners: (_channel: string) => _noop(),
};

export function useElectron() {
  const isElectron = typeof window !== 'undefined' && Boolean(window.electronAPI?.isElectron);
  const api = isElectron ? window.electronAPI! : null;

  return {
    isElectron,
    platform: api?.platform ?? 'web',
    getSystemInfo:              api?.getSystemInfo              ?? webFallbacks.getSystemInfo,
    checkUpdate:                api?.checkUpdate                ?? webFallbacks.checkUpdate,
    openExternal:               api?.openExternal               ?? webFallbacks.openExternal,
    minimize:                   api?.minimize                   ?? webFallbacks.minimize,
    maximize:                   api?.maximize                   ?? webFallbacks.maximize,
    close:                      api?.close                      ?? webFallbacks.close,
    setAlwaysOnTop:             api?.setAlwaysOnTop             ?? webFallbacks.setAlwaysOnTop,
    getMidiDevices:             api?.getMidiDevices             ?? webFallbacks.getMidiDevices,
    scanVSTPlugins:             api?.scanVSTPlugins             ?? webFallbacks.scanVSTPlugins,
    saveProject:                api?.saveProject                ?? webFallbacks.saveProject,
    loadProject:                api?.loadProject                ?? webFallbacks.loadProject,
    offlineSave:                api?.offlineSave                ?? webFallbacks.offlineSave,
    offlineLoad:                api?.offlineLoad                ?? webFallbacks.offlineLoad,
    offlineList:                api?.offlineList                ?? webFallbacks.offlineList,
    offlineDelete:              api?.offlineDelete              ?? webFallbacks.offlineDelete,
    saveSetting:                api?.saveSetting                ?? webFallbacks.saveSetting,
    loadSetting:                api?.loadSetting                ?? webFallbacks.loadSetting,
    autosaveSetData:            api?.autosaveSetData            ?? webFallbacks.autosaveSetData,
    autosaveSaveNow:            api?.autosaveSaveNow            ?? webFallbacks.autosaveSaveNow,
    autosaveLoadLatest:         api?.autosaveLoadLatest         ?? webFallbacks.autosaveLoadLatest,
    autosaveListVersions:       api?.autosaveListVersions       ?? webFallbacks.autosaveListVersions,
    autosaveGetStatus:          api?.autosaveGetStatus          ?? webFallbacks.autosaveGetStatus,
    crashCheck:                 api?.crashCheck                 ?? webFallbacks.crashCheck,
    crashClearCheckpoint:       api?.crashClearCheckpoint       ?? webFallbacks.crashClearCheckpoint,
    getAudioDevices:            api?.getAudioDevices            ?? webFallbacks.getAudioDevices,
    getLatencyProfiles:         api?.getLatencyProfiles         ?? webFallbacks.getLatencyProfiles,
    settingsGet:                api?.settingsGet                ?? webFallbacks.settingsGet,
    settingsSet:                api?.settingsSet                ?? webFallbacks.settingsSet,
    settingsGetAll:             api?.settingsGetAll             ?? webFallbacks.settingsGetAll,
    settingsReset:              api?.settingsReset              ?? webFallbacks.settingsReset,
    audioCacheIsCached:         api?.audioCacheIsCached         ?? webFallbacks.audioCacheIsCached,
    audioCacheGetPath:          api?.audioCacheGetPath          ?? webFallbacks.audioCacheGetPath,
    audioCacheFetch:            api?.audioCacheFetch            ?? webFallbacks.audioCacheFetch,
    audioCacheStore:            api?.audioCacheStore            ?? webFallbacks.audioCacheStore,
    audioCacheEvict:            api?.audioCacheEvict            ?? webFallbacks.audioCacheEvict,
    audioCacheStats:            api?.audioCacheStats            ?? webFallbacks.audioCacheStats,
    audioCacheList:             api?.audioCacheList             ?? webFallbacks.audioCacheList,
    audioCachePrune:            api?.audioCachePrune            ?? webFallbacks.audioCachePrune,
    audioCacheClear:            api?.audioCacheClear            ?? webFallbacks.audioCacheClear,
    onNav:                      api?.onNav                      ?? webFallbacks.onNav,
    onOpenSettings:             api?.onOpenSettings             ?? webFallbacks.onOpenSettings,
    onPowerEvent:               api?.onPowerEvent               ?? webFallbacks.onPowerEvent,
    onUpdateAvailable:          api?.onUpdateAvailable          ?? webFallbacks.onUpdateAvailable,
    onTriggerSave:              api?.onTriggerSave              ?? webFallbacks.onTriggerSave,
    onTriggerLoad:              api?.onTriggerLoad              ?? webFallbacks.onTriggerLoad,
    onAutosaveComplete:         api?.onAutosaveComplete         ?? webFallbacks.onAutosaveComplete,
    onCrashRecoveryAvailable:   api?.onCrashRecoveryAvailable   ?? webFallbacks.onCrashRecoveryAvailable,
    removeAllListeners:         api?.removeAllListeners         ?? webFallbacks.removeAllListeners,
  };
}
