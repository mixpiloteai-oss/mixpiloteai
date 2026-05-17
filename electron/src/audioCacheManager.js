// ============================================================
// NEUROTEK AI — Audio Cache Manager
// Local filesystem cache for audio samples and assets
// ============================================================
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { pipeline } = require('stream');
const { promisify } = require('util');

const pipelineAsync = promisify(pipeline);

const CACHE_DIR = path.join(os.homedir(), '.mixpiloteai', 'audio-cache');
const META_FILE = path.join(CACHE_DIR, '.cache-meta.json');
const MAX_CACHE_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB
const MAX_CACHE_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

let _meta = null; // { [cacheKey]: { url, size, mtime, hits, ext } }

// ── Internals ──────────────────────────────────────────────────

function ensureDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function loadMeta() {
  if (_meta) return _meta;
  ensureDir();
  try {
    if (fs.existsSync(META_FILE)) {
      _meta = JSON.parse(fs.readFileSync(META_FILE, 'utf-8'));
    }
  } catch (_) {}
  _meta = _meta ?? {};
  return _meta;
}

function saveMeta() {
  try {
    fs.writeFileSync(META_FILE, JSON.stringify(_meta, null, 2), 'utf-8');
  } catch (err) {
    console.error('[AudioCache] Failed to save meta:', err.message);
  }
}

function cacheKey(url) {
  return crypto.createHash('sha256').update(url).digest('hex');
}

function cacheFilePath(key, ext) {
  return path.join(CACHE_DIR, `${key}${ext || ''}`);
}

function extFromUrl(url) {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/(\.[a-zA-Z0-9]+)$/);
    return m ? m[1].toLowerCase() : '.bin';
  } catch (_) {
    return '.bin';
  }
}

// ── Public API ────────────────────────────────────────────────

/**
 * Returns true if the URL is cached and the file exists on disk.
 */
function isCached(url) {
  const meta = loadMeta();
  const key = cacheKey(url);
  if (!meta[key]) return false;
  return fs.existsSync(cacheFilePath(key, meta[key].ext));
}

/**
 * Returns the absolute path to a cached file, or null if not cached.
 */
function getCachedPath(url) {
  if (!isCached(url)) return null;
  const meta = loadMeta();
  const key = cacheKey(url);
  const entry = meta[key];
  entry.hits = (entry.hits ?? 0) + 1;
  saveMeta();
  return cacheFilePath(key, entry.ext);
}

/**
 * Stores a Buffer or file path as a cached entry for the given URL.
 */
function storeInCache(url, dataOrPath) {
  ensureDir();
  const meta = loadMeta();
  const key = cacheKey(url);
  const ext = extFromUrl(url);
  const dest = cacheFilePath(key, ext);

  try {
    if (typeof dataOrPath === 'string') {
      fs.copyFileSync(dataOrPath, dest);
    } else if (Buffer.isBuffer(dataOrPath)) {
      fs.writeFileSync(dest, dataOrPath);
    } else {
      return false;
    }
    const size = fs.statSync(dest).size;
    meta[key] = { url, size, mtime: Date.now(), hits: 0, ext };
    saveMeta();
    return true;
  } catch (err) {
    console.error('[AudioCache] storeInCache error:', err.message);
    return false;
  }
}

/**
 * Downloads a URL and stores it in the cache. Returns the local path.
 * Uses built-in https/http — no external deps required.
 */
async function fetchAndCache(url) {
  if (isCached(url)) return getCachedPath(url);

  ensureDir();
  const key = cacheKey(url);
  const ext = extFromUrl(url);
  const dest = cacheFilePath(key, ext);

  try {
    const data = await downloadUrl(url);
    fs.writeFileSync(dest, data);
    const meta = loadMeta();
    meta[key] = { url, size: data.length, mtime: Date.now(), hits: 0, ext };
    saveMeta();
    return dest;
  } catch (err) {
    console.error('[AudioCache] fetchAndCache error:', err.message);
    return null;
  }
}

function downloadUrl(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? require('https') : require('http');
    mod.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadUrl(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Removes a specific URL from the cache.
 */
function evict(url) {
  const meta = loadMeta();
  const key = cacheKey(url);
  if (!meta[key]) return false;
  const filePath = cacheFilePath(key, meta[key].ext);
  try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (_) {}
  delete meta[key];
  saveMeta();
  return true;
}

/**
 * Returns cache statistics.
 */
function getStats() {
  const meta = loadMeta();
  const entries = Object.values(meta);
  const totalSize = entries.reduce((acc, e) => acc + (e.size ?? 0), 0);
  return {
    entryCount: entries.length,
    totalSizeBytes: totalSize,
    totalSizeMB: Math.round(totalSize / 1024 / 1024 * 10) / 10,
    maxSizeMB: Math.round(MAX_CACHE_SIZE_BYTES / 1024 / 1024),
    cacheDir: CACHE_DIR,
  };
}

/**
 * Lists all cache entries with metadata.
 */
function listEntries() {
  const meta = loadMeta();
  return Object.entries(meta).map(([key, entry]) => ({
    key,
    url: entry.url,
    size: entry.size,
    mtime: entry.mtime,
    hits: entry.hits ?? 0,
    ext: entry.ext,
    filePath: cacheFilePath(key, entry.ext),
  }));
}

/**
 * Prunes cache: removes entries older than MAX_CACHE_AGE_MS or
 * trims LRU entries when total size exceeds MAX_CACHE_SIZE_BYTES.
 */
function prune() {
  const meta = loadMeta();
  const now = Date.now();
  let pruned = 0;

  // Age-based eviction
  for (const [key, entry] of Object.entries(meta)) {
    if (now - entry.mtime > MAX_CACHE_AGE_MS) {
      const fp = cacheFilePath(key, entry.ext);
      try { if (fs.existsSync(fp)) fs.unlinkSync(fp); } catch (_) {}
      delete meta[key];
      pruned++;
    }
  }

  // Size-based LRU eviction
  let totalSize = Object.values(meta).reduce((a, e) => a + (e.size ?? 0), 0);
  if (totalSize > MAX_CACHE_SIZE_BYTES) {
    const sorted = Object.entries(meta).sort(([, a], [, b]) => a.mtime - b.mtime);
    for (const [key, entry] of sorted) {
      if (totalSize <= MAX_CACHE_SIZE_BYTES) break;
      const fp = cacheFilePath(key, entry.ext);
      try { if (fs.existsSync(fp)) fs.unlinkSync(fp); } catch (_) {}
      totalSize -= entry.size ?? 0;
      delete meta[key];
      pruned++;
    }
  }

  if (pruned > 0) saveMeta();
  return { pruned };
}

/**
 * Clears the entire cache.
 */
function clearAll() {
  const meta = loadMeta();
  for (const [key, entry] of Object.entries(meta)) {
    const fp = cacheFilePath(key, entry.ext);
    try { if (fs.existsSync(fp)) fs.unlinkSync(fp); } catch (_) {}
  }
  _meta = {};
  saveMeta();
  return true;
}

module.exports = {
  isCached,
  getCachedPath,
  storeInCache,
  fetchAndCache,
  evict,
  getStats,
  listEntries,
  prune,
  clearAll,
};
