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
export interface UpdateInfo { hasUpdate: boolean; version: string; releaseNotes?: string; downloadUrl?: string; }

export interface AudioDevice {
  id: string;
  name: string;
  channels: number;
  sampleRates: number[];
  isDefault: boolean;
}

export interface PerformanceMetrics {
  cpuUsage: number;
  memoryUsage: number;
  audioBufferLoad: number;
  diskReadSpeed: number;
  uptime: number;
}

export interface AudioSettings {
  sampleRate: number;
  bufferSize: number;
  outputDevice: string;
  inputDevice: string;
  latencyMode: 'low' | 'normal' | 'high';
}

export interface AudioCacheStats {
  totalSizeMB: number;
  entryCount: number;
}

export interface DebugPerfStats {
  cpuPercent: number;
  memUsedMB: number;
  memTotalMB: number;
  memPercent: number;
  processMemMB: number;
  uptimeSec: number;
  pid: number;
  cpuCount: number;
  cpuModel: string;
}

export interface DebugBuildInfo {
  version: string;
  buildDate: string;
  platform: string;
  arch: string;
  electron: string;
  node: string;
  chrome: string;
  isDev: boolean;
  channel: string;
}

export interface DebugAppPaths {
  userData: string;
  logs: string;
  temp: string;
  downloads: string;
  appPath: string;
  crashDir: string;
}

export interface DebugCrashLog {
  timestamp: string;
  type: string;
  message: string;
  stack: string;
  system: string;
}

export interface ElectronAPI {
  isElectron: boolean;
  platform: string;
  version: string;
  appVersion: string;
  openExternal: (url: string) => Promise<void>;
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  isMaximized: () => Promise<boolean>;
  toggleDevTools: () => void;
  setAlwaysOnTop: (value: boolean) => Promise<void>;
  getSystemInfo: () => Promise<SystemInfo>;
  getPerformanceMetrics: () => Promise<PerformanceMetrics>;
  checkUpdate: () => Promise<UpdateInfo>;
  getMidiDevices: () => Promise<MidiDevices>;
  getVSTPlugins: () => Promise<VSTPlugin[]>;
  scanVSTPlugins: () => Promise<VSTPlugin[]>;
  getAudioDevices: () => Promise<AudioDevice[]>;
  setAudioSettings: (settings: AudioSettings) => Promise<void>;
  getAudioSettings: () => Promise<AudioSettings>;
  audioCacheStats: () => Promise<AudioCacheStats>;
  openFileDialog: (options?: { filters?: Array<{ name: string; extensions: string[] }>; multiple?: boolean }) => Promise<string[]>;
  saveFileDialog: (options?: { defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }> }) => Promise<string | null>;
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
  showNotification: (title: string, body: string) => void;
  onUpdateAvailable: (cb: (info: UpdateInfo) => void) => void;
  onDeepLink: (cb: (url: string) => void) => void;
  onMenuAction: (cb: (action: string) => void) => void;
  onPowerEvent: (cb: (event: string) => void) => void;
  onPerfStats: (cb: (data: DebugPerfStats) => void) => void;
  removeListener: (channel: string) => void;
  removeAllListeners: (channel: string) => void;
  debugGetPerfStats: () => Promise<DebugPerfStats>;
  debugGetBuildInfo: () => Promise<DebugBuildInfo>;
  debugGetAppPaths: () => Promise<DebugAppPaths>;
  debugOpenDevTools: () => Promise<void>;
  debugListCrashLogs: () => Promise<DebugCrashLog[]>;
  debugClearCrashLogs: () => Promise<number>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

import { useCallback, useEffect, useState } from 'react';

const _noop = () => {};

const webFallbacks: ElectronAPI = {
  isElectron: false,
  platform: 'web',
  version: '0.0.0',
  appVersion: '0.0.0',
  openExternal: (url: string) => { window.open(url, '_blank', 'noopener'); return Promise.resolve(); },
  minimize: _noop,
  maximize: _noop,
  close: _noop,
  isMaximized: () => Promise.resolve(false),
  toggleDevTools: _noop,
  setAlwaysOnTop: () => Promise.resolve(),
  getSystemInfo: (): Promise<SystemInfo> => Promise.resolve({ platform: 'web', arch: 'unknown', cpus: 0, totalMemory: 0, freeMemory: 0, hostname: 'browser' }),
  getPerformanceMetrics: (): Promise<PerformanceMetrics> => Promise.resolve({ cpuUsage: 0, memoryUsage: 0, audioBufferLoad: 0, diskReadSpeed: 0, uptime: 0 }),
  checkUpdate: (): Promise<UpdateInfo> => Promise.resolve({ hasUpdate: false, version: '1.0.0' }),
  getMidiDevices: (): Promise<MidiDevices> => Promise.resolve({ inputs: [], outputs: [], total: 0 }),
  getVSTPlugins: (): Promise<VSTPlugin[]> => Promise.resolve([]),
  scanVSTPlugins: (): Promise<VSTPlugin[]> => Promise.resolve([]),
  getAudioDevices: (): Promise<AudioDevice[]> => Promise.resolve([]),
  setAudioSettings: (): Promise<void> => Promise.resolve(),
  getAudioSettings: (): Promise<AudioSettings> => Promise.resolve({ sampleRate: 44100, bufferSize: 256, outputDevice: 'default', inputDevice: 'default', latencyMode: 'normal' }),
  audioCacheStats: (): Promise<AudioCacheStats> => Promise.resolve({ totalSizeMB: 0, entryCount: 0 }),
  openFileDialog: (): Promise<string[]> => Promise.resolve([]),
  saveFileDialog: (): Promise<string | null> => Promise.resolve(null),
  readFile: (): Promise<string> => Promise.resolve(''),
  writeFile: (): Promise<void> => Promise.resolve(),
  showNotification: _noop,
  onUpdateAvailable: (_cb: (info: UpdateInfo) => void) => _noop(),
  onDeepLink: (_cb: (url: string) => void) => _noop(),
  onMenuAction: (_cb: (action: string) => void) => _noop(),
  onPowerEvent: (_cb: (event: string) => void) => _noop(),
  onPerfStats: (_cb: (data: DebugPerfStats) => void) => _noop(),
  removeListener: (_channel: string) => _noop(),
  removeAllListeners: (_channel: string) => _noop(),
  debugGetPerfStats: (): Promise<DebugPerfStats> => Promise.resolve({ cpuPercent: 0, memUsedMB: 0, memTotalMB: 0, memPercent: 0, processMemMB: 0, uptimeSec: 0, pid: 0, cpuCount: 0, cpuModel: 'N/A' }),
  debugGetBuildInfo: (): Promise<DebugBuildInfo> => Promise.resolve({ version: '0.0.0', buildDate: '', platform: 'web', arch: 'unknown', electron: '', node: '', chrome: '', isDev: false, channel: 'web' }),
  debugGetAppPaths: (): Promise<DebugAppPaths> => Promise.resolve({ userData: '', logs: '', temp: '', downloads: '', appPath: '', crashDir: '' }),
  debugOpenDevTools: () => Promise.resolve(),
  debugListCrashLogs: (): Promise<DebugCrashLog[]> => Promise.resolve([]),
  debugClearCrashLogs: (): Promise<number> => Promise.resolve(0),
};

export function useElectron() {
  const isElectron = typeof window !== 'undefined' && Boolean(window.electronAPI?.isElectron);
  const api = isElectron ? window.electronAPI! : null;

  return {
    isElectron,
    platform:              api?.platform              ?? webFallbacks.platform,
    version:               api?.version               ?? webFallbacks.version,
    appVersion:            api?.appVersion            ?? webFallbacks.appVersion,
    openExternal:          api?.openExternal?.bind(api) ?? webFallbacks.openExternal,
    minimize:              api?.minimize              ?? webFallbacks.minimize,
    maximize:              api?.maximize              ?? webFallbacks.maximize,
    close:                 api?.close                 ?? webFallbacks.close,
    isMaximized:           api?.isMaximized           ?? webFallbacks.isMaximized,
    toggleDevTools:        api?.toggleDevTools        ?? webFallbacks.toggleDevTools,
    setAlwaysOnTop:        api?.setAlwaysOnTop        ?? webFallbacks.setAlwaysOnTop,
    getSystemInfo:         api?.getSystemInfo         ?? webFallbacks.getSystemInfo,
    getPerformanceMetrics: api?.getPerformanceMetrics ?? webFallbacks.getPerformanceMetrics,
    checkUpdate:           api?.checkUpdate           ?? webFallbacks.checkUpdate,
    getMidiDevices:        api?.getMidiDevices        ?? webFallbacks.getMidiDevices,
    getVSTPlugins:         api?.getVSTPlugins         ?? webFallbacks.getVSTPlugins,
    scanVSTPlugins:        api?.scanVSTPlugins        ?? webFallbacks.scanVSTPlugins,
    getAudioDevices:       api?.getAudioDevices       ?? webFallbacks.getAudioDevices,
    setAudioSettings:      api?.setAudioSettings      ?? webFallbacks.setAudioSettings,
    getAudioSettings:      api?.getAudioSettings      ?? webFallbacks.getAudioSettings,
    audioCacheStats:       api?.audioCacheStats       ?? webFallbacks.audioCacheStats,
    openFileDialog:        api?.openFileDialog        ?? webFallbacks.openFileDialog,
    saveFileDialog:        api?.saveFileDialog        ?? webFallbacks.saveFileDialog,
    readFile:              api?.readFile              ?? webFallbacks.readFile,
    writeFile:             api?.writeFile             ?? webFallbacks.writeFile,
    showNotification:      api?.showNotification      ?? webFallbacks.showNotification,
    onUpdateAvailable:     api?.onUpdateAvailable     ?? webFallbacks.onUpdateAvailable,
    onDeepLink:            api?.onDeepLink            ?? webFallbacks.onDeepLink,
    onMenuAction:          api?.onMenuAction          ?? webFallbacks.onMenuAction,
    onPowerEvent:          api?.onPowerEvent          ?? webFallbacks.onPowerEvent,
    onPerfStats:           api?.onPerfStats           ?? webFallbacks.onPerfStats,
    removeListener:        api?.removeListener        ?? webFallbacks.removeListener,
    removeAllListeners:    api?.removeAllListeners    ?? webFallbacks.removeAllListeners,
    debugGetPerfStats:     api?.debugGetPerfStats     ?? webFallbacks.debugGetPerfStats,
    debugGetBuildInfo:     api?.debugGetBuildInfo     ?? webFallbacks.debugGetBuildInfo,
    debugGetAppPaths:      api?.debugGetAppPaths      ?? webFallbacks.debugGetAppPaths,
    debugOpenDevTools:     api?.debugOpenDevTools     ?? webFallbacks.debugOpenDevTools,
    debugListCrashLogs:    api?.debugListCrashLogs    ?? webFallbacks.debugListCrashLogs,
    debugClearCrashLogs:   api?.debugClearCrashLogs   ?? webFallbacks.debugClearCrashLogs,
  };
}

export function useSystemInfo() {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const { getSystemInfo } = useElectron();
  useEffect(() => { getSystemInfo().then(setInfo).catch(_noop); }, [getSystemInfo]);
  return info;
}

export function usePerformanceMetrics(intervalMs = 2000) {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const { getPerformanceMetrics } = useElectron();
  useEffect(() => {
    getPerformanceMetrics().then(setMetrics).catch(_noop);
    const id = setInterval(() => getPerformanceMetrics().then(setMetrics).catch(_noop), intervalMs);
    return () => clearInterval(id);
  }, [getPerformanceMetrics, intervalMs]);
  return metrics;
}

export function useMidiDevices() {
  const [devices, setDevices] = useState<MidiDevices | null>(null);
  const { getMidiDevices } = useElectron();
  const refresh = useCallback(() => getMidiDevices().then(setDevices).catch(_noop), [getMidiDevices]);
  useEffect(() => { refresh(); }, [refresh]);
  return { devices, refresh };
}
