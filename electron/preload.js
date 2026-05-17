// ============================================================
// NEUROTEK AI — Electron Preload Script
// Secure bridge between main process and renderer via contextBridge
// ============================================================
'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ── System ───────────────────────────────────────────────
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  checkUpdate: () => ipcRenderer.invoke('check-update'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // ── Window controls ──────────────────────────────────────
  minimize: () => ipcRenderer.invoke('minimize-window'),
  maximize: () => ipcRenderer.invoke('maximize-window'),
  close: () => ipcRenderer.invoke('close-window'),
  setAlwaysOnTop: (flag) => ipcRenderer.invoke('set-always-on-top', flag),

  // ── MIDI ─────────────────────────────────────────────────
  getMidiDevices: () => ipcRenderer.invoke('get-midi-devices'),

  // ── VST ──────────────────────────────────────────────────
  scanVSTPlugins: () => ipcRenderer.invoke('scan-vst-plugins'),

  // ── Projects (file system) ───────────────────────────────
  saveProject: (data) => ipcRenderer.invoke('save-project', data),
  loadProject: () => ipcRenderer.invoke('load-project'),

  // ── Offline store ─────────────────────────────────────────
  offlineSave:   (id, data) => ipcRenderer.invoke('offline-save', id, data),
  offlineLoad:   (id)       => ipcRenderer.invoke('offline-load', id),
  offlineList:   ()         => ipcRenderer.invoke('offline-list'),
  offlineDelete: (id)       => ipcRenderer.invoke('offline-delete', id),
  saveSetting:   (key, val) => ipcRenderer.invoke('save-setting', key, val),
  loadSetting:   (key)      => ipcRenderer.invoke('load-setting', key),

  // ── Autosave ─────────────────────────────────────────────
  autosaveSetData:       (data)     => ipcRenderer.invoke('autosave-set-data', data),
  autosaveSaveNow:       (data)     => ipcRenderer.invoke('autosave-save-now', data),
  autosaveLoadLatest:    ()         => ipcRenderer.invoke('autosave-load-latest'),
  autosaveListVersions:  ()         => ipcRenderer.invoke('autosave-list-versions'),
  autosaveGetStatus:     ()         => ipcRenderer.invoke('autosave-get-status'),

  // ── Crash recovery ───────────────────────────────────────
  crashCheck:            ()         => ipcRenderer.invoke('crash-check'),
  crashClearCheckpoint:  ()         => ipcRenderer.invoke('crash-clear-checkpoint'),

  // ── Audio devices ─────────────────────────────────────────
  getAudioDevices:       ()         => ipcRenderer.invoke('get-audio-devices'),
  getLatencyProfiles:    ()         => ipcRenderer.invoke('get-latency-profiles'),

  // ── Desktop settings ─────────────────────────────────────
  settingsGet:           (key)      => ipcRenderer.invoke('settings-get', key),
  settingsSet:           (key, val) => ipcRenderer.invoke('settings-set', key, val),
  settingsGetAll:        ()         => ipcRenderer.invoke('settings-get-all'),
  settingsReset:         (key)      => ipcRenderer.invoke('settings-reset', key),

  // ── Event listeners from main process ────────────────────
  onNav: (cb) => ipcRenderer.on('nav', (_event, view) => cb(view)),
  onOpenSettings: (cb) => ipcRenderer.on('open-settings', () => cb()),
  onPowerEvent: (cb) => ipcRenderer.on('power-event', (_event, event) => cb(event)),
  onUpdateAvailable: (cb) => ipcRenderer.on('update-available', (_event, info) => cb(info)),
  onTriggerSave: (cb) => ipcRenderer.on('trigger-save', () => cb()),
  onTriggerLoad: (cb) => ipcRenderer.on('trigger-load', () => cb()),
  onAutosaveComplete: (cb) => ipcRenderer.on('autosave-complete', (_event, info) => cb(info)),
  onCrashRecoveryAvailable: (cb) => ipcRenderer.on('crash-recovery-available', (_event, info) => cb(info)),
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),

  // ── Audio cache ─────────────────────────────────────────────
  audioCacheIsCached:  (url)           => ipcRenderer.invoke('audio-cache-is-cached', url),
  audioCacheGetPath:   (url)           => ipcRenderer.invoke('audio-cache-get-path', url),
  audioCacheFetch:     (url)           => ipcRenderer.invoke('audio-cache-fetch', url),
  audioCacheStore:     (url, filePath) => ipcRenderer.invoke('audio-cache-store', url, filePath),
  audioCacheEvict:     (url)           => ipcRenderer.invoke('audio-cache-evict', url),
  audioCacheStats:     ()              => ipcRenderer.invoke('audio-cache-stats'),
  audioCacheList:      ()              => ipcRenderer.invoke('audio-cache-list'),
  audioCachePrune:     ()              => ipcRenderer.invoke('audio-cache-prune'),
  audioCacheClear:     ()              => ipcRenderer.invoke('audio-cache-clear'),

  // ── Diagnostics / Debug ───────────────────────────────────
  debugGetBuildInfo:    ()                  => ipcRenderer.invoke('debug-get-build-info'),
  debugGetPerfStats:    ()                  => ipcRenderer.invoke('debug-get-perf-stats'),
  debugListCrashLogs:   ()                  => ipcRenderer.invoke('debug-list-crash-logs'),
  debugClearCrashLogs:  ()                  => ipcRenderer.invoke('debug-clear-crash-logs'),
  debugWriteCrashLog:   (type, msg, ctx)    => ipcRenderer.invoke('debug-write-crash-log', type, msg, ctx),
  debugGetCrashDir:     ()                  => ipcRenderer.invoke('debug-crash-dir'),
  debugOpenDevTools:    ()                  => ipcRenderer.invoke('debug-open-devtools'),
  debugGetAppPaths:     ()                  => ipcRenderer.invoke('debug-get-app-paths'),
  onPerfStats: (cb)    => ipcRenderer.on('perf-stats', (_event, stats) => cb(stats)),

  // ── Platform info (sync, safe) ───────────────────────────
  platform: process.platform,
  isElectron: true,
});
