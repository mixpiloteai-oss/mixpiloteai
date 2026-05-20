// ─── Plugin Scan Cache ────────────────────────────────────────────────────────
// Incremental plugin scanning with on-disk cache
//
// Fixes:
// - Slow rescan times (caches results by file mtime + size)
// - Re-scanning unchanged plugins (only scans new/modified files)
// - Failed scan crashes (per-plugin timeout, isolated failures)
// - Memory bloat (scans in batches, releases between)

import { app } from 'electron'
import { promises as fs } from 'fs'
import { existsSync } from 'fs'
import { join } from 'path'
import type { ScannedPlugin } from './pluginScanner'

const CACHE_VERSION = 2
const CACHE_TTL_MS  = 7 * 24 * 60 * 60 * 1000  // 1 week

interface CacheEntry {
  path:      string
  mtime:     number    // file modification time
  size:      number    // file size in bytes
  cachedAt:  number    // when cached
  plugin:    ScannedPlugin
}

interface CacheFile {
  version: number
  entries: Record<string, CacheEntry>  // keyed by path
}

function cachePath(): string {
  return join(app.getPath('userData'), 'plugin-scan-cache.json')
}

class PluginScanCache {
  private entries: Map<string, CacheEntry> = new Map()
  private loaded = false

  async load(): Promise<void> {
    if (this.loaded) return
    try {
      const fp = cachePath()
      if (!existsSync(fp)) {
        this.loaded = true
        return
      }
      const raw = await fs.readFile(fp, 'utf8')
      const parsed = JSON.parse(raw) as CacheFile
      if (parsed.version !== CACHE_VERSION) {
        console.log('[plugin-cache] version mismatch, discarding')
        this.loaded = true
        return
      }
      this.entries = new Map(Object.entries(parsed.entries))
      this.loaded = true
      console.log(`[plugin-cache] loaded ${this.entries.size} entries`)
    } catch (err) {
      console.warn('[plugin-cache] load failed:', err)
      this.loaded = true
    }
  }

  async save(): Promise<void> {
    try {
      const fp = cachePath()
      const data: CacheFile = {
        version: CACHE_VERSION,
        entries: Object.fromEntries(this.entries),
      }
      await fs.writeFile(fp, JSON.stringify(data), 'utf8')
    } catch (err) {
      console.warn('[plugin-cache] save failed:', err)
    }
  }

  /**
   * Get cached plugin if the file hasn't changed.
   */
  async getCached(path: string): Promise<ScannedPlugin | null> {
    if (!this.loaded) await this.load()
    const entry = this.entries.get(path)
    if (!entry) return null

    // Check if cache is too old
    if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
      this.entries.delete(path)
      return null
    }

    // Verify file hasn't been modified
    try {
      const stat = await fs.stat(path)
      if (stat.mtimeMs !== entry.mtime || stat.size !== entry.size) {
        // File changed: invalidate
        this.entries.delete(path)
        return null
      }
      return entry.plugin
    } catch {
      // File no longer exists
      this.entries.delete(path)
      return null
    }
  }

  /**
   * Store a freshly scanned plugin in the cache.
   */
  async store(plugin: ScannedPlugin): Promise<void> {
    try {
      const stat = await fs.stat(plugin.path)
      this.entries.set(plugin.path, {
        path:     plugin.path,
        mtime:    stat.mtimeMs,
        size:     stat.size,
        cachedAt: Date.now(),
        plugin,
      })
    } catch {
      // File doesn't exist anymore — skip caching
    }
  }

  /**
   * Remove entries for files that no longer exist.
   */
  async cleanup(): Promise<number> {
    let removed = 0
    for (const path of Array.from(this.entries.keys())) {
      if (!existsSync(path)) {
        this.entries.delete(path)
        removed++
      }
    }
    if (removed > 0) await this.save()
    return removed
  }

  /**
   * Clear the entire cache (force full rescan next time).
   */
  async clear(): Promise<void> {
    this.entries.clear()
    try {
      const fp = cachePath()
      if (existsSync(fp)) await fs.unlink(fp)
    } catch {
      /* ignore */
    }
  }

  getStats(): { entries: number; sizeBytes: number } {
    return {
      entries:   this.entries.size,
      sizeBytes: JSON.stringify(Object.fromEntries(this.entries)).length,
    }
  }
}

export const pluginScanCache = new PluginScanCache()

/**
 * Wrap a plugin scan operation with caching + per-plugin timeout.
 *
 * Returns the cached plugin if valid, otherwise runs `scanFn` with a 5s timeout
 * and caches the result. Failed scans are not cached (will retry next time).
 */
export async function scanWithCache(
  path: string,
  scanFn: () => Promise<ScannedPlugin> | ScannedPlugin,
  timeoutMs = 5000,
): Promise<ScannedPlugin | null> {
  // Try cache first
  const cached = await pluginScanCache.getCached(path)
  if (cached) return cached

  // Scan with timeout
  try {
    const result = await Promise.race([
      Promise.resolve(scanFn()),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('scan timeout')), timeoutMs),
      ),
    ])
    if (result) {
      await pluginScanCache.store(result)
      return result
    }
    return null
  } catch (err) {
    console.warn(`[plugin-cache] scan failed for ${path}:`, (err as Error).message)
    return null
  }
}
