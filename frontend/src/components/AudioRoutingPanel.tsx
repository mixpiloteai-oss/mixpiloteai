// ============================================================
// NEUROTEK AI — Audio Routing Matrix (Priority #5)
// Visual send/return matrix + insert chain per channel
// ============================================================
import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Network, Plus, Trash2, ArrowRight, Cpu, Volume2,
  ChevronDown, ChevronUp, Zap, Info,
} from 'lucide-react';
import clsx from 'clsx';

// ─── Types ──────────────────────────────────────────────────

type ChannelType = 'audio' | 'midi' | 'return' | 'master';
type InsertType = 'eq' | 'comp' | 'limiter' | 'gate' | 'reverb' | 'delay' | 'chorus' | 'distortion';

interface Insert {
  id: string;
  type: InsertType;
  enabled: boolean;
  label: string;
}

interface RoutingChannel {
  id: string;
  name: string;
  type: ChannelType;
  color: string;
  inserts: Insert[];
  sends: Record<string, number>; // channelId → send level 0–1
  input: string;   // source channel id or 'ext'
  output: string;  // dest channel id or 'master'
}

// ─── Defaults ───────────────────────────────────────────────

const DEFAULT_INSERTS: Record<InsertType, string> = {
  eq: 'EQ', comp: 'Comp', limiter: 'Limiter', gate: 'Gate',
  reverb: 'Reverb', delay: 'Delay', chorus: 'Chorus', distortion: 'Dist',
};

const INSERT_COLORS: Record<InsertType, string> = {
  eq: '#06b6d4', comp: '#7c3aed', limiter: '#ef4444', gate: '#f59e0b',
  reverb: '#10b981', delay: '#a78bfa', chorus: '#ec4899', distortion: '#f97316',
};

function uid(): string {
  return Math.random().toString(36).slice(2, 8);
}

function mkInsert(type: InsertType): Insert {
  return { id: uid(), type, enabled: true, label: DEFAULT_INSERTS[type] };
}

const INITIAL_CHANNELS: RoutingChannel[] = [
  { id: 'kick',    name: 'Kick',    type: 'audio',  color: '#ef4444', inserts: [mkInsert('eq'), mkInsert('comp')], sends: { 'rv-bus': 0, 'dl-bus': 0 }, input: 'ext', output: 'master' },
  { id: 'bass',    name: 'Bass',    type: 'audio',  color: '#f59e0b', inserts: [mkInsert('eq'), mkInsert('gate')], sends: { 'rv-bus': 0.2, 'dl-bus': 0 }, input: 'ext', output: 'master' },
  { id: 'melody',  name: 'Melody',  type: 'audio',  color: '#a78bfa', inserts: [mkInsert('eq')], sends: { 'rv-bus': 0.5, 'dl-bus': 0.3 }, input: 'ext', output: 'master' },
  { id: 'perc',    name: 'Perc',    type: 'audio',  color: '#10b981', inserts: [mkInsert('comp')], sends: { 'rv-bus': 0.1, 'dl-bus': 0 }, input: 'ext', output: 'master' },
  { id: 'fx',      name: 'FX',      type: 'audio',  color: '#06b6d4', inserts: [], sends: { 'rv-bus': 0.7, 'dl-bus': 0.5 }, input: 'ext', output: 'master' },
  { id: 'rv-bus',  name: 'Reverb',  type: 'return', color: '#7c3aed', inserts: [mkInsert('reverb'), mkInsert('limiter')], sends: {}, input: 'sends', output: 'master' },
  { id: 'dl-bus',  name: 'Delay',   type: 'return', color: '#ec4899', inserts: [mkInsert('delay')], sends: {}, input: 'sends', output: 'master' },
  { id: 'master',  name: 'Master',  type: 'master', color: '#ffffff', inserts: [mkInsert('comp'), mkInsert('limiter')], sends: {}, input: 'all', output: 'out' },
];

const RETURN_CHANNELS = INITIAL_CHANNELS.filter((c) => c.type === 'return');

// ─── Sub-components ──────────────────────────────────────────

function InsertChip({ ins, onToggle, onRemove }: {
  ins: Insert;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const col = INSERT_COLORS[ins.type];
  return (
    <div className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer select-none"
      style={{
        background: ins.enabled ? `${col}20` : 'rgba(255,255,255,0.04)',
        border: `1px solid ${ins.enabled ? col + '50' : 'rgba(255,255,255,0.08)'}`,
        color: ins.enabled ? col : '#4b5563',
      }}
      onClick={onToggle}
    >
      {ins.label}
      <button className="ml-0.5 opacity-40 hover:opacity-100 transition-opacity"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
      >×</button>
    </div>
  );
}

function SendKnob({ label, value, onChange, color }: {
  label: string; value: number; onChange: (v: number) => void; color: string;
}) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="relative w-8 h-8">
        <svg width="32" height="32" viewBox="0 0 32 32">
          <circle cx="16" cy="16" r="12" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
          <circle cx="16" cy="16" r="12" fill="none"
            stroke={value > 0 ? color : 'rgba(255,255,255,0.12)'}
            strokeWidth="3"
            strokeDasharray={`${value * 75.4} 75.4`}
            strokeLinecap="round"
            transform="rotate(-90 16 16)"
          />
        </svg>
        <input type="range" min="0" max="1" step="0.01" value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        />
        <span className="absolute inset-0 flex items-center justify-center text-[8px] font-mono pointer-events-none"
          style={{ color: value > 0 ? color : '#4b5563' }}>
          {pct}
        </span>
      </div>
      <span className="text-[8px] text-text-muted truncate w-8 text-center">{label}</span>
    </div>
  );
}

function ChannelCard({ ch, allChannels, onUpdate, onRemove, isSelected, onSelect }: {
  ch: RoutingChannel;
  allChannels: RoutingChannel[];
  onUpdate: (id: string, updates: Partial<RoutingChannel>) => void;
  onRemove: (id: string) => void;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  const [showInserts, setShowInserts] = useState(true);
  const returns = allChannels.filter((c) => c.type === 'return');

  const addInsert = (type: InsertType) => {
    onUpdate(ch.id, { inserts: [...ch.inserts, mkInsert(type)] });
  };

  const removeInsert = (insId: string) => {
    onUpdate(ch.id, { inserts: ch.inserts.filter((i) => i.id !== insId) });
  };

  const toggleInsert = (insId: string) => {
    onUpdate(ch.id, {
      inserts: ch.inserts.map((i) => i.id === insId ? { ...i, enabled: !i.enabled } : i),
    });
  };

  const setSend = (retId: string, val: number) => {
    onUpdate(ch.id, { sends: { ...ch.sends, [retId]: val } });
  };

  const typeLabel: Record<ChannelType, string> = {
    audio: 'AUDIO', midi: 'MIDI', return: 'RETURN', master: 'MASTER',
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="rounded-xl flex flex-col overflow-hidden cursor-pointer transition-shadow"
      style={{
        background: '#111118',
        border: `1px solid ${isSelected ? ch.color + '50' : 'rgba(255,255,255,0.06)'}`,
        boxShadow: isSelected ? `0 0 16px ${ch.color}15` : 'none',
        minWidth: 160,
      }}
      onClick={() => onSelect(ch.id)}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', borderLeft: `3px solid ${ch.color}` }}
      >
        <div>
          <p className="text-xs font-bold text-white">{ch.name}</p>
          <p className="text-[9px] font-mono" style={{ color: ch.color }}>{typeLabel[ch.type]}</p>
        </div>
        {ch.type !== 'master' && (
          <button onClick={(e) => { e.stopPropagation(); onRemove(ch.id); }}
            className="w-5 h-5 rounded flex items-center justify-center text-gray-600 hover:text-red-400 hover:bg-red-900/20 transition-colors">
            <Trash2 size={10} />
          </button>
        )}
      </div>

      {/* Signal path */}
      <div className="px-3 py-1.5 flex items-center gap-1 text-[9px] text-text-muted"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
      >
        <span className="px-1 py-0.5 rounded bg-white/5">{ch.input === 'ext' ? 'EXT IN' : ch.input === 'sends' ? 'SENDS' : ch.input.toUpperCase()}</span>
        <ArrowRight size={8} />
        <span className="px-1 py-0.5 rounded bg-white/5">{ch.output === 'master' ? 'MASTER' : ch.output === 'out' ? 'OUT' : ch.output.toUpperCase()}</span>
      </div>

      {/* Insert chain */}
      <div className="px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <button className="flex items-center gap-1 text-[9px] text-text-muted mb-1.5 hover:text-white transition-colors w-full"
          onClick={(e) => { e.stopPropagation(); setShowInserts((v) => !v); }}
        >
          {showInserts ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
          INSERTS ({ch.inserts.length})
        </button>
        {showInserts && (
          <div className="flex flex-wrap gap-1">
            {ch.inserts.map((ins) => (
              <InsertChip key={ins.id} ins={ins}
                onToggle={() => toggleInsert(ins.id)}
                onRemove={() => removeInsert(ins.id)}
              />
            ))}
            {ch.inserts.length < 8 && (
              <InsertTypeMenu onSelect={addInsert} />
            )}
          </div>
        )}
      </div>

      {/* Sends (only for audio channels) */}
      {ch.type === 'audio' && returns.length > 0 && (
        <div className="px-3 py-2">
          <p className="text-[9px] text-text-muted mb-2">SENDS</p>
          <div className="flex gap-3 flex-wrap">
            {returns.map((ret) => (
              <SendKnob
                key={ret.id}
                label={ret.name}
                value={ch.sends[ret.id] ?? 0}
                onChange={(v) => setSend(ret.id, v)}
                color={ret.color}
              />
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

const INSERT_OPTIONS: InsertType[] = ['eq', 'comp', 'gate', 'limiter', 'reverb', 'delay', 'chorus', 'distortion'];

function InsertTypeMenu({ onSelect }: { onSelect: (t: InsertType) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold text-gray-600 hover:text-white border border-dashed border-white/10 hover:border-white/20 transition-colors"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
      >
        <Plus size={8} /> Add
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute top-full left-0 mt-1 z-50 rounded-lg p-1.5 flex flex-col gap-0.5 min-w-24"
            style={{ background: '#1a1a24', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            {INSERT_OPTIONS.map((t) => (
              <button key={t}
                className="text-left px-2 py-1 rounded text-[10px] hover:bg-white/5 transition-colors"
                style={{ color: INSERT_COLORS[t] }}
                onClick={(e) => { e.stopPropagation(); onSelect(t); setOpen(false); }}
              >
                {DEFAULT_INSERTS[t]}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Matrix View ─────────────────────────────────────────────

function MatrixView({ channels }: { channels: RoutingChannel[] }) {
  const audioChannels = channels.filter((c) => c.type === 'audio');
  const busChannels = channels.filter((c) => c.type === 'return' || c.type === 'master');

  return (
    <div className="overflow-auto">
      <table className="text-[10px] border-collapse">
        <thead>
          <tr>
            <th className="w-20 text-left px-2 py-1 text-text-muted font-normal">FROM ↓ TO →</th>
            {busChannels.map((bus) => (
              <th key={bus.id} className="px-3 py-1 font-bold text-center" style={{ color: bus.color }}>
                {bus.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {audioChannels.map((ch) => (
            <tr key={ch.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <td className="px-2 py-1.5 font-bold" style={{ color: ch.color }}>{ch.name}</td>
              {busChannels.map((bus) => {
                const level = ch.sends[bus.id] ?? 0;
                const isActive = level > 0;
                return (
                  <td key={bus.id} className="px-3 py-1.5 text-center">
                    {bus.type === 'return' ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <div
                          className="w-6 h-6 rounded border flex items-center justify-center cursor-pointer transition-all"
                          style={{
                            background: isActive ? `${bus.color}20` : 'transparent',
                            border: `1px solid ${isActive ? bus.color + '60' : 'rgba(255,255,255,0.08)'}`,
                          }}
                        >
                          {isActive && <div className="w-2 h-2 rounded-full" style={{ background: bus.color }} />}
                        </div>
                        <span className="font-mono text-[8px]" style={{ color: isActive ? bus.color : '#374151' }}>
                          {Math.round(level * 100)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-emerald-400 font-bold">→</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Panel ──────────────────────────────────────────────

export default function AudioRoutingPanel() {
  const [channels, setChannels] = useState<RoutingChannel[]>(INITIAL_CHANNELS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<'strips' | 'matrix'>('strips');

  const updateChannel = useCallback((id: string, updates: Partial<RoutingChannel>) => {
    setChannels((prev) => prev.map((c) => c.id === id ? { ...c, ...updates } : c));
  }, []);

  const removeChannel = useCallback((id: string) => {
    setChannels((prev) => prev.filter((c) => c.id !== id));
    setSelectedId((s) => s === id ? null : s);
  }, []);

  const addChannel = () => {
    const colors = ['#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#a78bfa'];
    const newCh: RoutingChannel = {
      id: uid(),
      name: `Track ${channels.filter((c) => c.type === 'audio').length + 1}`,
      type: 'audio',
      color: colors[Math.floor(Math.random() * colors.length)],
      inserts: [],
      sends: Object.fromEntries(channels.filter((c) => c.type === 'return').map((r) => [r.id, 0])),
      input: 'ext',
      output: 'master',
    };
    setChannels((prev) => [...prev.slice(0, -1), newCh, prev[prev.length - 1]]);
  };

  const audioChannels = channels.filter((c) => c.type !== 'master');
  const masterChannel = channels.find((c) => c.type === 'master');

  return (
    <div className="flex flex-col h-full" style={{ background: '#0a0a0f' }}>
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <Network size={14} className="text-purple-400 flex-shrink-0" />
        <span className="text-xs font-bold text-purple-300 tracking-wider">AUDIO ROUTING</span>
        <div className="w-px h-4 bg-white/10" />
        {(['strips', 'matrix'] as const).map((v) => (
          <button key={v}
            onClick={() => setView(v)}
            className="px-2 py-1 rounded text-[10px] uppercase font-bold transition-colors"
            style={{
              background: view === v ? '#7c3aed25' : 'transparent',
              color: view === v ? '#a78bfa' : '#6b7280',
              border: `1px solid ${view === v ? '#7c3aed40' : 'transparent'}`,
            }}
          >{v}</button>
        ))}
        <div className="flex-1" />
        <button onClick={addChannel}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-90"
          style={{ background: '#7c3aed20', color: '#a78bfa', border: '1px solid #7c3aed30' }}
        >
          <Plus size={12} /> Add Channel
        </button>
      </div>

      {/* Info banner */}
      <div className="flex items-center gap-2 px-4 py-1.5 flex-shrink-0"
        style={{ background: 'rgba(6,182,212,0.05)', borderBottom: '1px solid rgba(6,182,212,0.1)' }}
      >
        <Info size={10} className="text-cyan-400 flex-shrink-0" />
        <span className="text-[10px] text-cyan-300/70">
          Routing matrix shows signal flow between channels. Inserts process audio in series; sends are pre-fader parallel buses.
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {view === 'strips' ? (
          <div className="flex gap-3 items-start flex-wrap">
            <AnimatePresence>
              {audioChannels.map((ch) => (
                <ChannelCard
                  key={ch.id}
                  ch={ch}
                  allChannels={channels}
                  onUpdate={updateChannel}
                  onRemove={removeChannel}
                  isSelected={selectedId === ch.id}
                  onSelect={setSelectedId}
                />
              ))}
            </AnimatePresence>

            <div className="flex flex-col items-center gap-1 self-stretch justify-center mx-1">
              <div className="w-px flex-1" style={{ background: 'rgba(255,255,255,0.05)' }} />
              <Zap size={12} className="text-amber-400 flex-shrink-0" />
              <div className="w-px flex-1" style={{ background: 'rgba(255,255,255,0.05)' }} />
            </div>

            {masterChannel && (
              <ChannelCard
                ch={masterChannel}
                allChannels={channels}
                onUpdate={updateChannel}
                onRemove={removeChannel}
                isSelected={selectedId === masterChannel.id}
                onSelect={setSelectedId}
              />
            )}
          </div>
        ) : (
          <div className="rounded-xl p-4" style={{ background: '#111118', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-xs font-bold text-text-muted mb-3">SEND MATRIX</p>
            <MatrixView channels={channels} />
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-4 px-4 py-2 flex-shrink-0 text-[10px] text-text-muted"
        style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
      >
        <div className="flex items-center gap-1.5"><Cpu size={9} />{channels.filter((c) => c.type === 'audio').length} audio channels</div>
        <div className="flex items-center gap-1.5"><Volume2 size={9} />{channels.filter((c) => c.type === 'return').length} return buses</div>
        <div className="flex items-center gap-1.5"><Network size={9} />{channels.reduce((acc, c) => acc + c.inserts.length, 0)} inserts total</div>
      </div>
    </div>
  );
}
