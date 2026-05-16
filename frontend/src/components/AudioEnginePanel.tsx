// ============================================================
// NEUROTEK AI — Audio Engine Panel (full DAW interface)
// Real-time audio engine, BPM, clip launcher, channel strips
// ============================================================
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Square, Zap, Volume2, Music, Cpu, Activity,
  Sliders, BarChart2, Layers, Mic,
  ChevronRight, AlertTriangle, Circle,
} from 'lucide-react';
import audioEngine, { type EngineState } from '../services/realAudioEngine';
import { tapTempo, type BpmResult } from '../services/bpmDetector';
import { useAppStore } from '../store/appStore';

// ── Types ─────────────────────────────────────────────────────
type Panel = 'mixer' | 'synth' | 'spectrum' | 'clock';

interface ChannelUI {
  id: string;
  name: string;
  type: string;
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  level: number;
  color: string;
}

const DEFAULT_CHANNELS: Omit<ChannelUI, 'level'>[] = [
  { id: 'kick',    name: 'KICK',    type: 'kick',       volume: 0.9,  pan: 0,    muted: false, solo: false, color: '#ef4444' },
  { id: 'bass',    name: 'BASS',    type: 'bass',       volume: 0.8,  pan: 0,    muted: false, solo: false, color: '#f97316' },
  { id: 'mel',     name: 'MELODY', type: 'melody',     volume: 0.7,  pan: 0.1,  muted: false, solo: false, color: '#a855f7' },
  { id: 'perc',    name: 'PERC',   type: 'percussion', volume: 0.65, pan: -0.1, muted: false, solo: false, color: '#eab308' },
  { id: 'fx',      name: 'FX',     type: 'fx',         volume: 0.5,  pan: 0,    muted: false, solo: false, color: '#06b6d4' },
  { id: 'acid',    name: 'ACID',   type: 'acid',       volume: 0.75, pan: 0,    muted: false, solo: false, color: '#ec4899' },
  { id: 'master',  name: 'MASTER', type: 'pad',        volume: 0.85, pan: 0,    muted: false, solo: false, color: '#7c3aed' },
];

// ── BPM display ──────────────────────────────────────────
function BpmDisplay({ bpm, onSet }: { bpm: number; onSet: (b: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(bpm));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!editing) setDraft(String(bpm)); }, [bpm, editing]);

  const commit = () => {
    const v = parseInt(draft, 10);
    if (v >= 60 && v <= 300) onSet(v);
    setEditing(false);
  };

  return (
    <div className="flex flex-col items-center">
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
          className="w-20 text-center text-2xl font-mono font-black bg-transparent border-b border-purple-500 text-white outline-none"
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="text-3xl font-mono font-black text-white hover:text-purple-300 transition-colors tabular-nums"
        >
          {bpm}
        </button>
      )}
      <span className="text-xs text-gray-500 font-medium mt-0.5">BPM</span>
    </div>
  );
}

// ── VU bar ───────────────────────────────────────────────
function VuBar({ level, color = '#7c3aed', vertical = true }: { level: number; color?: string; vertical?: boolean }) {
  const pct = Math.min(100, Math.round(level * 100));
  const overload = level > 0.9;

  if (vertical) {
    return (
      <div className="w-2 h-full bg-gray-800 rounded-full overflow-hidden relative">
        <motion.div
          className="absolute bottom-0 left-0 right-0 rounded-full"
          style={{ background: overload ? '#ef4444' : color }}
          animate={{ height: `${pct}%` }}
          transition={{ duration: 0.05 }}
        />
      </div>
    );
  }

  return (
    <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
      <motion.div
        className="h-full rounded-full"
        style={{ background: overload ? '#ef4444' : color }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.05 }}
      />
    </div>
  );
}

// ── Spectrum visualiser ───────────────────────────────────
function SpectrumViz({ isPlaying }: { isPlaying: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext('2d')!;
    const bars = 48;

    const draw = () => {
      const spectrum = audioEngine.getMasterSpectrum();
      const w = canvas.width; const h = canvas.height;
      ctx2d.clearRect(0, 0, w, h);

      const barW = (w / bars) - 1;
      for (let i = 0; i < bars; i++) {
        let gain = 0;
        if (spectrum && isPlaying) {
          const idx = Math.floor((i / bars) * spectrum.length);
          gain = Math.max(0, (spectrum[idx] + 100) / 100);
        } else {
          gain = Math.random() * 0.08;
        }
        const barH = gain * h;

        const grad = ctx2d.createLinearGradient(0, h, 0, h - barH);
        grad.addColorStop(0, '#7c3aed');
        grad.addColorStop(1, '#06b6d4');
        ctx2d.fillStyle = grad;
        ctx2d.fillRect(i * (barW + 1), h - barH, barW, barH);
      }
      rafRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying]);

  return (
    <canvas
      ref={canvasRef}
      width={320}
      height={80}
      className="w-full h-20 rounded-lg bg-gray-900/60 border border-gray-800"
    />
  );
}

// ── Channel strip card ──────────────────────────────────
function ChannelCard({
  ch, onVolume, onPan, onMute, onSolo, onKick, onAcid,
}: {
  ch: ChannelUI;
  onVolume: (id: string, v: number) => void;
  onPan: (id: string, p: number) => void;
  onMute: (id: string) => void;
  onSolo: (id: string) => void;
  onKick: (id: string) => void;
  onAcid: (id: string) => void;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
        ch.muted ? 'border-gray-800 opacity-40' : 'border-gray-700/60'
      }`}
      style={{ background: `${ch.color}08`, minWidth: 72 }}
    >
      <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase truncate w-full text-center">
        {ch.name}
      </p>

      <div className="flex gap-1 h-24 items-end justify-center">
        <VuBar level={ch.level} color={ch.color} />
        <div className="relative h-24 flex items-center justify-center">
          <input
            type="range" min={0} max={100} value={Math.round(ch.volume * 100)}
            onChange={(e) => onVolume(ch.id, Number(e.target.value) / 100)}
            className="appearance-none bg-transparent cursor-pointer"
            style={{
              writingMode: 'vertical-lr',
              direction: 'rtl',
              width: 20,
              height: 80,
              accentColor: ch.color,
            } as React.CSSProperties}
          />
        </div>
      </div>

      <input
        type="range" min={-100} max={100} value={Math.round(ch.pan * 100)}
        onChange={(e) => onPan(ch.id, Number(e.target.value) / 100)}
        className="w-full h-1 cursor-pointer rounded-full appearance-none"
        style={{ accentColor: ch.color }}
        title={`Pan: ${Math.round(ch.pan * 100)}`}
      />

      <div className="flex gap-1">
        <button
          onClick={() => onMute(ch.id)}
          className={`w-7 h-5 rounded text-[9px] font-bold transition-colors ${
            ch.muted ? 'bg-amber-500 text-black' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
          }`}
        >M</button>
        <button
          onClick={() => onSolo(ch.id)}
          className={`w-7 h-5 rounded text-[9px] font-bold transition-colors ${
            ch.solo ? 'bg-yellow-400 text-black' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
          }`}
        >S</button>
      </div>

      {ch.type === 'kick' && (
        <button
          onClick={() => onKick(ch.id)}
          className="w-full text-[9px] font-bold px-1 py-0.5 rounded bg-red-600/30 border border-red-500/40 text-red-400 hover:bg-red-600/50 transition-colors"
        >▶ KICK</button>
      )}
      {ch.type === 'acid' && (
        <button
          onClick={() => onAcid(ch.id)}
          className="w-full text-[9px] font-bold px-1 py-0.5 rounded bg-pink-600/30 border border-pink-500/40 text-pink-400 hover:bg-pink-600/50 transition-colors"
        >▶ ACID</button>
      )}
    </div>
  );
}

// ── Beat clock visualiser ─────────────────────────────────
function BeatClock({ isPlaying }: { isPlaying: boolean }) {
  const [beat, setBeat] = useState(0);

  useEffect(() => {
    if (!isPlaying) { setBeat(0); return; }
    const unsub = audioEngine.onBeat((b) => setBeat(b));
    return unsub;
  }, [isPlaying]);

  return (
    <div className="flex items-center gap-2">
      {[0, 1, 2, 3].map((i) => (
        <motion.div
          key={i}
          className="w-4 h-4 rounded-full border-2"
          animate={{
            background: isPlaying && beat === i ? '#7c3aed' : 'transparent',
            borderColor: isPlaying && beat === i ? '#7c3aed' : '#374151',
            boxShadow: isPlaying && beat === i ? '0 0 10px #7c3aed' : 'none',
          }}
          transition={{ duration: 0.05 }}
        />
      ))}
    </div>
  );
}

// ── Main AudioEnginePanel ─────────────────────────────────
export default function AudioEnginePanel() {
  const { updateAudioEngine } = useAppStore();
  const [engineState, setEngineState] = useState<EngineState>(audioEngine.getState());
  const [channels, setChannels] = useState<ChannelUI[]>(
    DEFAULT_CHANNELS.map((c) => ({ ...c, level: 0 })),
  );
  const [activePanel, setActivePanel] = useState<Panel>('mixer');
  const [tapResult, setTapResult] = useState<BpmResult | null>(null);
  const [bpmInput, setBpmInput] = useState(140);
  const levelTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initialised = useRef(false);
  const engineStateRef = useRef(engineState);
  engineStateRef.current = engineState;

  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;

    const unsub = audioEngine.onStateChange(setEngineState);

    DEFAULT_CHANNELS.forEach((ch) => {
      try { audioEngine.createChannel(ch.id, ch.name, ch.type as any); } catch { /* already exists */ }
    });

    levelTimerRef.current = setInterval(() => {
      setChannels((prev) =>
        prev.map((ch) => ({
          ...ch,
          level: engineStateRef.current.isPlaying ? audioEngine.getChannelLevel(ch.id) : 0,
        })),
      );
    }, 50);

    return () => {
      unsub();
      if (levelTimerRef.current) clearInterval(levelTimerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    updateAudioEngine({ bpm: engineState.bpm });
  }, [engineState.bpm, updateAudioEngine]);

  const handlePlay = useCallback(async () => {
    await audioEngine.init();
    if (engineStateRef.current.isPlaying) audioEngine.stop();
    else audioEngine.start();
  }, []);

  const handleVolume = (id: string, v: number) => {
    audioEngine.setChannelVolume(id, v);
    setChannels((prev) => prev.map((c) => c.id === id ? { ...c, volume: v } : c));
  };

  const handlePan = (id: string, p: number) => {
    audioEngine.setChannelPan(id, p);
    setChannels((prev) => prev.map((c) => c.id === id ? { ...c, pan: p } : c));
  };

  const handleMute = (id: string) => {
    const ch = channels.find((c) => c.id === id);
    if (!ch) return;
    const muted = !ch.muted;
    audioEngine.setChannelMute(id, muted);
    setChannels((prev) => prev.map((c) => c.id === id ? { ...c, muted } : c));
  };

  const handleSolo = (id: string) => {
    const ch = channels.find((c) => c.id === id);
    if (!ch) return;
    const solo = !ch.solo;
    audioEngine.setChannelSolo(id, solo);
    setChannels((prev) => prev.map((c) => c.id === id ? { ...c, solo } : c));
  };

  const handleKick = (id: string) => {
    audioEngine.init().then(() => {
      audioEngine.synthesisKick(id, { freq: 60, decay: 0.4, distortion: 0.3 });
    });
  };

  const handleAcid = (id: string) => {
    audioEngine.init().then(() => {
      const note = [55, 73, 82, 110][Math.floor(Math.random() * 4)];
      audioEngine.synthesisAcidBass(id, { freq: note, cutoff: 800, resonance: 18, duration: 0.25 });
    });
  };

  const handleTap = () => {
    const result = tapTempo.tap();
    if (result) {
      setTapResult(result);
      audioEngine.setBpm(result.bpm);
      setBpmInput(result.bpm);
    }
  };

  const handleBpmSet = (bpm: number) => {
    audioEngine.setBpm(bpm);
    setBpmInput(bpm);
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f] text-white overflow-hidden">
      {/* Transport bar */}
      <div className="flex-shrink-0 border-b border-gray-800/60 px-5 py-3 flex items-center gap-5 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center">
            <Music className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <span className="text-sm font-bold text-white tracking-wider">AUDIO ENGINE</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-purple-600/20 text-purple-300 border border-purple-500/30">v2</span>
        </div>

        <button
          onClick={handlePlay}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${
            engineState.isPlaying
              ? 'bg-red-600 hover:bg-red-500 text-white'
              : 'bg-purple-600 hover:bg-purple-500 text-white'
          }`}
        >
          {engineState.isPlaying
            ? <Square className="w-4 h-4" />
            : <Play className="w-4 h-4" />}
          {engineState.isPlaying ? 'STOP' : 'PLAY'}
        </button>

        <div className="flex items-center gap-4">
          <BpmDisplay bpm={engineState.bpm} onSet={handleBpmSet} />
          <BeatClock isPlaying={engineState.isPlaying} />
        </div>

        <button
          onClick={handleTap}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 hover:border-purple-500/60 text-sm text-gray-300 font-semibold transition-all active:scale-95"
        >
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          TAP
          {tapResult && (
            <span className="text-xs text-green-400 font-mono">{tapResult.bpm}</span>
          )}
        </button>

        <div className="flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-gray-500" />
          <input
            type="range" min={0} max={100} defaultValue={85}
            onChange={(e) => audioEngine.setMasterVolume(Number(e.target.value) / 100)}
            className="w-24 cursor-pointer"
            style={{ accentColor: '#7c3aed' }}
          />
        </div>

        <div className="ml-auto flex items-center gap-3">
          {engineState.overload && (
            <div className="flex items-center gap-1 text-red-400 text-xs animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5" /> OVERLOAD
            </div>
          )}
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Cpu className="w-3.5 h-3.5" />
            <span className="font-mono">{engineState.cpuLoad.toFixed(1)}%</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Activity className="w-3.5 h-3.5" />
            <span className="font-mono">{engineState.latencyMs.toFixed(1)}ms</span>
          </div>
          <div className="flex items-center gap-1">
            <Circle className="w-2 h-2 fill-emerald-400 text-emerald-400" />
            <span className="text-xs text-emerald-400">
              {engineState.isInitialised ? 'Live' : 'Ready'}
            </span>
          </div>
        </div>
      </div>

      {/* Sub-panel nav */}
      <div className="flex-shrink-0 flex gap-1 px-5 pt-3 pb-1">
        {([
          { id: 'mixer',    label: 'Mixer',    icon: Sliders },
          { id: 'synth',    label: 'Synth',    icon: Music },
          { id: 'spectrum', label: 'Spectrum', icon: BarChart2 },
          { id: 'clock',    label: 'Routing',  icon: Layers },
        ] as { id: Panel; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActivePanel(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activePanel === id
                ? 'bg-purple-600/30 border border-purple-500/50 text-purple-300'
                : 'text-gray-500 hover:text-gray-300 border border-transparent'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Content panels */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <AnimatePresence mode="wait">
          {activePanel === 'mixer' && (
            <motion.div
              key="mixer"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex gap-3 overflow-x-auto pb-3"
            >
              {channels.map((ch) => (
                <ChannelCard
                  key={ch.id}
                  ch={ch}
                  onVolume={handleVolume}
                  onPan={handlePan}
                  onMute={handleMute}
                  onSolo={handleSolo}
                  onKick={handleKick}
                  onAcid={handleAcid}
                />
              ))}
            </motion.div>
          )}

          {activePanel === 'synth' && (
            <motion.div
              key="synth"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              <div className="bg-gray-900/60 border border-red-500/20 rounded-xl p-4">
                <h3 className="text-sm font-bold text-red-400 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500" /> KICK SYNTH
                </h3>
                <div className="space-y-3">
                  {[
                    { label: 'Frequency', min: 40, max: 100, defaultVal: 60, unit: 'Hz' },
                    { label: 'Decay',     min: 10, max: 80,  defaultVal: 35, unit: '0.%' },
                    { label: 'Distortion',min: 0,  max: 100, defaultVal: 30, unit: '%' },
                  ].map(({ label, min, max, defaultVal, unit }) => (
                    <div key={label} className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 w-20">{label}</span>
                      <input type="range" min={min} max={max} defaultValue={defaultVal}
                        className="flex-1 cursor-pointer" style={{ accentColor: '#ef4444' }} />
                      <span className="text-xs text-gray-500 font-mono w-8">{unit}</span>
                    </div>
                  ))}
                  <button onClick={() => handleKick('kick')}
                    className="w-full py-2 bg-red-600/20 border border-red-500/40 text-red-400 text-sm font-bold rounded-lg hover:bg-red-600/40 transition-colors"
                  >▶ TRIGGER KICK</button>
                </div>
              </div>

              <div className="bg-gray-900/60 border border-pink-500/20 rounded-xl p-4">
                <h3 className="text-sm font-bold text-pink-400 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-pink-500" /> ACID 303
                </h3>
                <div className="space-y-3">
                  {[
                    { label: 'Note',      min: 36,  max: 72,   defaultVal: 55,  unit: 'midi' },
                    { label: 'Cutoff',    min: 100, max: 4000, defaultVal: 800, unit: 'Hz' },
                    { label: 'Resonance', min: 0,   max: 30,   defaultVal: 18,  unit: 'Q' },
                    { label: 'Duration',  min: 5,   max: 100,  defaultVal: 25,  unit: '0.%' },
                  ].map(({ label, min, max, defaultVal, unit }) => (
                    <div key={label} className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 w-20">{label}</span>
                      <input type="range" min={min} max={max} defaultValue={defaultVal}
                        className="flex-1 cursor-pointer" style={{ accentColor: '#ec4899' }} />
                      <span className="text-xs text-gray-500 font-mono w-8">{unit}</span>
                    </div>
                  ))}
                  <button onClick={() => handleAcid('acid')}
                    className="w-full py-2 bg-pink-600/20 border border-pink-500/40 text-pink-400 text-sm font-bold rounded-lg hover:bg-pink-600/40 transition-colors"
                  >▶ TRIGGER ACID</button>
                </div>
              </div>

              <div className="bg-gray-900/60 border border-orange-500/20 rounded-xl p-4">
                <h3 className="text-sm font-bold text-orange-400 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-orange-500" /> RUMBLE / SUB
                </h3>
                <p className="text-xs text-gray-500 mb-3">Low-frequency noise burst for intro textures or breakdown fillers.</p>
                <button
                  onClick={() => audioEngine.init().then(() => audioEngine.synthesisRumble('bass', 2))}
                  className="w-full py-2 bg-orange-600/20 border border-orange-500/40 text-orange-400 text-sm font-bold rounded-lg hover:bg-orange-600/40 transition-colors"
                >▶ TRIGGER RUMBLE 2s</button>
              </div>

              <div className="bg-gray-900/60 border border-cyan-500/20 rounded-xl p-4">
                <h3 className="text-sm font-bold text-cyan-400 mb-3 flex items-center gap-2">
                  <Mic className="w-3.5 h-3.5" /> BPM DETECT
                </h3>
                <p className="text-xs text-gray-500 mb-3">
                  Tap the TAP button in the transport bar to detect BPM from your rhythm.
                  Confidence improves after 4+ taps.
                </p>
                {tapResult && (
                  <div className="flex items-center justify-between bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2">
                    <span className="text-white font-mono font-bold text-lg">{tapResult.bpm} BPM</span>
                    <span className="text-xs text-green-400">
                      {Math.round(tapResult.confidence * 100)}% confidence
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activePanel === 'spectrum' && (
            <motion.div
              key="spectrum"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <BarChart2 className="w-3.5 h-3.5 text-purple-400" /> Master Spectrum
                </h3>
                <SpectrumViz isPlaying={engineState.isPlaying} />
                <div className="flex justify-between text-[10px] text-gray-600 mt-1 font-mono">
                  <span>20Hz</span><span>200Hz</span><span>2kHz</span><span>20kHz</span>
                </div>
              </div>

              <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Channel Levels</h3>
                <div className="space-y-2">
                  {channels.slice(0, 6).map((ch) => (
                    <div key={ch.id} className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 w-12 font-mono">{ch.name}</span>
                      <VuBar level={ch.level} color={ch.color} vertical={false} />
                      <span className="text-xs text-gray-600 font-mono w-8 text-right">
                        {Math.round(ch.level * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activePanel === 'clock' && (
            <motion.div
              key="clock"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-purple-400" /> Audio Routing
                </h3>
                <div className="space-y-2">
                  {channels.map((ch) => (
                    <div key={ch.id} className="flex items-center gap-3 bg-gray-800/40 border border-gray-700/40 rounded-lg px-3 py-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: ch.color }} />
                      <span className="text-xs text-white font-mono w-16">{ch.name}</span>
                      <ChevronRight className="w-3 h-3 text-gray-600" />
                      <span className="text-xs text-gray-500">Master Bus</span>
                      <span className="ml-auto text-xs text-gray-600 font-mono">
                        Vol: {Math.round(ch.volume * 100)}% | Pan: {Math.round(ch.pan * 100)}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center gap-3 bg-purple-600/10 border border-purple-500/30 rounded-lg px-3 py-2 mt-2">
                    <div className="w-2 h-2 rounded-full bg-purple-500" />
                    <span className="text-xs text-purple-300 font-mono w-16">MASTER</span>
                    <ChevronRight className="w-3 h-3 text-gray-600" />
                    <span className="text-xs text-gray-500">Compressor → Limiter → Output</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Compressor</h4>
                  <div className="space-y-2 text-xs font-mono">
                    {[
                      { label: 'Threshold', value: '-18 dB' },
                      { label: 'Ratio',     value: '3:1' },
                      { label: 'Attack',    value: '3 ms' },
                      { label: 'Release',   value: '250 ms' },
                      { label: 'Knee',      value: '6 dB' },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex justify-between text-gray-400">
                        <span className="text-gray-600">{label}</span>
                        <span className="text-cyan-400">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Limiter</h4>
                  <div className="space-y-2 text-xs font-mono">
                    {[
                      { label: 'Ceiling',  value: '-1 dBFS' },
                      { label: 'Ratio',    value: '20:1' },
                      { label: 'Attack',   value: '1 ms' },
                      { label: 'Release',  value: '50 ms' },
                      { label: 'Sample R', value: `${(engineState.sampleRate / 1000).toFixed(0)}k` },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex justify-between text-gray-400">
                        <span className="text-gray-600">{label}</span>
                        <span className="text-purple-400">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
