// ============================================================
// NEUROTEK AI — Autosave Manager
// Periodic project autosave with crash recovery checkpoint
// ============================================================
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const AUTOSAVE_DIR = path.join(os.homedir(), '.mixpiloteai', 'autosave');
const AUTOSAVE_FILE = path.join(AUTOSAVE_DIR, 'autosave.ntai');
const CRASH_CHECKPOINT = path.join(AUTOSAVE_DIR, 'crash_checkpoint.ntai');
const LOCK_FILE = path.join(AUTOSAVE_DIR, '.session_lock');
const MAX_AUTOSAVE_VERSIONS = 5;

let autosaveTimer = null;
let lastSaveTime = null;
let pendingData = null;
let mainWindowRef = null;

function ensureDir() {
  if (!fs.existsSync(AUTOSAVE_DIR)) {
    fs.mkdirSync(AUTOSAVE_DIR, { recursive: true });
  }
}

// ── Session lock (crash detection) ──────────────────────────
function writeLock() {
  ensureDir();
  fs.writeFileSync(LOCK_FILE, JSON.stringify({
    pid: process.pid,
    startTime: Date.now(),
    version: require('../package.json').version,
  }), 'utf-8');
}

function clearLock() {
  try { if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE); } catch (_) {}
}

function wasCrash() {
  if (!fs.existsSync(LOCK_FILE)) return false;
  try {
    const lock = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf-8'));
    // If lock from a different PID exists, it means previous session didn't clean up
    return lock.pid !== process.pid;
  } catch (_) {
    return true;
  }
}

// ── Checkpoint (written on every autosave) ───────────────────
function writeCheckpoint(data) {
  ensureDir();
  try {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    fs.writeFileSync(CRASH_CHECKPOINT, payload, 'utf-8');
  } catch (err) {
    console.error('[Autosave] Failed to write checkpoint:', err.message);
  }
}

function readCheckpoint() {
  try {
    if (!fs.existsSync(CRASH_CHECKPOINT)) return null;
    const raw = fs.readFileSync(CRASH_CHECKPOINT, 'utf-8');
    try { return JSON.parse(raw); } catch (_) { return raw; }
  } catch (_) {
    return null;
  }
}

function clearCheckpoint() {
  try { if (fs.existsSync(CRASH_CHECKPOINT)) fs.unlinkSync(CRASH_CHECKPOINT); } catch (_) {}
}

// ── Versioned autosave ───────────────────────────────────────
function saveVersioned(data) {
  ensureDir();
  const payload = typeof data === 'string' ? data : JSON.stringify(data, null, 2);

  // Rotate versions: autosave.4 → del, .3→.4, .2→.3, .1→.2, .ntai→.1
  for (let i = MAX_AUTOSAVE_VERSIONS - 1; i >= 1; i--) {
    const from = i === 1 ? AUTOSAVE_FILE : `${AUTOSAVE_FILE}.${i - 1}`;
    const to = `${AUTOSAVE_FILE}.${i}`;
    try { if (fs.existsSync(from)) fs.renameSync(from, to); } catch (_) {}
  }

  fs.writeFileSync(AUTOSAVE_FILE, payload, 'utf-8');
  lastSaveTime = Date.now();
}

function loadLatestAutosave() {
  try {
    if (!fs.existsSync(AUTOSAVE_FILE)) return null;
    const raw = fs.readFileSync(AUTOSAVE_FILE, 'utf-8');
    try { return { data: JSON.parse(raw), time: fs.statSync(AUTOSAVE_FILE).mtimeMs }; }
    catch (_) { return { data: raw, time: Date.now() }; }
  } catch (_) { return null; }
}

function listAutosaveVersions() {
  ensureDir();
  const versions = [];
  if (fs.existsSync(AUTOSAVE_FILE)) {
    versions.push({ index: 0, path: AUTOSAVE_FILE, time: fs.statSync(AUTOSAVE_FILE).mtimeMs });
  }
  for (let i = 1; i < MAX_AUTOSAVE_VERSIONS; i++) {
    const p = `${AUTOSAVE_FILE}.${i}`;
    if (fs.existsSync(p)) {
      versions.push({ index: i, path: p, time: fs.statSync(p).mtimeMs });
    }
  }
  return versions;
}

// ── Autosave loop ────────────────────────────────────────────
function triggerSave() {
  if (!pendingData) return;
  const data = pendingData;
  pendingData = null;
  saveVersioned(data);
  writeCheckpoint(data);
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.webContents.send('autosave-complete', { time: lastSaveTime });
  }
}

function start(mainWindow, intervalMs = 30000) {
  mainWindowRef = mainWindow;
  writeLock();
  if (autosaveTimer) clearInterval(autosaveTimer);
  autosaveTimer = setInterval(triggerSave, intervalMs);
}

function stop() {
  if (autosaveTimer) { clearInterval(autosaveTimer); autosaveTimer = null; }
  triggerSave(); // flush pending
  clearLock();
}

function setPendingData(data) {
  pendingData = data;
}

function getStatus() {
  return { lastSaveTime, hasPending: pendingData !== null, autosaveDir: AUTOSAVE_DIR };
}

module.exports = {
  start, stop, setPendingData, getStatus,
  saveVersioned, loadLatestAutosave, listAutosaveVersions,
  writeCheckpoint, readCheckpoint, clearCheckpoint,
  wasCrash, writeLock, clearLock,
};
