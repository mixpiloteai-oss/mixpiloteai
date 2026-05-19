import { useState, useEffect } from 'react'
import { usePluginStore, type PluginInfo } from '../../store/pluginStore'
import PresetManager from './PresetManager'

type FilterTab = 'all' | 'instrument' | 'effect' | 'analyzer' | 'favorites' | 'blacklist'

const CAT_COLOR: Record<string, string> = {
  instrument: '#7c3aed', effect: '#06b6d4', analyzer: '#10b981',
  utility: '#f59e0b', unknown: '#475569',
}
const FORMAT_COLOR: Record<string, string> = {
  VST3: '#7c3aed', AU: '#06b6d4', VST2: '#475569', CLAP: '#10b981',
}

function CrashBanner({ crash, onDismiss }: {
  crash: { pluginName: string; crashCount: number; blacklisted: boolean }
  onDismiss: () => void
}) {
  return (
    <div className="flex items-start gap-2 p-3 mx-3 mt-2 rounded-xl shrink-0" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
      <span style={{ color: '#ef4444', fontSize: 14 }}>⚠</span>
      <div className="flex-1">
        <p className="text-xs font-semibold" style={{ color: '#ef4444' }}>{crash.pluginName} crashed</p>
        <p className="text-[10px] mt-0.5" style={{ color: '#64748b' }}>
          {crash.crashCount} crash{crash.crashCount !== 1 ? 'es' : ''} recorded.
          {crash.blacklisted ? ' Plugin blacklisted — will not load again.' : ` ${3 - crash.crashCount} more until auto-blacklist.`}
        </p>
      </div>
      <button onClick={onDismiss} style={{ color: '#475569', fontSize: 12 }}>✕</button>
    </div>
  )
}

function PluginRow({ plugin, active, onSelect, onToggleFav }: {
  plugin: PluginInfo; active: boolean; onSelect: () => void; onToggleFav: () => void
}) {
  const catColor = CAT_COLOR[plugin.category] ?? '#475569'
  return (
    <button onClick={onSelect} className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors"
      style={{
        background:   active ? `${catColor}12` : plugin.isBlacklisted ? 'rgba(239,68,68,0.04)' : 'transparent',
        borderLeft:   `2px solid ${active ? catColor : plugin.isBlacklisted ? '#ef4444' : 'transparent'}`,
        borderBottom: '1px solid #13131f',
        opacity:      plugin.isBlacklisted ? 0.6 : 1,
      }}>
      <div className="w-6 h-6 rounded flex items-center justify-center text-[10px] shrink-0"
        style={{ background: `${catColor}18`, color: catColor }}>
        {plugin.category === 'instrument' ? '♪' : plugin.category === 'analyzer' ? '≋' : '⊕'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <p className="text-xs font-medium truncate" style={{ color: plugin.isBlacklisted ? '#ef4444' : '#94a3b8' }}>{plugin.name}</p>
          {plugin.isBlacklisted && <span className="text-[8px]" style={{ color: '#ef4444' }}>✕</span>}
          {plugin.architecture === '32bit' && (
            <span className="text-[8px] px-1 rounded" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>32</span>
          )}
        </div>
        <p className="text-[10px] truncate" style={{ color: '#475569' }}>{plugin.vendor}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-[8px] px-1 py-px rounded"
          style={{ background: `${FORMAT_COLOR[plugin.format] ?? '#334155'}15`, color: FORMAT_COLOR[plugin.format] ?? '#475569', border: `1px solid ${FORMAT_COLOR[plugin.format] ?? '#334155'}30` }}>
          {plugin.format}
        </span>
        <button onClick={e => { e.stopPropagation(); onToggleFav() }} className="w-5 h-5 flex items-center justify-center rounded text-[10px]"
          style={{ color: plugin.isFavorite ? '#f59e0b' : '#334155' }}>★</button>
      </div>
    </button>
  )
}

function PluginDetail({ plugin, onLoad, onUnblacklist, onPresets, loading }: {
  plugin: PluginInfo; loading: boolean
  onLoad: () => void; onUnblacklist: () => void; onPresets: () => void
}) {
  const catColor = CAT_COLOR[plugin.category] ?? '#475569'
  return (
    <div className="w-full max-w-sm space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl"
          style={{ background: `${catColor}18`, border: `1px solid ${catColor}30`, color: catColor }}>
          {plugin.category === 'instrument' ? '♪' : '≋'}
        </div>
        <div>
          <h3 className="font-bold text-sm" style={{ color: '#e2e8f0' }}>{plugin.name}</h3>
          <p className="text-xs" style={{ color: '#475569' }}>{plugin.vendor} · {plugin.format} · v{plugin.version}</p>
        </div>
      </div>
      {plugin.isBlacklisted && (
        <div className="rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <p className="text-xs font-semibold" style={{ color: '#ef4444' }}>Blacklisted — {plugin.crashCount} crashes</p>
          <p className="text-[10px] mt-0.5" style={{ color: '#64748b' }}>This plugin crashed too many times and was automatically disabled.</p>
          <button onClick={onUnblacklist} className="mt-2 text-xs px-3 py-1.5 rounded-lg"
            style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}>
            Remove from Blacklist
          </button>
        </div>
      )}
      <div className="space-y-0.5">
        {([
          ['Category',    plugin.category],
          ['Format',      plugin.format],
          ['Architecture',plugin.architecture],
          ['Parameters',  String(plugin.paramCount || '—')],
          ['Has Editor',  plugin.hasEditor ? 'Yes' : 'No'],
          ['Crashes',     String(plugin.crashCount)],
          ['Path',        plugin.path],
        ] as [string,string][]).map(([k, v]) => (
          <div key={k} className="flex justify-between py-1.5" style={{ borderBottom: '1px solid #13131f' }}>
            <span className="text-xs" style={{ color: '#475569' }}>{k}</span>
            <span className="text-xs font-mono truncate max-w-[190px] text-right" style={{ color: '#64748b' }}>{v}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={onLoad} disabled={loading || plugin.isBlacklisted}
          className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all"
          style={{
            background: plugin.isBlacklisted ? 'rgba(255,255,255,0.03)' : 'rgba(124,58,237,0.2)',
            border: `1px solid ${plugin.isBlacklisted ? '#1c1c2e' : 'rgba(124,58,237,0.35)'}`,
            color: plugin.isBlacklisted ? '#334155' : '#a855f7',
            opacity: loading ? 0.6 : 1,
          }}>
          {loading ? 'Loading…' : plugin.isBlacklisted ? 'Blacklisted' : '⊕ Load Plugin'}
        </button>
        <button onClick={onPresets} className="px-4 py-2.5 rounded-xl text-xs transition-colors"
          style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)', color: '#06b6d4' }}>
          Presets
        </button>
      </div>
      {plugin.architecture === '32bit' && (
        <p className="text-[10px] px-1" style={{ color: '#f59e0b' }}>⚠ 32-bit plugin — runs via isolated bridge process.</p>
      )}
    </div>
  )
}

function InstancesPanel() {
  const { instances, removeInstance } = usePluginStore()
  async function handleUnload(instanceId: string) {
    await window.electronAPI?.pluginUnload(instanceId)
    removeInstance(instanceId)
  }
  if (!instances.length) return null
  return (
    <div className="shrink-0 px-3 py-2" style={{ borderTop: '1px solid #1c1c2e' }}>
      <p className="text-[9px] uppercase tracking-widest mb-1.5" style={{ color: '#334155' }}>Loaded ({instances.length})</p>
      <div className="space-y-1">
        {instances.map(inst => (
          <div key={inst.instanceId} className="flex items-center gap-2 text-[10px] py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="flex-1 truncate" style={{ color: '#64748b' }}>{inst.name}</span>
            <span style={{ color: '#334155' }}>PID {inst.pid}</span>
            <button onClick={() => handleUnload(inst.instanceId)} className="text-[9px] px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>✕</button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function PluginBrowser() {
  const {
    plugins, scanning, lastScanAt, blacklist, lastCrash,
    setPlugins, setScanning, setBlacklist, addInstance,
    toggleFavorite, setLastCrash, clearLastCrash,
  } = usePluginStore()

  const [search,     setSearch]     = useState('')
  const [tab,        setTab]        = useState<FilterTab>('all')
  const [selected,   setSelected]   = useState<PluginInfo | null>(null)
  const [loading,    setLoading]    = useState(false)
  const [presetsFor, setPresetsFor] = useState<PluginInfo | null>(null)

  useEffect(() => {
    if (!lastScanAt) scan()
    window.electronAPI?.onPluginCrashed(info => {
      setLastCrash({ instanceId: info.instanceId, pluginName: info.pluginName, blacklisted: info.blacklisted, crashCount: info.crashCount })
      window.electronAPI?.pluginGetBlacklist().then(b => setBlacklist(b)).catch(() => {})
      setPlugins(plugins.map(p => p.path === info.pluginPath ? { ...p, isBlacklisted: info.blacklisted, crashCount: info.crashCount } : p))
    })
    window.electronAPI?.pluginGetBlacklist().then(b => setBlacklist(b)).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function scan() {
    setScanning(true)
    try {
      const result = await window.electronAPI?.pluginScan()
      if (result) setPlugins(result as PluginInfo[])
    } catch { /* scanning failed */ }
    finally { setScanning(false) }
  }

  async function handleLoad(plugin: PluginInfo) {
    setLoading(true)
    try {
      const inst = await window.electronAPI?.pluginLoad(plugin.path, plugin.format)
      if (inst) addInstance({ ...inst, pluginId: plugin.id, loadedAt: Date.now() })
    } catch (e) { console.error('[PluginBrowser] load failed', e) }
    finally { setLoading(false) }
  }

  async function handleUnblacklist(plugin: PluginInfo) {
    await window.electronAPI?.pluginRemoveFromBlacklist(plugin.path)
    const updated = plugins.map(p => p.id === plugin.id ? { ...p, isBlacklisted: false, crashCount: 0 } : p)
    setPlugins(updated)
    if (selected?.id === plugin.id) setSelected({ ...plugin, isBlacklisted: false, crashCount: 0 })
    window.electronAPI?.pluginGetBlacklist().then(b => setBlacklist(b)).catch(() => {})
  }

  const blacklistedCount = blacklist.filter(b => b.blacklistedAt !== null).length
  const list = (tab === 'blacklist'
    ? blacklist.map(b => plugins.find(p => p.path === b.path)).filter(Boolean) as PluginInfo[]
    : plugins
  ).filter(p => {
    if (tab === 'favorites'  && !p.isFavorite)                return false
    if (tab === 'instrument' && p.category !== 'instrument')  return false
    if (tab === 'effect'     && p.category !== 'effect')      return false
    if (tab === 'analyzer'   && p.category !== 'analyzer')    return false
    if (search) {
      const q = search.toLowerCase()
      if (!p.name.toLowerCase().includes(q) && !p.vendor.toLowerCase().includes(q)) return false
    }
    return true
  })

  const TABS: { id: FilterTab; label: string }[] = [
    { id: 'all',        label: 'All' },
    { id: 'instrument', label: 'Instr' },
    { id: 'effect',     label: 'FX' },
    { id: 'analyzer',   label: 'Meter' },
    { id: 'favorites',  label: '★' },
    { id: 'blacklist',  label: `⚠ ${blacklistedCount}` },
  ]

  return (
    <div className="flex h-full overflow-hidden" style={{ background: '#08080f' }}>
      {/* Left — browser */}
      <div className="flex flex-col w-72 shrink-0" style={{ borderRight: '1px solid #1c1c2e' }}>
        <div className="flex items-center gap-2 px-3 h-9 shrink-0" style={{ borderBottom: '1px solid #1c1c2e', background: '#0c0c14' }}>
          <span className="text-xs font-semibold uppercase tracking-widest flex-1" style={{ color: '#334155' }}>Plugins</span>
          <button onClick={scan} disabled={scanning} className="text-[10px] px-2 py-0.5 rounded transition-colors"
            style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)', color: '#7c3aed' }}>
            {scanning ? '⟳ Scanning…' : '⟳ Rescan'}
          </button>
        </div>
        <div className="px-3 py-2 shrink-0" style={{ borderBottom: '1px solid #1c1c2e' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search plugins…"
            className="w-full text-xs px-2.5 py-1.5 rounded-lg outline-none"
            style={{ background: '#0f0f1a', border: '1px solid #1c1c2e', color: '#e2e8f0', caretColor: '#7c3aed' }} />
        </div>
        <div className="flex gap-0.5 px-2 py-1.5 shrink-0" style={{ borderBottom: '1px solid #1c1c2e' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex-1 py-1 rounded text-[9px] transition-all"
              style={{ background: tab === t.id ? 'rgba(124,58,237,0.2)' : 'transparent', color: tab === t.id ? '#a855f7' : t.id === 'blacklist' ? '#ef4444' : '#475569' }}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto">
          {scanning && <p className="text-xs text-center py-8 animate-pulse" style={{ color: '#475569' }}>Scanning plugins…</p>}
          {!scanning && list.length === 0 && (
            <p className="text-xs text-center py-8" style={{ color: '#334155' }}>
              {lastScanAt ? 'No plugins match' : 'Click Rescan to discover plugins'}
            </p>
          )}
          {list.map(p => (
            <PluginRow key={p.id} plugin={p} active={selected?.id === p.id}
              onSelect={() => setSelected(p)} onToggleFav={() => toggleFavorite(p.id)} />
          ))}
        </div>
        <div className="px-3 py-1.5 text-[10px] shrink-0" style={{ borderTop: '1px solid #1c1c2e', color: '#334155' }}>
          {list.length} / {plugins.length} plugins
          {blacklistedCount > 0 && <span className="ml-2" style={{ color: '#ef4444' }}>· {blacklistedCount} blacklisted</span>}
        </div>
        <InstancesPanel />
      </div>

      {/* Right — detail */}
      <div className="flex-1 flex flex-col min-w-0">
        {lastCrash && <CrashBanner crash={lastCrash} onDismiss={clearLastCrash} />}
        <div className="flex-1 flex items-center justify-center p-8">
          {selected ? (
            <PluginDetail plugin={selected} loading={loading}
              onLoad={() => handleLoad(selected)} onUnblacklist={() => handleUnblacklist(selected)}
              onPresets={() => setPresetsFor(selected)} />
          ) : (
            <div className="text-center space-y-2">
              <div className="text-4xl opacity-20">⊕</div>
              <p className="text-sm" style={{ color: '#334155' }}>Select a plugin to view details</p>
              <p className="text-xs" style={{ color: '#1c1c2e' }}>Plugins run in isolated processes — a crash never affects the DAW</p>
            </div>
          )}
        </div>
      </div>

      {presetsFor && <PresetManager plugin={presetsFor} onClose={() => setPresetsFor(null)} />}
    </div>
  )
}
