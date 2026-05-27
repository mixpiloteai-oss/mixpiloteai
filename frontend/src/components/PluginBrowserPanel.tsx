// ─── Plugin Browser Panel ─────────────────────────────────────────────────────
// Full-featured plugin browser: scan, load, manage instances, chains, automation.

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PluginInfo {
  path: string
  name: string
  vendor: string
  format: 'VST3' | 'AU' | string
  type: 'instrument' | 'effect' | 'analyzer' | 'unknown'
  isFavorite: boolean
  crashCount: number
  isBlacklisted: boolean
}

interface PluginInstanceInfo {
  instanceId: string
  pluginPath: string
  format: string
  name: string
  vendor: string
  paramCount: number
  latencySamples: number
  pid: number | undefined
}

interface AudioRouteConfig {
  instanceId: string
  trackId: string
  inputGain: number
  outputGain: number
  bypassEnabled: boolean
  latencyCompensationMs: number
}

type FilterCategory = 'all' | 'instruments' | 'effects' | 'analyzers' | 'favorites'
type FilterFormat = 'all' | 'VST3' | 'AU'

// ── Helpers ───────────────────────────────────────────────────────────────────

function typeIcon(type: string): string {
  if (type === 'instrument') return '🎹'
  if (type === 'analyzer')   return '📊'
  return '🎛'
}

function inferType(plugin: Pick<PluginInfo, 'name' | 'vendor'>): PluginInfo['type'] {
  const n = (plugin.name + ' ' + plugin.vendor).toLowerCase()
  if (n.includes('synth') || n.includes('instrument') || n.includes('sampler') || n.includes('drum')) return 'instrument'
  if (n.includes('analyser') || n.includes('analyzer') || n.includes('scope') || n.includes('meter')) return 'analyzer'
  return 'effect'
}

function latencyMs(samples: number, sampleRate = 44100): string {
  return ((samples / sampleRate) * 1000).toFixed(1) + ' ms'
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PluginBrowserPanel(): React.ReactElement {
  // ── State ──────────────────────────────────────────────────────────────────
  const [plugins, setPlugins]         = useState<PluginInfo[]>([])
  const [instances, setInstances]     = useState<PluginInstanceInfo[]>([])
  const [routes, setRoutes]           = useState<AudioRouteConfig[]>([])
  const [selected, setSelected]       = useState<PluginInfo | null>(null)
  const [searchRaw, setSearchRaw]     = useState('')
  const [search, setSearch]           = useState('')
  const [filterCat, setFilterCat]     = useState<FilterCategory>('all')
  const [filterFmt, setFilterFmt]     = useState<FilterFormat>('all')
  const [scanning, setScanning]       = useState(false)
  const [scanProgress, setScanProgress] = useState('')
  const [loading, setLoading]         = useState<string | null>(null)
  const [favorites, setFavorites]     = useState<Set<string>>(new Set())
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const api = (window as unknown as { electronAPI: Record<string, (...args: unknown[]) => Promise<unknown>> }).electronAPI

  // ── Debounce search ────────────────────────────────────────────────────────

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setSearch(searchRaw), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchRaw])

  // ── Load instances on mount ────────────────────────────────────────────────

  const refreshInstances = useCallback(async () => {
    try {
      const data = await api.pluginGetInstances() as PluginInstanceInfo[]
      setInstances(data ?? [])
    } catch { /* ignore */ }
  }, [api])

  const refreshRoutes = useCallback(async () => {
    try {
      const data = await api.pluginGetAudioRoutes?.() as AudioRouteConfig[]
      setRoutes(data ?? [])
    } catch { /* ignore */ }
  }, [api])

  useEffect(() => {
    void refreshInstances()
    void refreshRoutes()
  }, [refreshInstances, refreshRoutes])

  // ── Scan ───────────────────────────────────────────────────────────────────

  const handleScan = async (): Promise<void> => {
    setScanning(true)
    setScanProgress('Scanning plugin folders…')
    try {
      const raw = await api.pluginScan() as Array<{
        path: string; name: string; vendor?: string; format?: string
      }>
      const list: PluginInfo[] = (raw ?? []).map(p => ({
        path: p.path,
        name: p.name,
        vendor: p.vendor ?? 'Unknown',
        format: (p.format ?? 'VST3') as PluginInfo['format'],
        type: inferType({ name: p.name, vendor: p.vendor ?? '' }),
        isFavorite: favorites.has(p.path),
        crashCount: 0,
        isBlacklisted: false,
      }))
      setPlugins(list)
      setScanProgress(`Found ${list.length} plugin${list.length !== 1 ? 's' : ''}`)
    } catch (err) {
      setScanProgress(`Scan failed: ${String(err)}`)
    } finally {
      setScanning(false)
    }
  }

  // ── Load / unload ──────────────────────────────────────────────────────────

  const handleLoad = async (plugin: PluginInfo): Promise<void> => {
    setLoading(plugin.path)
    try {
      await api.pluginLoad(plugin.path, plugin.format)
      await refreshInstances()
    } catch (err) {
      console.error('[plugin-browser] load failed', err)
    } finally {
      setLoading(null)
    }
  }

  const handleUnload = async (instanceId: string): Promise<void> => {
    try {
      await api.pluginUnload(instanceId)
      await refreshInstances()
      await refreshRoutes()
    } catch (err) {
      console.error('[plugin-browser] unload failed', err)
    }
  }

  const handleHotReload = async (instanceId: string): Promise<void> => {
    try {
      await api.pluginHotReload(instanceId)
      await refreshInstances()
    } catch (err) {
      console.error('[plugin-browser] hot reload failed', err)
    }
  }

  // ── Favorites ──────────────────────────────────────────────────────────────

  const toggleFavorite = (path: string): void => {
    setFavorites(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
    setPlugins(prev =>
      prev.map(p => p.path === path ? { ...p, isFavorite: !p.isFavorite } : p),
    )
  }

  // ── Filtering ──────────────────────────────────────────────────────────────

  const filtered = plugins.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) &&
        !p.vendor.toLowerCase().includes(search.toLowerCase())) return false
    if (filterFmt !== 'all' && p.format !== filterFmt) return false
    if (filterCat === 'instruments' && p.type !== 'instrument') return false
    if (filterCat === 'effects'     && p.type !== 'effect')     return false
    if (filterCat === 'analyzers'   && p.type !== 'analyzer')   return false
    if (filterCat === 'favorites'   && !p.isFavorite)           return false
    return true
  })

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full bg-[#0d0d16] text-white text-sm select-none">
      {/* Left panel */}
      <div className="flex flex-col w-72 border-r border-[#2d2d3d] shrink-0">
        {/* Header */}
        <div className="p-3 border-b border-[#2d2d3d]">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-purple-400 font-semibold text-base">Plugin Browser</span>
            <button
              onClick={handleScan}
              disabled={scanning}
              className="ml-auto flex items-center gap-1 px-2 py-1 rounded bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-xs"
            >
              {scanning ? (
                <span className="animate-spin inline-block w-3 h-3 border border-white border-t-transparent rounded-full" />
              ) : '⟳'}
              Scan
            </button>
          </div>
          {scanProgress && (
            <p className="text-xs text-gray-400 truncate">{scanProgress}</p>
          )}
          {/* Search */}
          <input
            type="text"
            value={searchRaw}
            onChange={e => setSearchRaw(e.target.value)}
            placeholder="Search plugins…"
            className="w-full mt-2 px-2 py-1 rounded bg-[#1a1a2e] border border-[#2d2d3d] text-xs placeholder-gray-500 focus:outline-none focus:border-purple-500"
          />
          {/* Category filter */}
          <div className="flex gap-1 mt-2 flex-wrap">
            {(['all','instruments','effects','analyzers','favorites'] as const).map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCat(cat)}
                className={`px-2 py-0.5 rounded text-xs capitalize ${filterCat === cat ? 'bg-purple-700 text-white' : 'bg-[#1a1a2e] text-gray-400 hover:text-white'}`}
              >
                {cat}
              </button>
            ))}
          </div>
          {/* Format filter */}
          <div className="flex gap-1 mt-1">
            {(['all','VST3','AU'] as const).map(fmt => (
              <button
                key={fmt}
                onClick={() => setFilterFmt(fmt)}
                className={`px-2 py-0.5 rounded text-xs ${filterFmt === fmt ? 'bg-[#3d2d6d] text-purple-200' : 'bg-[#1a1a2e] text-gray-400 hover:text-white'}`}
              >
                {fmt}
              </button>
            ))}
          </div>
        </div>

        {/* Plugin list */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence>
            {filtered.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-4 text-center text-gray-500 text-xs"
              >
                {plugins.length === 0 ? 'Click Scan to discover plugins' : 'No matching plugins'}
              </motion.div>
            )}
            {filtered.map(p => (
              <motion.div
                key={p.path}
                layout
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelected(p)}
                className={`flex items-center gap-2 px-3 py-2 cursor-pointer border-b border-[#1a1a2e] hover:bg-[#1a1a2e] ${selected?.path === p.path ? 'bg-[#1a1a2e] border-l-2 border-l-purple-500' : ''}`}
              >
                <span className="text-base">{typeIcon(p.type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 truncate">
                    <span className="font-medium truncate">{p.name}</span>
                    {p.isBlacklisted && (
                      <span className="text-xs bg-red-900 text-red-300 px-1 rounded shrink-0">⛔</span>
                    )}
                    {p.crashCount > 0 && (
                      <span className="text-xs bg-red-800 text-red-200 px-1 rounded shrink-0">{p.crashCount}💥</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 truncate">{p.vendor}</div>
                </div>
                <span className="text-xs text-[#8b5cf6] bg-[#2d1b6e] px-1 rounded shrink-0">{p.format}</span>
                <button
                  onClick={e => { e.stopPropagation(); toggleFavorite(p.path) }}
                  className={`text-base shrink-0 ${p.isFavorite ? 'text-yellow-400' : 'text-gray-600 hover:text-gray-300'}`}
                >
                  ★
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Plugin detail */}
        {selected ? (
          <div className="p-4 border-b border-[#2d2d3d]">
            <div className="flex items-start gap-3">
              <span className="text-3xl">{typeIcon(selected.type)}</span>
              <div className="flex-1">
                <h2 className="text-lg font-bold">{selected.name}</h2>
                <p className="text-gray-400 text-xs">{selected.vendor} · {selected.format}</p>
                {selected.isBlacklisted && (
                  <p className="text-red-400 text-xs mt-1">⛔ Blacklisted — too many crashes</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleLoad(selected)}
                  disabled={loading === selected.path || selected.isBlacklisted}
                  className="px-3 py-1.5 rounded bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-xs font-semibold"
                >
                  {loading === selected.path ? 'Loading…' : 'Load Plugin'}
                </button>
                <button
                  onClick={handleScan}
                  disabled={scanning}
                  className="px-3 py-1.5 rounded bg-[#2d2d3d] hover:bg-[#3d3d4d] disabled:opacity-50 text-xs"
                >
                  Rescan
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 border-b border-[#2d2d3d] text-gray-500 text-xs">
            Select a plugin to see details
          </div>
        )}

        {/* Loaded instances */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Loaded Instances ({instances.length})
            </h3>
            <AnimatePresence>
              {instances.length === 0 && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs text-gray-600"
                >
                  No plugins loaded
                </motion.p>
              )}
              {instances.map(inst => {
                const route = routes.find(r => r.instanceId === inst.instanceId)
                return (
                  <motion.div
                    key={inst.instanceId}
                    layout
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    className="flex items-center gap-3 p-2 rounded bg-[#1a1a2e] border border-[#2d2d3d] mb-2"
                  >
                    <span className="text-green-400 text-xs">🟢</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{inst.name}</div>
                      <div className="text-xs text-gray-400">
                        {inst.format} · {inst.paramCount} params ·{' '}
                        {inst.latencySamples > 0 ? latencyMs(inst.latencySamples) + ' latency' : 'no latency'}
                        {route && <span className="ml-2 text-purple-300">→ {route.trackId}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => handleHotReload(inst.instanceId)}
                      className="px-2 py-1 text-xs rounded bg-[#2d2d3d] hover:bg-[#3d3d4d]"
                    >
                      Hot Reload
                    </button>
                    <button
                      onClick={() => handleUnload(inst.instanceId)}
                      className="px-2 py-1 text-xs rounded bg-red-900 hover:bg-red-800 text-red-200"
                    >
                      Unload
                    </button>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>

          {/* Plugin chain for selected instance */}
          {instances.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Audio Routes
              </h3>
              {routes.length === 0 ? (
                <p className="text-xs text-gray-600">No audio routes configured</p>
              ) : (
                routes.map(r => (
                  <div key={r.instanceId} className="flex items-center gap-2 p-2 rounded bg-[#1a1a2e] border border-[#2d2d3d] mb-1">
                    <span className="text-xs text-purple-300">🔌</span>
                    <span className="flex-1 text-xs truncate">
                      {r.instanceId.slice(0, 8)}… → <span className="text-blue-300">{r.trackId}</span>
                    </span>
                    <span className={`text-xs px-1 rounded ${r.bypassEnabled ? 'bg-yellow-900 text-yellow-300' : 'bg-green-900 text-green-300'}`}>
                      {r.bypassEnabled ? 'Bypassed' : 'Active'}
                    </span>
                    <span className="text-xs text-gray-500">
                      gain: {r.outputGain.toFixed(2)}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default PluginBrowserPanel
