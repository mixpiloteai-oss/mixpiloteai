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
