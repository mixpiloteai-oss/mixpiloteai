'use strict';
// ============================================================
// NeuroTek AI — Build Info
// Returns version, build date, platform metadata
// ============================================================
const path = require('path');

const FALLBACK_VERSION = '1.0.0-beta.1';
const RELEASE_DATE = '2025-05-14';

function getBuildInfo() {
  let version = FALLBACK_VERSION;
  try {
    const pkg = require(path.join(__dirname, '../package.json'));
    version = pkg.version ?? version;
  } catch {}

  return {
    version,
    releaseDate: RELEASE_DATE,
    buildDate: new Date().toISOString().slice(0, 10),
    platform: process.platform,
    arch: process.arch,
    electron: process.versions.electron ?? 'unknown',
    node: process.versions.node ?? 'unknown',
    chrome: process.versions.chrome ?? 'unknown',
    isDev: process.env.NODE_ENV === 'development',
    channel: process.env.NODE_ENV === 'development' ? 'dev' : 'stable',
    installerName: `NeuroTek-AI-Setup-${version}.exe`,
    portableName: `NeuroTek-AI-Portable-${version}.exe`,
  };
}

module.exports = { getBuildInfo };
