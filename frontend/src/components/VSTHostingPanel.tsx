// ============================================================
// NEUROTEK AI — VST Hosting Panel (Priority #6)
// Scans + loads VST2/VST3 plugins; shows mock parameter UI in web
// ============================================================
import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plug, Search, RefreshCw, FolderSearch, Play, Square,
  Sliders, Power, Info, ChevronRight, Cpu, Music2,
} from 'lucide-react';
import { useElectron, type VSTPlugin } from '../hooks/useElectron';

// ─── Mock parameter UI ────────────────────────────────────────

interface PluginParam {
  id: string;
  name: string;
  value: number;  // 0–1
  displayValue: string;
  unit: string;
}

interface LoadedPlugin {
  id: string;
  plugin: VSTPlugin;
  enabled: boolean;
  params: PluginParam[];
}

const MOCK_PARAMS: Record<string, PluginParam[]> = {
  default: [
    { id: 'gain',    name: 'Gain',    value: 0.75, displayValue: '−6',   unit: 'dB' },
    { id: 'attack',  name: 'Attack',  value: 0.1,  displayValue: '10',   unit: 'ms' },
    { id: 'release', name: 'Release', value: 0.5,  displayValue: '200',  unit: 'ms' },
    { id: 'mix',     name: 'Mix',     value: 1.0,  displayValue: '100',  unit: '%' },
  ],
  comp: [
    { id: 'thresh',  name: 'Threshold', value: 0.6,  displayValue: '−18', unit: 'dB' },
    { id: 'ratio',   name: 'Ratio',     value: 0.4,  displayValue: '4:1', unit: '' },
    { id: 'attack',  name: 'Attack',    value: 0.15, displayValue: '5',   unit: 'ms' },
    { id: 'release', name: 'Release',   value: 0.4,  displayValue: '150', unit: 'ms' },
    { id: 'makeup',  name: 'Makeup',    value: 0.5,  displayValue: '+3',  unit: 'dB' },
    { id: 'mix',     name: 'Mix',       value: 1.0,  displayValue: '100', unit: '%' },
  ],
  reverb: [
    { id: 'size',    name: 'Room Size', value: 0.7,  displayValue: '70',  unit: '%' },
    { id: 'decay',   name: 'Decay',     value: 0.6,  displayValue: '2.4', unit: 's' },
    { id: 'predelay',name: 'Pre-delay', value: 0.1,  displayValue: '20',  unit: 'ms' },
    { id: 'damp',    name: 'Damping',   value: 0.5,  displayValue: '50',  unit: '%' },
    { id: 'mix',     name: 'Mix',       value: 0.4,  displayValue: '40',  unit: '%' },
  ],
  eq: [
    { id: 'low',     name: 'Low',       value: 0.5,  displayValue: '0',   unit: 'dB' },
    { id: 'lowmid',  name: 'Low-Mid',   value: 0.5,  displayValue: '0',   unit: 'dB' },
    { id: 'highmid', name: 'High-Mid',  value: 0.55, displayValue: '+2',  unit: 'dB' },
    { id: 'high',    name: 'High',      value: 0.45, displayValue: '−2',  unit: 'dB' },
  ],
};

function getMockParams(name: string): PluginParam[] {
  const lower = name.toLowerCase();
  if (lower.includes('comp') || lower.includes('limit')) return [...MOCK_PARAMS.comp];
  if (lower.includes('reverb') || lower.includes('verb') || lower.includes('room')) return [...MOCK_PARAMS.reverb];
  if (lower.includes('eq') || lower.includes('equaliz')) return [...MOCK_PARAMS.eq];
  return [...MOCK_PARAMS.default];
}

const WEB_MOCK_PLUGINS: VSTPlugin[] = [
  { name: 'Compressor Pro',   path: '/mock/comp.dll',      type: 'VST3', size: 2100000 },
  { name: 'Reverb Hall',      path: '/mock/reverb.dll',    type: 'VST3', size: 4500000 },
  { name: 'Parametric EQ',    path: '/mock/eq.dll',        type: 'VST3', size: 1200000 },
  { name: 'Limiter X',        path: '/mock/limiter.dll',   type: 'VST2', size: 890000 },
  { name: 'Stereo Delay',     path: '/mock/delay.dll',     type: 'VST3', size: 1600000 },
  { name: 'Chorus Ensemble',  path: '/mock/chorus.dll',    type: 'VST2', size: 750000 },
  { name: 'Distortion Drive', path: '/mock/dist.dll',      type: 'VST2', size: 520000 },
  { name: 'Multiband Comp',   path: '/mock/mb-comp.dll',   type: 'VST3', size: 3200000 },
  { name: 'Tape Saturator',   path: '/mock/tape.dll',      type: 'VST3', size: 2800000 },
  { name: 'Transient Shaper', path: '/mock/transient.dll', type: 'VST2', size: 680000 },
];

function uid(): string { return Math.random().toString(36).slice(2, 8); }

function ParamKnob({ param, onChange }: { param: PluginParam; onChange: (v: number) => void }) {
  const angle = -140 + param.value * 280;
  const r = 14;
  const cx = 18, cy = 18;

  return (
    <div className="flex flex-col items-center gap-1 group">
      <div className="relative w-9 h-9">
        <svg width="36" height="36" viewBox="0 0 36 36">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5"
            strokeDasharray="87.96 87.96" strokeDashoffset="22" strokeLinecap="round"
            transform={`rotate(-210 ${cx} ${cy})`} />
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#7c3aed" strokeWidth="2.5"
            strokeDasharray={`${param.value * 87.96} 87.96`} strokeDashoffset="22" strokeLinecap="round"
            transform={`rotate(-210 ${cx} ${cy})`} />
          <circle
            cx={cx + r * Math.sin((angle * Math.PI) / 180)}
            cy={cy - r * Math.cos((angle * Math.PI) / 180)}
            r="2.5" fill="#a78bfa"
          />
        </svg>
        <input type="range" min="0" max="1" step="0.001" value={param.value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          style={{ WebkitAppearance: 'slider-vertical' } as React.CSSProperties}
        />
      </div>
      <span className="text-[8px] text-text-muted text-center leading-tight">{param.name}</span>
      <span className="text-[9px] font-mono text-purple-300">{param.displayValue}{param.unit}</span>
    </div>
  );
}

function LoadedPluginCard({ lp, onRemove, onToggle, onParamChange, isSelected, onSelect }: {
  lp: LoadedPlugin;
  onRemove: () => void;
  onToggle: () => void;
  onParamChange: (paramId: string, val: number) => void;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12 }}
      className="rounded-xl overflow-hidden cursor-pointer"
      style={{
        background: '#111118',
        border: `1px solid ${isSelected ? '#7c3aed50' : 'rgba(255,255,255,0.06)'}`,
        boxShadow: isSelected ? '0 0 16px rgba(124,58,237,0.1)' : 'none',
      }}
      onClick={onSelect}
    >
      <div className="flex items-center gap-2 px-3 py-2"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(124,58,237,0.06)' }}
      >
        <button onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className="flex-shrink-0 transition-colors"
          style={{ color: lp.enabled ? '#10b981' : '#4b5563' }}
        >
          <Power size={12} />
        </button>
        <span className={['text-xs font-bold', lp.enabled ? 'text-white' : 'text-gray-600'].join(' ')}>
          {lp.plugin.name}
        </span>
        <span className="text-[9px] px-1 rounded font-mono ml-auto flex-shrink-0"
          style={{ background: lp.plugin.type === 'VST3' ? 'rgba(124,58,237,0.2)' : 'rgba(245,158,11,0.2)',
                   color: lp.plugin.type === 'VST3' ? '#a78bfa' : '#fbbf24' }}>
          {lp.plugin.type}
        </span>
        <button onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="flex-shrink-0 w-4 h-4 rounded text-gray-600 hover:text-red-400 transition-colors text-xs flex items-center justify-center">
          ×
        </button>
      </div>

      {isSelected && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="px-4 py-3 flex flex-wrap gap-4"
        >
          {lp.params.map((p) => (
            <ParamKnob key={p.id} param={p}
              onChange={(v) => onParamChange(p.id, v)} />
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}

export default function VSTHostingPanel() {
  const { isElectron, scanVSTPlugins } = useElectron();

  const [library, setLibrary] = useState<VSTPlugin[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'VST2' | 'VST3'>('all');
  const [loaded, setLoaded] = useState<LoadedPlugin[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!isElectron) {
      setLibrary(WEB_MOCK_PLUGINS);
      setScanned(true);
    }
  }, [isElectron]);

  const scan = useCallback(async () => {
    setLoading(true);
    try {
      const result = await scanVSTPlugins();
      setLibrary(result.length > 0 ? result : WEB_MOCK_PLUGINS);
      setScanned(true);
    } finally {
      setLoading(false);
    }
  }, [scanVSTPlugins]);

  const loadPlugin = useCallback((plugin: VSTPlugin) => {
    const lp: LoadedPlugin = {
      id: uid(),
      plugin,
      enabled: true,
      params: getMockParams(plugin.name),
    };
    setLoaded((prev) => [...prev, lp]);
    setSelectedId(lp.id);
  }, []);

  const removeLoaded = useCallback((id: string) => {
    setLoaded((prev) => prev.filter((p) => p.id !== id));
    setSelectedId((s) => (s === id ? null : s));
  }, []);

  const toggleLoaded = useCallback((id: string) => {
    setLoaded((prev) => prev.map((p) => p.id === id ? { ...p, enabled: !p.enabled } : p));
  }, []);

  const updateParam = useCallback((lpId: string, paramId: string, val: number) => {
    setLoaded((prev) => prev.map((p) => {
      if (p.id !== lpId) return p;
      return {
        ...p,
        params: p.params.map((param) => param.id === paramId ? { ...param, value: val } : param),
      };
    }));
  }, []);

  const filtered = library.filter((p) => {
    const matchName = !search.trim() || p.name.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'all' || p.type === typeFilter;
    return matchName && matchType;
  });

  const vst2Count = library.filter((p) => p.type === 'VST2').length;
  const vst3Count = library.filter((p) => p.type === 'VST3').length;

  return (
    <div className="flex h-full" style={{ background: '#0a0a0f' }}>
      <div className="flex flex-col w-72 flex-shrink-0 overflow-hidden"
        style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center gap-2 px-3 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <Plug size={13} className="text-cyan-400 flex-shrink-0" />
          <span className="text-xs font-bold text-white">Plugin Browser</span>
          <div className="flex-1" />
          <button onClick={scan} disabled={loading}
            className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors disabled:opacity-40 flex-shrink-0"
          >
            <RefreshCw size={9} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Scanning…' : scanned ? 'Rescan' : 'Scan'}
          </button>
        </div>

        {!isElectron && (
          <div className="flex items-start gap-2 mx-3 mt-2 p-2 rounded-lg flex-shrink-0"
            style={{ background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.15)' }}
          >
            <Info size={10} className="text-cyan-400 mt-0.5 flex-shrink-0" />
            <p className="text-[10px] text-cyan-300/70 leading-relaxed">
              Demo mode — launch the desktop app for real VST scanning. Showing mock library.
            </p>
          </div>
        )}

        {scanned && (
          <div className="flex gap-2 px-3 py-2 flex-shrink-0">
            {(['all', 'VST2', 'VST3'] as const).map((f) => {
              const count = f === 'all' ? library.length : f === 'VST2' ? vst2Count : vst3Count;
              return (
                <button key={f}
                  onClick={() => setTypeFilter(f)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono transition-all"
                  style={{
                    background: typeFilter === f ? '#7c3aed20' : 'rgba(255,255,255,0.04)',
                    color: typeFilter === f ? '#a78bfa' : '#6b7280',
                    border: `1px solid ${typeFilter === f ? '#7c3aed40' : 'transparent'}`,
                  }}
                >
                  {f} {count > 0 && <span>×{count}</span>}
                </button>
              );
            })}
          </div>
        )}

        {scanned && (
          <div className="relative mx-3 mb-2 flex-shrink-0">
            <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter plugins…"
              className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border border-white/5 bg-white/5 text-gray-300 placeholder-gray-600 outline-none focus:border-purple-500/30 transition-colors"
            />
          </div>
        )}

        {!scanned && !loading && isElectron && (
          <button onClick={scan}
            className="mx-3 my-4 flex flex-col items-center gap-2 py-6 rounded-lg border border-dashed border-white/10 hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all text-gray-600 hover:text-cyan-400"
          >
            <FolderSearch size={20} />
            <span className="text-xs">Click to scan for VST plugins</span>
          </button>
        )}

        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-0.5">
          {filtered.map((p, i) => (
            <button key={`${p.path}-${i}`}
              onClick={() => loadPlugin(p)}
              className="w-full flex items-center gap-2 text-xs py-1.5 px-2 rounded-lg hover:bg-white/5 transition-colors group text-left"
            >
              <span className="flex-shrink-0 px-1 rounded text-[9px] font-mono"
                style={{ background: p.type === 'VST3' ? 'rgba(124,58,237,0.2)' : 'rgba(245,158,11,0.15)',
                         color: p.type === 'VST3' ? '#a78bfa' : '#fbbf24' }}>
                {p.type}
              </span>
              <span className="text-gray-300 truncate flex-1" title={p.path}>{p.name}</span>
              <ChevronRight size={10} className="text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            </button>
          ))}
          {scanned && filtered.length === 0 && (
            <p className="text-xs text-gray-600 text-center py-6">No plugins match filter</p>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <Sliders size={13} className="text-purple-400" />
          <span className="text-xs font-bold text-white">Plugin Chain</span>
          <span className="text-[10px] text-text-muted ml-1">— click a plugin in the browser to add it</span>
          <div className="flex-1" />
          <div className="flex items-center gap-3 text-[10px] text-text-muted">
            <span><span className="text-white font-mono">{loaded.length}</span> loaded</span>
            <span><span className="text-emerald-400 font-mono">{loaded.filter((l) => l.enabled).length}</span> active</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <AnimatePresence>
            {loaded.map((lp) => (
              <LoadedPluginCard
                key={lp.id}
                lp={lp}
                onRemove={() => removeLoaded(lp.id)}
                onToggle={() => toggleLoaded(lp.id)}
                onParamChange={(pId, v) => updateParam(lp.id, pId, v)}
                isSelected={selectedId === lp.id}
                onSelect={() => setSelectedId((s) => s === lp.id ? null : lp.id)}
              />
            ))}
          </AnimatePresence>

          {loaded.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center py-16 gap-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)' }}>
                <Plug size={24} className="text-purple-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">No plugins loaded</p>
                <p className="text-xs text-text-muted mt-1">Select a plugin from the browser on the left to add it to the chain</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 px-4 py-2 flex-shrink-0 text-[10px] text-text-muted"
          style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
        >
          <div className="flex items-center gap-1.5"><Cpu size={9} />Audio engine: <span className="text-emerald-400">online</span></div>
          <div className="flex items-center gap-1.5"><Music2 size={9} />Sample rate: <span className="text-white font-mono">48 kHz</span></div>
          <div className="flex items-center gap-1.5"><Play size={9} />Buffer: <span className="text-white font-mono">256 smp</span></div>
          {!isElectron && (
            <div className="flex items-center gap-1.5 ml-auto">
              <Info size={9} className="text-amber-400" />
              <span className="text-amber-300/70">Desktop app required for real VST hosting</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
