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

  // ── Event listeners from main process ────────────────────
  onNav: (cb) => ipcRenderer.on('nav', (_event, view) => cb(view)),
  onOpenSettings: (cb) => ipcRenderer.on('open-settings', () => cb()),
  onPowerEvent: (cb) => ipcRenderer.on('power-event', (_event, event) => cb(event)),
  onUpdateAvailable: (cb) => ipcRenderer.on('update-available', (_event, info) => cb(info)),
  onTriggerSave: (cb) => ipcRenderer.on('trigger-save', () => cb()),
  onTriggerLoad: (cb) => ipcRenderer.on('trigger-load', () => cb()),
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),

  // ── Platform info (sync, safe) ───────────────────────────
  platform: process.platform,
  isElectron: true,
});
