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
  getSystemInfo: () => Promise<SystemInfo>;
  getPerformanceMetrics: () => Promise<PerformanceMetrics>;
  checkUpdate: () => Promise<UpdateInfo>;
  getMidiDevices: () => Promise<MidiDevices>;
  getVSTPlugins: () => Promise<VSTPlugin[]>;
  getAudioDevices: () => Promise<AudioDevice[]>;
  setAudioSettings: (settings: AudioSettings) => Promise<void>;
  getAudioSettings: () => Promise<AudioSettings>;
  openFileDialog: (options?: { filters?: Array<{ name: string; extensions: string[] }>; multiple?: boolean }) => Promise<string[]>;
  saveFileDialog: (options?: { defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }> }) => Promise<string | null>;
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
  showNotification: (title: string, body: string) => void;
  onUpdateAvailable: (cb: (info: UpdateInfo) => void) => void;
  onDeepLink: (cb: (url: string) => void) => void;
  onMenuAction: (cb: (action: string) => void) => void;
  removeListener: (channel: string) => void;
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
  getSystemInfo: (): Promise<SystemInfo> => Promise.resolve({ platform: 'web', arch: 'unknown', cpus: 0, totalMemory: 0, freeMemory: 0, hostname: 'browser' }),
  getPerformanceMetrics: (): Promise<PerformanceMetrics> => Promise.resolve({ cpuUsage: 0, memoryUsage: 0, audioBufferLoad: 0, diskReadSpeed: 0, uptime: 0 }),
  checkUpdate: (): Promise<UpdateInfo> => Promise.resolve({ hasUpdate: false, version: '1.0.0' }),
  getMidiDevices: (): Promise<MidiDevices> => Promise.resolve({ inputs: [], outputs: [], total: 0 }),
  getVSTPlugins: (): Promise<VSTPlugin[]> => Promise.resolve([]),
  getAudioDevices: (): Promise<AudioDevice[]> => Promise.resolve([]),
  setAudioSettings: (): Promise<void> => Promise.resolve(),
  getAudioSettings: (): Promise<AudioSettings> => Promise.resolve({ sampleRate: 44100, bufferSize: 256, outputDevice: 'default', inputDevice: 'default', latencyMode: 'normal' }),
  openFileDialog: (): Promise<string[]> => Promise.resolve([]),
  saveFileDialog: (): Promise<string | null> => Promise.resolve(null),
  readFile: (): Promise<string> => Promise.resolve(''),
  writeFile: (): Promise<void> => Promise.resolve(),
  showNotification: _noop,
  onUpdateAvailable: (_cb: (info: UpdateInfo) => void) => _noop(),
  onDeepLink: (_cb: (url: string) => void) => _noop(),
  onMenuAction: (_cb: (action: string) => void) => _noop(),
  removeListener: (_channel: string) => _noop(),
};

export function useElectron() {
  const isElectron = typeof window !== 'undefined' && Boolean(window.electronAPI?.isElectron);
  const api = isElectron ? window.electronAPI! : null;

  return {
    isElectron,
    platform:                  api?.platform                  ?? webFallbacks.platform,
    version:                   api?.version                   ?? webFallbacks.version,
    appVersion:                api?.appVersion                ?? webFallbacks.appVersion,
    openExternal:              api?.openExternal?.bind(api)   ?? webFallbacks.openExternal,
    minimize:                  api?.minimize                  ?? webFallbacks.minimize,
    maximize:                  api?.maximize                  ?? webFallbacks.maximize,
    close:                     api?.close                     ?? webFallbacks.close,
    isMaximized:               api?.isMaximized               ?? webFallbacks.isMaximized,
    toggleDevTools:            api?.toggleDevTools            ?? webFallbacks.toggleDevTools,
    getSystemInfo:             api?.getSystemInfo             ?? webFallbacks.getSystemInfo,
    getPerformanceMetrics:     api?.getPerformanceMetrics     ?? webFallbacks.getPerformanceMetrics,
    checkUpdate:               api?.checkUpdate                ?? webFallbacks.checkUpdate,
    getMidiDevices:            api?.getMidiDevices            ?? webFallbacks.getMidiDevices,
    getVSTPlugins:             api?.getVSTPlugins             ?? webFallbacks.getVSTPlugins,
    getAudioDevices:           api?.getAudioDevices           ?? webFallbacks.getAudioDevices,
    setAudioSettings:          api?.setAudioSettings          ?? webFallbacks.setAudioSettings,
    getAudioSettings:          api?.getAudioSettings          ?? webFallbacks.getAudioSettings,
    openFileDialog:            api?.openFileDialog            ?? webFallbacks.openFileDialog,
    saveFileDialog:            api?.saveFileDialog            ?? webFallbacks.saveFileDialog,
    readFile:                  api?.readFile                  ?? webFallbacks.readFile,
    writeFile:                 api?.writeFile                 ?? webFallbacks.writeFile,
    showNotification:          api?.showNotification          ?? webFallbacks.showNotification,
    onUpdateAvailable:         api?.onUpdateAvailable         ?? webFallbacks.onUpdateAvailable,
    onDeepLink:                api?.onDeepLink                ?? webFallbacks.onDeepLink,
    onMenuAction:              api?.onMenuAction              ?? webFallbacks.onMenuAction,
    removeListener:            api?.removeListener            ?? webFallbacks.removeListener,
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
