'use strict';
// ============================================================
// NeuroTek AI — Build Info
// Returns version, build date, platform metadata
// ============================================================
const path = require('path');

function getBuildInfo() {
  let version = '1.0.0-beta.1';
  let buildDate = null;
  try {
    const pkg = require(path.join(__dirname, '../../electron/package.json'));
    version = pkg.version ?? version;
  } catch {}
  return {
    version,
    buildDate: buildDate ?? new Date().toISOString().slice(0, 10),
    platform: process.platform,
    arch: process.arch,
    electron: process.versions.electron ?? 'unknown',
    node: process.versions.node ?? 'unknown',
    chrome: process.versions.chrome ?? 'unknown',
    isDev: process.env.NODE_ENV === 'development',
    channel: process.env.NODE_ENV === 'development' ? 'dev' : 'stable',
  };
}

module.exports = { getBuildInfo };
