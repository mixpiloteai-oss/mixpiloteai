import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  // Window
  minimize:          () => ipcRenderer.invoke('minimize-window'),
  maximize:          () => ipcRenderer.invoke('maximize-window'),
  close:             () => ipcRenderer.invoke('close-window'),
  isMaximized:       () => ipcRenderer.invoke('is-maximized'),
  setAlwaysOnTop:    (f: boolean) => ipcRenderer.invoke('set-always-on-top', f),
  openExternal:      (url: string) => ipcRenderer.invoke('open-external', url),
  // System
  getSystemInfo:     () => ipcRenderer.invoke('get-system-info'),
  checkUpdate:       () => ipcRenderer.invoke('check-update'),
  downloadUpdate:    () => ipcRenderer.invoke('download-update'),
  installUpdate:     () => ipcRenderer.invoke('install-update'),
  getVersion:        () => ipcRenderer.invoke('get-version'),
  // MIDI
  getMidiDevices:    () => ipcRenderer.invoke('get-midi-devices'),
  // VST
  scanVSTPlugins:    () => ipcRenderer.invoke('scan-vst-plugins'),
  getVSTPlugins:     () => ipcRenderer.invoke('get-vst-plugins'),
  // Projects
  saveProject:       (data: unknown) => ipcRenderer.invoke('save-project', data),
  loadProject:       () => ipcRenderer.invoke('load-project'),
  // Offline store
  offlineSave:       (id: string, data: unknown) => ipcRenderer.invoke('offline-save', id, data),
  offlineLoad:       (id: string) => ipcRenderer.invoke('offline-load', id),
  offlineList:       () => ipcRenderer.invoke('offline-list'),
  offlineDelete:     (id: string) => ipcRenderer.invoke('offline-delete', id),
  // Settings
  saveSetting:       (key: string, val: unknown) => ipcRenderer.invoke('settings-set', key, val),
  loadSetting:       (key: string) => ipcRenderer.invoke('settings-get', key),
  settingsGet:       (key: string) => ipcRenderer.invoke('settings-get', key),
  settingsSet:       (key: string, val: unknown) => ipcRenderer.invoke('settings-set', key, val),
  settingsGetAll:    () => ipcRenderer.invoke('settings-get-all'),
  settingsReset:     (key: string) => ipcRenderer.invoke('settings-reset', key),
  // Autosave
  autosaveSetData:       (data: unknown) => ipcRenderer.invoke('autosave-set-data', data),
  autosaveSaveNow:       (data: unknown) => ipcRenderer.invoke('autosave-save-now', data),
  autosaveLoadLatest:    () => ipcRenderer.invoke('autosave-load-latest'),
  autosaveListVersions:  () => ipcRenderer.invoke('autosave-list-versions'),
  autosaveGetStatus:     () => ipcRenderer.invoke('autosave-get-status'),
  // Crash
  crashCheck:             () => ipcRenderer.invoke('crash-check'),
  crashClearCheckpoint:   () => ipcRenderer.invoke('crash-clear-checkpoint'),
  crashSaveCheckpoint:    (data: unknown) => ipcRenderer.invoke('crash-save-checkpoint', data),
  autosaveGetVersion:     (filename: string) => ipcRenderer.invoke('autosave-get-version', filename),
  autosaveDeleteVersion:  (filename: string) => ipcRenderer.invoke('autosave-delete-version', filename),
  // Audio
  getAudioDevices:        () => ipcRenderer.invoke('get-audio-devices'),
  getLatencyProfiles:     () => ipcRenderer.invoke('get-latency-profiles'),
  getAudioSettings:       () => ipcRenderer.invoke('get-audio-settings'),
  setAudioSettings:       (s: unknown) => ipcRenderer.invoke('set-audio-settings', s),
  audioCacheIsCached:     (url: string) => ipcRenderer.invoke('audio-cache-is-cached', url),
  audioCacheGetPath:      (url: string) => ipcRenderer.invoke('audio-cache-get-path', url),
  audioCacheFetch:        (url: string) => ipcRenderer.invoke('audio-cache-fetch', url),
  audioCacheStore:        (url: string, p: string) => ipcRenderer.invoke('audio-cache-store', url, p),
  audioCacheEvict:        (url: string) => ipcRenderer.invoke('audio-cache-evict', url),
  audioCacheStats:        () => ipcRenderer.invoke('audio-cache-stats'),
  audioCacheList:         () => ipcRenderer.invoke('audio-cache-list'),
  audioCachePrune:        () => ipcRenderer.invoke('audio-cache-prune'),
  audioCacheClear:        () => ipcRenderer.invoke('audio-cache-clear'),
  // ── Native audio engine ─────────────────────────────────────────────────
  audioEngineStart:     (opts?: unknown) => ipcRenderer.invoke('audio-engine-start', opts),
  audioEngineStop:      ()               => ipcRenderer.invoke('audio-engine-stop'),
  audioEngineReady:     ()               => ipcRenderer.invoke('audio-engine-ready'),
  audioDetectDrivers:   ()               => ipcRenderer.invoke('audio-detect-drivers'),
  audioDetectDevices:   ()               => ipcRenderer.invoke('audio-detect-devices'),
  audioPreferredDriver: ()               => ipcRenderer.invoke('audio-preferred-driver'),
  audioPlay:            ()               => ipcRenderer.invoke('audio-play'),
  audioStop:            ()               => ipcRenderer.invoke('audio-stop'),
  audioPause:           ()               => ipcRenderer.invoke('audio-pause'),
  audioSeek:            (bar: number, beat?: number) => ipcRenderer.invoke('audio-seek', bar, beat),
  audioSetBpm:          (bpm: number)    => ipcRenderer.invoke('audio-set-bpm', bpm),
  audioSetTimeSig:      (n: number, d: number) => ipcRenderer.invoke('audio-set-time-sig', n, d),
  audioSetLoop:         (e: boolean, s: number, en: number) => ipcRenderer.invoke('audio-set-loop', e, s, en),
  audioGetState:        ()               => ipcRenderer.invoke('audio-get-state'),
  audioSetMasterGain:   (db: number)     => ipcRenderer.invoke('audio-set-master-gain', db),
  audioAddTrack:        (id: string, type: string, name: string, color?: string) => ipcRenderer.invoke('audio-add-track', id, type, name, color),
  audioRemoveTrack:     (id: string)     => ipcRenderer.invoke('audio-remove-track', id),
  audioSetTrackGain:    (id: string, db: number)  => ipcRenderer.invoke('audio-set-track-gain', id, db),
  audioSetTrackPan:     (id: string, pan: number) => ipcRenderer.invoke('audio-set-track-pan',  id, pan),
  audioMuteTrack:       (id: string, m: boolean)  => ipcRenderer.invoke('audio-mute-track', id, m),
  audioSoloTrack:       (id: string, s: boolean)  => ipcRenderer.invoke('audio-solo-track', id, s),
  audioArmTrack:        (id: string, a: boolean)  => ipcRenderer.invoke('audio-arm-track',  id, a),
  audioAddSend:         (from: string, to: string, db: number, pre: boolean) => ipcRenderer.invoke('audio-add-send', from, to, db, pre),
  audioSetDriver:       (driver: string, device: string) => ipcRenderer.invoke('audio-set-driver', driver, device),
  audioSetBufferSize:   (frames: number) => ipcRenderer.invoke('audio-set-buffer-size', frames),
  audioSetSampleRate:   (rate: number)   => ipcRenderer.invoke('audio-set-sample-rate', rate),
  audioQueryDevices:    ()               => ipcRenderer.invoke('audio-query-devices'),
  onNativeAudioEvent:   (cb: (evt: unknown) => void) => ipcRenderer.on('native-audio-event', (_e, evt) => cb(evt)),
  // File system
  openFileDialog:         (opts: unknown) => ipcRenderer.invoke('open-file-dialog', opts),
  saveFileDialog:         (opts: unknown) => ipcRenderer.invoke('save-file-dialog', opts),
  readFile:               (p: string) => ipcRenderer.invoke('read-file', p),
  writeFile:              (p: string, content: string) => ipcRenderer.invoke('write-file', p, content),
  showNotification:       (title: string, body: string) => ipcRenderer.invoke('show-notification', title, body),
  // Debug
  debugGetBuildInfo:      () => ipcRenderer.invoke('debug-get-build-info'),
  debugGetPerfStats:      () => ipcRenderer.invoke('debug-get-perf-stats'),
  debugListCrashLogs:     () => ipcRenderer.invoke('debug-list-crash-logs'),
  debugClearCrashLogs:    () => ipcRenderer.invoke('debug-clear-crash-logs'),
  debugWriteCrashLog:     (type: string, msg: string, ctx: unknown) => ipcRenderer.invoke('debug-write-crash-log', type, msg, ctx),
  debugGetCrashDir:       () => ipcRenderer.invoke('debug-crash-dir'),
  debugOpenDevTools:      () => ipcRenderer.invoke('debug-open-devtools'),
  debugGetAppPaths:       () => ipcRenderer.invoke('debug-get-app-paths'),
  getPerformanceMetrics:  () => ipcRenderer.invoke('get-performance-metrics'),
  // Plugin system
  pluginScan:               ()                          => ipcRenderer.invoke('plugin-scan'),
  pluginLoad:               (path: string, fmt: string) => ipcRenderer.invoke('plugin-load', path, fmt),
  pluginUnload:             (instanceId: string)        => ipcRenderer.invoke('plugin-unload', instanceId),
  pluginGetInstances:       ()                          => ipcRenderer.invoke('plugin-get-instances'),
  pluginGetBlacklist:       ()                          => ipcRenderer.invoke('plugin-get-blacklist'),
  pluginRemoveFromBlacklist:(path: string)              => ipcRenderer.invoke('plugin-remove-from-blacklist', path),
  pluginListPresets:        (pluginId: string)          => ipcRenderer.invoke('plugin-list-presets', pluginId),
  pluginSavePreset:         (pluginId: string, name: string, data: Record<string, number>) => ipcRenderer.invoke('plugin-save-preset', pluginId, name, data),
  pluginLoadPreset:         (pluginId: string, presetId: string) => ipcRenderer.invoke('plugin-load-preset', pluginId, presetId),
  pluginDeletePreset:       (pluginId: string, presetId: string) => ipcRenderer.invoke('plugin-delete-preset', pluginId, presetId),
  pluginRenamePreset:       (pluginId: string, presetId: string, name: string) => ipcRenderer.invoke('plugin-rename-preset', pluginId, presetId, name),
  onPluginCrashed:          (cb: (info: unknown) => void) => ipcRenderer.on('plugin-crashed', (_e, i) => cb(i)),
  // Events from main
  onNav:                    (cb: (view: string) => void) => ipcRenderer.on('nav', (_e, v) => cb(v)),
  onOpenSettings:           (cb: () => void) => ipcRenderer.on('open-settings', cb),
  onPowerEvent:             (cb: (e: string) => void) => ipcRenderer.on('power-event', (_e, ev) => cb(ev)),
  onUpdateChecking:         (cb: (info: unknown) => void) => ipcRenderer.on('update-checking', (_e, i) => cb(i)),
  onUpdateAvailable:        (cb: (info: unknown) => void) => ipcRenderer.on('update-available', (_e, i) => cb(i)),
  onUpdateNotAvailable:     (cb: (info: unknown) => void) => ipcRenderer.on('update-not-available', (_e, i) => cb(i)),
  onUpdateProgress:         (cb: (info: unknown) => void) => ipcRenderer.on('update-progress', (_e, i) => cb(i)),
  onUpdateDownloaded:       (cb: (info: unknown) => void) => ipcRenderer.on('update-downloaded', (_e, i) => cb(i)),
  onUpdateError:            (cb: (info: unknown) => void) => ipcRenderer.on('update-error', (_e, i) => cb(i)),
  onUpdateIntegrityReady:   (cb: (info: unknown) => void) => ipcRenderer.on('update-integrity-ready', (_e, i) => cb(i)),
  // Version management
  versionHistory:           () => ipcRenderer.invoke('version-history'),
  versionCanRollback:       () => ipcRenderer.invoke('version-can-rollback'),
  versionRollback:          () => ipcRenderer.invoke('version-rollback'),
  // Integrity
  verifyUpdateFile:         (filePath: string, sha256: string) => ipcRenderer.invoke('verify-update-file', filePath, sha256),
  onTriggerSave:            (cb: () => void) => ipcRenderer.on('trigger-save', cb),
  onTriggerLoad:            (cb: () => void) => ipcRenderer.on('trigger-load', cb),
  onAutosaveComplete:       (cb: (info: unknown) => void) => ipcRenderer.on('autosave-complete', (_e, i) => cb(i)),
  onCrashRecoveryAvailable: (cb: (info: unknown) => void) => ipcRenderer.on('crash-recovery-available', (_e, i) => cb(i)),
  onDeepLink:               (cb: (url: string) => void) => ipcRenderer.on('deep-link', (_e, url) => cb(url)),
  onMenuAction:             (cb: (action: string) => void) => ipcRenderer.on('menu-action', (_e, a) => cb(a)),
  onPerfStats:              (cb: (stats: unknown) => void) => ipcRenderer.on('perf-stats', (_e, s) => cb(s)),
  removeAllListeners:       (channel: string) => ipcRenderer.removeAllListeners(channel),
  removeListener:           (channel: string) => ipcRenderer.removeAllListeners(channel),
  // Platform
  platform:    process.platform,
  isElectron:  true as const,
  // Crash reporting (typed namespace — does NOT expose raw ipcRenderer)
  crash: {
    report: (payload: {
      source:  'main' | 'renderer' | 'plugin' | 'audio'
      message: string
      stack?:  string
      meta?:   Record<string, unknown>
    }) => ipcRenderer.invoke('crash:report', payload),
    list: (limit?: number) => ipcRenderer.invoke('crash:list', limit),
  },
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('electronAPI', api)
  } catch (e) {
    console.error(e)
  }
} else {
  // @ts-expect-error global
  window.electron = electronAPI
  // @ts-expect-error global
  window.electronAPI = api
}
