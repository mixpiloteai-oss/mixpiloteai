// ============================================================
// NEUROTEK AI — Clip Launcher Panel
// Ableton-style scene/clip grid, quantised to beat clock
// ============================================================
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Square, SkipForward, Upload, Zap, Grid3x3,
} from 'lucide-react';
import clipLauncher, {
  type Clip, type Scene, type LauncherTrack, type ClipState, type ClipColor,
} from '../services/clipLauncher';
import audioEngine from '../services/realAudioEngine';

// ── Constants ─────────────────────────────────────────────────
const COLOR_MAP: Record<ClipColor, { bg: string; border: string; glow: string; text: string }> = {
  red:    { bg: '#ef444420', border: '#ef4444', glow: '#ef444440', text: '#f87171' },
  orange: { bg: '#f9731620', border: '#f97316', glow: '#f9731640', text: '#fb923c' },
  green:  { bg: '#22c55e20', border: '#22c55e', glow: '#22c55e40', text: '#4ade80' },
  yellow: { bg: '#eab30820', border: '#eab308', glow: '#eab30840', text: '#facc15' },
  purple: { bg: '#a855f720', border: '#a855f7', glow: '#a855f740', text: '#c084fc' },
  cyan:   { bg: '#06b6d420', border: '#06b6d4', glow: '#06b6d440', text: '#22d3ee' },
  pink:   { bg: '#ec489920', border: '#ec4899', glow: '#ec489940', text: '#f472b6' },
  gray:   { bg: '#6b728020', border: '#6b7280', glow: '#6b728040', text: '#9ca3af' },
};

const STATE_ICONS: Record<ClipState, string> = {
  empty:    '○',
  loaded:   '▷',
  queued:   '◆',
  playing:  '▶',
  stopping: '◻',
};

// ── Seed default layout ────────────────────────────────────────────
function seedDefaultLayout() {
  const tracks = [
    { id: 't-kick',  name: 'KICK',   color: 'red'    as ClipColor },
    { id: 't-bass',  name: 'BASS',   color: 'orange' as ClipColor },
    { id: 't-mel',   name: 'MELODY', color: 'purple' as ClipColor },
    { id: 't-perc',  name: 'PERC',   color: 'yellow' as ClipColor },
    { id: 't-fx',    name: 'FX',     color: 'cyan'   as ClipColor },
    { id: 't-acid',  name: 'ACID',   color: 'pink'   as ClipColor },
  ];
  const scenes = [
    { id: 's-intro', name: 'INTRO',     color: 'purple' as ClipColor },
    { id: 's-build', name: 'BUILD',     color: 'cyan'   as ClipColor },
    { id: 's-drop',  name: 'DROP',      color: 'red'    as ClipColor },
    { id: 's-break', name: 'BREAKDOWN', color: 'yellow' as ClipColor },
    { id: 's-outro', name: 'OUTRO',     color: 'gray'   as ClipColor },
  ];

  tracks.forEach((t) => clipLauncher.addTrack(t.id, t.name, t.color));
  scenes.forEach((s) => {
    clipLauncher.addScene(s.id, s.name, s.color);
    tracks.forEach((t, ti) => {
      clipLauncher.addClip(t.id, s.id, {
        name: `${t.name} ${s.name}`,
        color: t.color,
        bpm: 140,
        length: ti % 2 === 0 ? 2 : 4,
      });
    });
  });
}

let seeded = false;

// ── Clip button ────────────────────────────────────────────────
function ClipButton({ clip, onLaunch, onLoad }: {
  clip: Clip;
  onLaunch: (id: string) => void;
  onLoad: (clipId: string) => void;
}) {
  const c = COLOR_MAP[clip.color];
  const isActive = clip.state === 'playing' || clip.state === 'queued';
  const isEmpty = clip.state === 'empty';

  return (
    <motion.button
      onClick={() => isEmpty ? onLoad(clip.id) : onLaunch(clip.id)}
      whileTap={{ scale: 0.94 }}
      className="relative w-full h-14 rounded-lg text-[10px] font-bold transition-all overflow-hidden flex flex-col items-center justify-center gap-0.5"
      style={{
        background: isEmpty ? 'rgba(255,255,255,0.02)' : c.bg,
        border: `1px solid ${isEmpty ? 'rgba(255,255,255,0.06)' : c.border}`,
        boxShadow: isActive ? `0 0 16px ${c.glow}` : 'none',
        color: isEmpty ? '#374151' : c.text,
      }}
      title={clip.name}
    >
      {clip.state === 'queued' && (
        <motion.div
          className="absolute inset-0 rounded-lg"
          style={{ background: c.bg }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 0.5, repeat: Infinity }}
        />
      )}
      {clip.state === 'playing' && (
        <motion.div
          className="absolute bottom-0 left-0 h-0.5 rounded-full"
          style={{ background: c.border }}
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: (60 / 140) * clip.length * 4, ease: 'linear', repeat: Infinity }}
        />
      )}
      <span className="relative z-10 text-base leading-none">{STATE_ICONS[clip.state]}</span>
      {!isEmpty && (
        <span className="relative z-10 text-[9px] opacity-70 truncate max-w-full px-1">{clip.length}b</span>
      )}
      {isEmpty && (
        <span className="relative z-10 text-[9px] opacity-40">+ load</span>
      )}
    </motion.button>
  );
}

// ── Scene launch button ──────────────────────────────────────────
function SceneButton({ scene, onLaunch }: { scene: Scene; onLaunch: (id: string) => void }) {
  const c = COLOR_MAP[scene.color];
  const hasPlaying = scene.clips.some((cl) => cl.state === 'playing' || cl.state === 'queued');

  return (
    <button
      onClick={() => onLaunch(scene.id)}
      className="w-full h-14 rounded-lg flex items-center justify-center gap-1.5 text-[10px] font-bold transition-all"
      style={{
        background: hasPlaying ? c.bg : 'rgba(255,255,255,0.03)',
        border: `1px solid ${hasPlaying ? c.border : 'rgba(255,255,255,0.06)'}`,
        color: hasPlaying ? c.text : '#6b7280',
        boxShadow: hasPlaying ? `0 0 12px ${c.glow}` : 'none',
      }}
      title={`Launch scene: ${scene.name}`}
    >
      <Play className="w-3 h-3" />
      <span className="tracking-widest">{scene.name}</span>
    </button>
  );
}

// ── Demo clip loader ───────────────────────────────────────────────
async function loadDemoClip(clipId: string): Promise<void> {
  await audioEngine.init();
  const ctx = audioEngine.audioContext;
  if (!ctx) return;

  const bpm = audioEngine.bpm;
  const bars = 2;
  const barDuration = (60 / bpm) * 4;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * bars * barDuration), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  const blipInterval = Math.floor(ctx.sampleRate * (60 / bpm));
  for (let i = 0; i < data.length; i++) {
    const phase = (i % blipInterval) / blipInterval;
    data[i] = phase < 0.01 ? (Math.random() * 2 - 1) * 0.8 : 0;
  }
  clipLauncher.loadBuffer(clipId, buffer, bpm);
}

// ── Main ClipLauncherPanel ───────────────────────────────────
export default function ClipLauncherPanel() {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [tracks, setTracks] = useState<LauncherTrack[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loadingClip, setLoadingClip] = useState<string | null>(null);

  useEffect(() => {
    if (!seeded) { seeded = true; seedDefaultLayout(); }

    const refresh = () => {
      setScenes([...clipLauncher.getScenes()]);
      setTracks([...clipLauncher.getTracks()]);
    };
    refresh();
    const unsub = clipLauncher.onChange(refresh);
    const unsubState = audioEngine.onStateChange((s) => setIsPlaying(s.isPlaying));
    return () => { unsub(); unsubState(); };
  }, []);

  const handleLaunch = useCallback(async (clipId: string) => {
    if (!isPlaying) { await audioEngine.init(); audioEngine.start(); }
    clipLauncher.launchClip(clipId);
  }, [isPlaying]);

  const handleSceneLaunch = useCallback(async (sceneId: string) => {
    if (!isPlaying) { await audioEngine.init(); audioEngine.start(); }
    clipLauncher.launchScene(sceneId);
  }, [isPlaying]);

  const handleLoad = useCallback(async (clipId: string) => {
    setLoadingClip(clipId);
    await loadDemoClip(clipId);
    setLoadingClip(null);
  }, []);

  const handlePlayStop = useCallback(async () => {
    await audioEngine.init();
    if (isPlaying) { audioEngine.stop(); clipLauncher.stopAll(); }
    else audioEngine.start();
  }, [isPlaying]);

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f] text-white overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-800/60 px-5 py-3 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center">
            <Grid3x3 className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <span className="text-sm font-bold tracking-wider">CLIP LAUNCHER</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-purple-600/20 text-purple-300 border border-purple-500/30">
            {scenes.length} scenes · {tracks.length} tracks
          </span>
        </div>

        <button
          onClick={handlePlayStop}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            isPlaying ? 'bg-red-600 hover:bg-red-500' : 'bg-purple-600 hover:bg-purple-500'
          }`}
        >
          {isPlaying ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          {isPlaying ? 'STOP' : 'PLAY'}
        </button>

        <button
          onClick={() => clipLauncher.stopAll()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-red-400 border border-red-900/40 hover:bg-red-900/20 transition-all font-semibold"
        >
          <SkipForward className="w-3.5 h-3.5" />
          Stop All
        </button>

        <div className="ml-auto flex items-center gap-2 text-xs text-gray-500">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>Quantised to bar</span>
          <span className="w-2 h-2 rounded-full ml-1" style={{
            background: isPlaying ? '#10b981' : '#374151',
            boxShadow: isPlaying ? '0 0 8px #10b981' : 'none',
          }} />
        </div>
      </div>

      {/* Legend */}
      <div className="flex-shrink-0 flex items-center gap-4 px-5 py-2 border-b border-gray-800/40 text-[10px] text-gray-600">
        {Object.entries(STATE_ICONS).map(([state, icon]) => (
          <div key={state} className="flex items-center gap-1">
            <span className="text-gray-400">{icon}</span>
            <span>{state}</span>
          </div>
        ))}
        <span className="ml-auto text-gray-700">Click empty = load demo · Click loaded = queue · Click playing = stop at bar</span>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto p-4">
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `140px repeat(${tracks.length}, minmax(80px, 1fr)) 90px` }}
        >
          {/* Track header row */}
          <div />
          {tracks.map((track) => {
            const c = COLOR_MAP[track.color];
            return (
              <div
                key={track.id}
                className="h-8 rounded-lg flex items-center justify-center text-[10px] font-bold tracking-widest"
                style={{ background: c.bg, border: `1px solid ${c.border}30`, color: c.text }}
              >
                {track.name}
              </div>
            );
          })}
          <div className="h-8 flex items-center justify-center text-[10px] text-gray-600 font-bold tracking-widest">SCENE</div>

          {/* Scene rows */}
          {scenes.map((scene) => (
            <React.Fragment key={scene.id}>
              <div className="flex items-center">
                <div
                  className="text-[10px] font-bold tracking-widest px-2 py-1 rounded-lg w-full truncate"
                  style={{ color: COLOR_MAP[scene.color].text }}
                >
                  {scene.name}
                </div>
              </div>

              {tracks.map((track) => {
                const clip = scene.clips.find((cl) => cl.trackId === track.id);
                if (!clip) return <div key={track.id} className="h-14 rounded-lg bg-gray-900/20 border border-gray-800/30" />;
                return (
                  <div key={track.id} className="relative">
                    {loadingClip === clip.id && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-black/60">
                        <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                    <ClipButton clip={clip} onLaunch={handleLaunch} onLoad={handleLoad} />
                  </div>
                );
              })}

              <SceneButton scene={scene} onLaunch={handleSceneLaunch} />
            </React.Fragment>
          ))}

          {/* Stop row */}
          <div className="flex items-center">
            <span className="text-[10px] text-gray-700 font-bold tracking-widest px-2">STOP</span>
          </div>
          {tracks.map((track) => (
            <button
              key={track.id}
              onClick={() => {
                scenes.forEach((s) => {
                  const clip = s.clips.find((cl) => cl.trackId === track.id && cl.state === 'playing');
                  if (clip) clipLauncher.launchClip(clip.id);
                });
              }}
              className="h-8 rounded-lg flex items-center justify-center text-red-500/60 hover:text-red-400 hover:bg-red-900/20 border border-red-900/20 hover:border-red-500/30 transition-all"
              title={`Stop ${track.name}`}
            >
              <Square className="w-3 h-3" />
            </button>
          ))}
          <button
            onClick={() => clipLauncher.stopAll()}
            className="h-8 rounded-lg flex items-center justify-center gap-1 text-[10px] font-bold text-red-400 hover:bg-red-900/20 border border-red-900/30 hover:border-red-500/40 transition-all"
            title="Stop all clips"
          >
            <Square className="w-3 h-3" /> ALL
          </button>
        </div>

        {/* Help */}
        <div className="mt-6 p-4 bg-gray-900/40 border border-gray-800/40 rounded-xl">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
            <Upload className="w-3.5 h-3.5 text-purple-400" />
            How to use
          </h3>
          <ul className="space-y-1 text-[11px] text-gray-600">
            <li>• <span className="text-gray-500">Click empty cell</span> — generates and loads a demo audio clip</li>
            <li>• <span className="text-gray-500">Click loaded clip</span> — queues it (launches on next bar downbeat)</li>
            <li>• <span className="text-gray-500">Click playing clip</span> — schedules stop at next bar</li>
            <li>• <span className="text-gray-500">Click SCENE button</span> — queues all loaded clips in that row simultaneously</li>
            <li>• All transitions are quantised to the beat clock (bar boundary)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
