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

declare global {
  interface Window {
    electronAPI?: {
      getSystemInfo: () => Promise<SystemInfo>;
      checkUpdate: () => Promise<UpdateInfo>;
      openExternal: (url: string) => Promise<void>;
      minimize: () => Promise<void>;
      maximize: () => Promise<void>;
      close: () => Promise<void>;
      setAlwaysOnTop: (flag: boolean) => Promise<void>;
      getMidiDevices: () => Promise<MidiDevices>;
      scanVSTPlugins: () => Promise<VSTPlugin[]>;
      saveProject: (data: unknown) => Promise<string | null>;
      loadProject: () => Promise<unknown | null>;
      offlineSave: (id: string, data: unknown) => Promise<boolean>;
      offlineLoad: (id: string) => Promise<unknown | null>;
      offlineList: () => Promise<unknown[]>;
      offlineDelete: (id: string) => Promise<boolean>;
      saveSetting: (key: string, val: unknown) => Promise<boolean>;
      loadSetting: (key: string) => Promise<unknown | null>;
      onNav: (cb: (view: string) => void) => void;
      onOpenSettings: (cb: () => void) => void;
      onPowerEvent: (cb: (event: string) => void) => void;
      onUpdateAvailable: (cb: (info: UpdateInfo) => void) => void;
      onTriggerSave: (cb: () => void) => void;
      onTriggerLoad: (cb: () => void) => void;
      removeAllListeners: (channel: string) => void;
      platform: string;
      isElectron: boolean;
    };
  }
}

const _noop = () => {};

const webFallbacks = {
  getSystemInfo: (): Promise<SystemInfo> => Promise.resolve({
    platform: 'web', arch: 'unknown',
    cpus: navigator.hardwareConcurrency ?? 4,
    totalMemory: 0, freeMemory: 0, hostname: window.location.hostname,
  }),
  checkUpdate: (): Promise<UpdateInfo> => Promise.resolve({ hasUpdate: false, version: '1.0.0' }),
  openExternal: (url: string): Promise<void> => { window.open(url, '_blank', 'noopener,noreferrer'); return Promise.resolve(); },
  minimize: () => Promise.resolve(),
  maximize: () => Promise.resolve(),
  close: () => Promise.resolve(),
  setAlwaysOnTop: (_flag: boolean) => Promise.resolve(),
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
  onNav: (_cb: (view: string) => void) => _noop(),
  onOpenSettings: (_cb: () => void) => _noop(),
  onPowerEvent: (_cb: (event: string) => void) => _noop(),
  onUpdateAvailable: (_cb: (info: UpdateInfo) => void) => _noop(),
  onTriggerSave: (_cb: () => void) => _noop(),
  onTriggerLoad: (_cb: () => void) => _noop(),
  removeAllListeners: (_channel: string) => _noop(),
};

export function useElectron() {
  const isElectron = typeof window !== 'undefined' && Boolean(window.electronAPI?.isElectron);
  const api = isElectron ? window.electronAPI! : null;

  return {
    isElectron,
    platform: api?.platform ?? 'web',
    getSystemInfo:      api?.getSystemInfo      ?? webFallbacks.getSystemInfo,
    checkUpdate:        api?.checkUpdate        ?? webFallbacks.checkUpdate,
    openExternal:       api?.openExternal       ?? webFallbacks.openExternal,
    minimize:           api?.minimize           ?? webFallbacks.minimize,
    maximize:           api?.maximize           ?? webFallbacks.maximize,
    close:              api?.close              ?? webFallbacks.close,
    setAlwaysOnTop:     api?.setAlwaysOnTop     ?? webFallbacks.setAlwaysOnTop,
    getMidiDevices:     api?.getMidiDevices     ?? webFallbacks.getMidiDevices,
    scanVSTPlugins:     api?.scanVSTPlugins     ?? webFallbacks.scanVSTPlugins,
    saveProject:        api?.saveProject        ?? webFallbacks.saveProject,
    loadProject:        api?.loadProject        ?? webFallbacks.loadProject,
    offlineSave:        api?.offlineSave        ?? webFallbacks.offlineSave,
    offlineLoad:        api?.offlineLoad        ?? webFallbacks.offlineLoad,
    offlineList:        api?.offlineList        ?? webFallbacks.offlineList,
    offlineDelete:      api?.offlineDelete      ?? webFallbacks.offlineDelete,
    saveSetting:        api?.saveSetting        ?? webFallbacks.saveSetting,
    loadSetting:        api?.loadSetting        ?? webFallbacks.loadSetting,
    onNav:              api?.onNav              ?? webFallbacks.onNav,
    onOpenSettings:     api?.onOpenSettings     ?? webFallbacks.onOpenSettings,
    onPowerEvent:       api?.onPowerEvent       ?? webFallbacks.onPowerEvent,
    onUpdateAvailable:  api?.onUpdateAvailable  ?? webFallbacks.onUpdateAvailable,
    onTriggerSave:      api?.onTriggerSave      ?? webFallbacks.onTriggerSave,
    onTriggerLoad:      api?.onTriggerLoad      ?? webFallbacks.onTriggerLoad,
    removeAllListeners: api?.removeAllListeners ?? webFallbacks.removeAllListeners,
  };
}
