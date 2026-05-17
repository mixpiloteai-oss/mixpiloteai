'use strict';
// ============================================================
// NeuroTek AI — Crash Logger
// Writes structured crash/error logs to userData/crash-logs/
// ============================================================
const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

function getCrashDir() {
  try { return path.join(app.getPath('userData'), 'crash-logs'); }
  catch { return path.join(os.homedir(), '.neurotek-ai', 'crash-logs'); }
}

function writeCrashLog(type, errorOrMsg, context = {}) {
  const dir = getCrashDir();
  try {
    fs.mkdirSync(dir, { recursive: true });
    const timestamp = new Date().toISOString();
    const slug = timestamp.replace(/[:.]/g, '-').slice(0, 23);
    const filename = `crash-${slug}-${type}.json`;
    const entry = {
      timestamp,
      type,
      message: typeof errorOrMsg === 'string' ? errorOrMsg : (errorOrMsg?.message ?? String(errorOrMsg)),
      stack: typeof errorOrMsg === 'object' ? (errorOrMsg?.stack ?? null) : null,
      context,
      system: {
        platform: process.platform,
        arch: process.arch,
        node: process.versions.node,
        electron: process.versions.electron,
        chrome: process.versions.chrome,
        cpus: os.cpus().length,
        totalMemMB: Math.round(os.totalmem() / 1024 / 1024),
        freeMemMB: Math.round(os.freemem() / 1024 / 1024),
        osRelease: os.release(),
      },
    };
    fs.writeFileSync(path.join(dir, filename), JSON.stringify(entry, null, 2), 'utf-8');
    return filename;
  } catch (err) {
    console.error('[CrashLogger] Failed to write log:', err.message);
    return null;
  }
}

function listCrashLogs(limit = 20) {
  const dir = getCrashDir();
  if (!fs.existsSync(dir)) return [];
  try {
    return fs.readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse()
      .slice(0, limit)
      .map(f => {
        try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')); }
        catch { return null; }
      })
      .filter(Boolean);
  } catch { return []; }
}

function clearCrashLogs() {
  const dir = getCrashDir();
  if (!fs.existsSync(dir)) return 0;
  try {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    files.forEach(f => { try { fs.unlinkSync(path.join(dir, f)); } catch {} });
    return files.length;
  } catch { return 0; }
}

function getCrashDir_public() { return getCrashDir(); }

module.exports = { writeCrashLog, listCrashLogs, clearCrashLogs, getCrashDir: getCrashDir_public };
