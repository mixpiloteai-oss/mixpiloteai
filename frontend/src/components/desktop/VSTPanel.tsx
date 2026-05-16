// ============================================================
// VSTPanel — VST plugin scanner panel (desktop only)
// ============================================================
import React, { useState, useCallback } from 'react';
import { Plug, Search, RefreshCw, FolderSearch } from 'lucide-react';
import { useElectron, type VSTPlugin } from '../../hooks/useElectron';

export function VSTPanel() {
  const { isElectron, scanVSTPlugins } = useElectron();
  const [plugins, setPlugins] = useState<VSTPlugin[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [search, setSearch] = useState('');

  const scan = useCallback(async () => {
    setLoading(true);
    try {
      const result = await scanVSTPlugins();
      setPlugins(result as VSTPlugin[]);
      setScanned(true);
    } finally {
      setLoading(false);
    }
  }, [scanVSTPlugins]);

  if (!isElectron) return null;

  const filtered = search.trim()
    ? plugins.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : plugins;

  const vst2Count = plugins.filter((p) => p.type === 'VST2').length;
  const vst3Count = plugins.filter((p) => p.type === 'VST3').length;

  return (
    <div className="p-4 rounded-xl border border-white/5 flex flex-col gap-3" style={{ background: '#111118' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Plug size={14} className="text-cyan-400" />
          <span className="text-sm font-medium text-white">VST Plugins</span>
          {scanned && <span className="text-xs px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-mono">{plugins.length}</span>}
        </div>
        <button onClick={scan} disabled={loading}
          className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors disabled:opacity-40">
          <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Scanning…' : scanned ? 'Rescan' : 'Scan VST'}
        </button>
      </div>

      {!scanned && !loading && (
        <button onClick={scan}
          className="flex flex-col items-center gap-2 py-4 rounded-lg border border-dashed border-white/10 hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all text-gray-600 hover:text-cyan-400">
          <FolderSearch size={20} />
          <span className="text-xs">Click to scan for VST plugins</span>
        </button>
      )}

      {scanned && plugins.length > 0 && (
        <div className="flex items-center gap-2">
          {vst2Count > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-mono">VST2 ×{vst2Count}</span>}
          {vst3Count > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 font-mono">VST3 ×{vst3Count}</span>}
        </div>
      )}

      {scanned && plugins.length > 0 && (
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter plugins…"
            className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border border-white/5 bg-white/5 text-gray-300 placeholder-gray-600 outline-none focus:border-cyan-500/30 transition-colors" />
        </div>
      )}

      {scanned && filtered.length > 0 && (
        <div className="max-h-48 overflow-y-auto space-y-0.5 pr-1">
          {filtered.map((p, i) => (
            <div key={`${p.path}-${i}`} className="flex items-center gap-2 text-xs py-1 px-2 rounded hover:bg-white/5 transition-colors group">
              <span className={['px-1 rounded text-[10px] font-mono shrink-0', p.type === 'VST3' ? 'bg-purple-500/20 text-purple-400' : 'bg-amber-500/20 text-amber-400'].join(' ')}>{p.type}</span>
              <span className="text-gray-300 truncate flex-1" title={p.path}>{p.name}</span>
              {p.size != null && p.size > 0 && (
                <span className="text-gray-600 text-[10px] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">{(p.size / 1024 / 1024).toFixed(1)}MB</span>
              )}
            </div>
          ))}
        </div>
      )}

      {scanned && plugins.length === 0 && (
        <p className="text-xs text-gray-600 text-center py-2">No VST plugins found in standard paths</p>
      )}
    </div>
  );
}
