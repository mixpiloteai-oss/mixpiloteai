// ============================================================
// NEUROTEK AI — Desktop Settings Manager
// Persists all application preferences using electron-store
// ============================================================
'use strict';

let Store;
try { Store = require('electron-store'); } catch (_) { Store = null; }

const DEFAULTS = {
  // Audio
  audioOutputDevice: 'default',
  audioInputDevice: 'default',
  sampleRate: 48000,
  bufferSize: 256,
  latencyProfile: 'med',

  // MIDI
  midiInputDevice: null,
  midiOutputDevice: null,
  midiClockOut: false,

  // UI
  theme: 'dark',
  sidebarCollapsed: false,
  showVuMeters: true,
  showSpectrumInHeader: false,
  animationsEnabled: true,
  fontSize: 'md',

  // Studio
  defaultBpm: 140,
  defaultKey: 'C',
  defaultTimeSignature: '4/4',
  metronomeEnabled: false,
  metronomeVolume: 0.5,

  // Autosave
  autosaveEnabled: true,
  autosaveIntervalMs: 30000,

  // Window
  windowBounds: null,
  alwaysOnTop: false,
  startMaximized: false,

  // Notifications
  showDesktopNotifications: true,
};

let _store = null;

function getStore() {
  if (!_store && Store) {
    try {
      _store = new Store({
        name: 'mixpiloteai-settings',
        defaults: DEFAULTS,
        schema: {
          sampleRate:    { type: 'number', enum: [44100, 48000, 88200, 96000] },
          bufferSize:    { type: 'number', enum: [64, 128, 256, 512, 1024] },
          theme:         { type: 'string', enum: ['dark', 'darker', 'midnight'] },
          autosaveIntervalMs: { type: 'number', minimum: 5000, maximum: 300000 },
        },
      });
    } catch (err) {
      console.error('[DesktopSettings] Store init error:', err.message);
      _store = null;
    }
  }
  return _store;
}

// ── Fallback: in-memory ──────────────────────────────────────
const memStore = { ...DEFAULTS };

function get(key) {
  const s = getStore();
  if (s) {
    try { return s.get(key); } catch (_) {}
  }
  return key in memStore ? memStore[key] : null;
}

function set(key, value) {
  const s = getStore();
  if (s) {
    try { s.set(key, value); return true; } catch (_) {}
  }
  memStore[key] = value;
  return true;
}

function getAll() {
  const s = getStore();
  if (s) {
    try { return s.store; } catch (_) {}
  }
  return { ...memStore };
}

function reset(key) {
  const s = getStore();
  if (s) {
    try {
      if (key) { s.set(key, DEFAULTS[key]); }
      else { s.clear(); Object.assign(memStore, DEFAULTS); }
      return true;
    } catch (_) {}
  }
  if (key) memStore[key] = DEFAULTS[key];
  else Object.assign(memStore, DEFAULTS);
  return true;
}

module.exports = { get, set, getAll, reset, DEFAULTS };
