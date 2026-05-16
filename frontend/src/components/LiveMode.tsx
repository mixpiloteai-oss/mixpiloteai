// ============================================================
// NEUROTEK AI — Live Mode
// ============================================================
import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Square, Disc, Radio, Volume2, VolumeX, Zap } from 'lucide-react';
import clsx from 'clsx';
import { useAppStore } from '../store/appStore';
import { useAudioEngine } from '../hooks/useAudioEngine';
import { VuMeter } from './ui/VuMeter';
import { Button } from './ui/Button';
import type { PadCell, Scene } from '../types';

function Pad({ pad, onToggle }: { pad: PadCell; onToggle: (id: string) => void }) {
  const isEmpty = pad.isEmpty || !pad.label;

  return (
    <motion.button
      whileTap={!isEmpty ? { scale: 0.92 } : {}}
      onClick={() => !isEmpty && onToggle(pad.id)}
      className={clsx('pad-cell relative', pad.isActive && 'active', isEmpty && 'cursor-default')}
      style={{
        background: isEmpty
          ? 'rgba(15,15,26,0.4)'
          : pad.isActive
          ? `${pad.color}30`
          : `${pad.color}10`,
        border: `1px solid ${isEmpty ? 'rgba(255,255,255,0.03)' : pad.isActive ? pad.color + '80' : pad.color + '25'}`,
        boxShadow: pad.isActive ? `0 0 16px ${pad.color}40, inset 0 0 12px ${pad.color}15` : 'none',
      }}
    >
      {pad.isActive && (
        <motion.div
          className="absolute inset-0 rounded-lg"
          animate={{ opacity: [0.2, 0.5, 0.2] }}
          transition={{ duration: 1, repeat: Infinity }}
          style={{ background: pad.color }}
        />
      )}

      {pad.isActive && (
        <div
          className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
          style={{ background: pad.color, boxShadow: `0 0 4px ${pad.color}` }}
        />
      )}

      <div className="relative z-10 flex flex-col items-center justify-center h-full gap-1 p-2">
        {!isEmpty && (
          <span
            className="text-[10px] font-bold tracking-wider text-center leading-tight"
            style={{ color: pad.isActive ? pad.color : pad.color + '99' }}
          >
            {pad.label}
          </span>
        )}
      </div>
    </motion.button>
  );
}

function SceneRow({ scene, onLaunch }: { scene: Scene; onLaunch: (id: string) => void }) {
  return (
    <motion.button
      whileHover={{ x: 2 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onLaunch(scene.id)}
      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-150 text-left"
      style={{
        background: scene.isPlaying ? `${scene.color}15` : 'rgba(15,15,26,0.6)',
        border: `1px solid ${scene.isPlaying ? scene.color + '40' : 'rgba(255,255,255,0.04)'}`,
      }}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {scene.isPlaying ? (
          <motion.div
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 0.8, repeat: Infinity }}
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: scene.color }}
          />
        ) : (
          <Play size={10} style={{ color: scene.color }} />
        )}
        <span
          className="text-xs font-medium truncate"
          style={{ color: scene.isPlaying ? scene.color : '#94a3b8' }}
        >
          {scene.name}
        </span>
      </div>
      <span className="text-[9px] text-text-muted flex-shrink-0">{scene.pads.length} clips</span>
    </motion.button>
  );
}

export function LiveMode() {
  const { liveSession, setLiveSession, activeProject } = useAppStore();
  const { masterVu, bpm, playbackState, play, stop, tapTempo, trackVu } = useAudioEngine();
  const [isRecording, setIsRecording] = useState(false);

  const pads = liveSession?.pads ?? [];
  const scenes = liveSession?.scenes ?? [];
  const isPlaying = playbackState === 'playing';

  const togglePad = useCallback(
    (padId: string) => {
      if (!liveSession) return;
      setLiveSession({
        ...liveSession,
        pads: liveSession.pads.map((p) =>
          p.id === padId ? { ...p, isActive: !p.isActive } : p
        ),
      });
    },
    [liveSession, setLiveSession]
  );

  const launchScene = useCallback(
    (sceneId: string) => {
      if (!liveSession) return;
      setLiveSession({
        ...liveSession,
        scenes: liveSession.scenes.map((s) => ({
          ...s,
          isPlaying: s.id === sceneId ? !s.isPlaying : false,
        })),
        pads: liveSession.pads.map((p) => {
          const scene = liveSession.scenes.find((s) => s.id === sceneId);
          if (!scene) return p;
          return { ...p, isActive: scene.pads.includes(p.id) ? !scene.isPlaying : false };
        }),
      });
      if (!isPlaying) play();
    },
    [liveSession, setLiveSession, isPlaying, play]
  );

  const tracks = activeProject?.tracks ?? [];
  const trackCols = tracks.slice(0, 6);

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: '#0a0a0f' }}>
      <div
        className="flex-shrink-0 flex items-center gap-4 px-6 py-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        <div
          className="flex flex-col items-center px-4 py-1.5 rounded-xl select-none"
          style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)' }}
        >
          <span className="text-[9px] text-violet-400 uppercase tracking-widest font-mono">BPM</span>
          <span className="text-2xl font-bold font-mono text-violet-300">{bpm}</span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={isPlaying ? 'danger' : 'primary'}
            size="sm"
            icon={isPlaying ? <Square size={14} /> : <Play size={14} />}
            onClick={isPlaying ? stop : play}
          >
            {isPlaying ? 'Stop' : 'Play'}
          </Button>
          <Button variant="secondary" size="sm" onClick={tapTempo} title="Tap BPM">TAP</Button>
          <Button
            variant={isRecording ? 'danger' : 'ghost'}
            size="sm"
            icon={<Disc size={14} />}
            onClick={() => setIsRecording((r) => !r)}
          >
            {isRecording ? 'REC' : 'Arm'}
          </Button>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {isRecording && (
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 0.8, repeat: Infinity }}
              className="flex items-center gap-1.5"
            >
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-xs text-red-400 font-mono">RECORDING</span>
            </motion.div>
          )}
          {isPlaying && (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-emerald-400 font-mono">LIVE</span>
            </div>
          )}
          <Radio size={14} className="text-text-muted" />
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div
          className="w-44 flex-shrink-0 flex flex-col p-3 gap-2 overflow-y-auto scroll-area"
          style={{ borderRight: '1px solid rgba(255,255,255,0.05)' }}
        >
          <p className="text-[9px] text-text-muted uppercase tracking-widest px-1 mb-1">Scenes</p>
          {scenes.map((scene) => (
            <SceneRow key={scene.id} scene={scene} onLaunch={launchScene} />
          ))}
        </div>

        <div className="flex-1 flex flex-col p-6 gap-4">
          <p className="text-[9px] text-text-muted uppercase tracking-widest">Clip Launcher</p>
          <div
            className="grid gap-3"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: 'repeat(4, 1fr)', flex: 1 }}
          >
            {pads.map((pad) => (
              <Pad key={pad.id} pad={pad} onToggle={togglePad} />
            ))}
          </div>
        </div>

        <div
          className="w-52 flex-shrink-0 flex flex-col p-4 gap-4 overflow-y-auto scroll-area"
          style={{ borderLeft: '1px solid rgba(255,255,255,0.05)' }}
        >
          <div>
            <p className="text-[9px] text-text-muted uppercase tracking-widest mb-3">Master Output</p>
            <div className="flex gap-4 justify-center">
              <VuMeter state={masterVu} height={100} width={20} segments={24} showPeak label="L" />
              <VuMeter
                state={{ ...masterVu, left: masterVu.right, right: masterVu.left }}
                height={100} width={20} segments={24} showPeak label="R"
              />
            </div>
            <div
              className="mt-2 text-center text-[10px] font-mono"
              style={{ color: masterVu.clipping ? '#ef4444' : '#10b981' }}
            >
              {masterVu.clipping ? '⚡ CLIP!' : `${(-((1 - masterVu.left) * 60)).toFixed(1)} dB`}
            </div>
          </div>

          <div>
            <p className="text-[9px] text-text-muted uppercase tracking-widest mb-2">Track Mutes</p>
            <div className="space-y-1.5">
              {trackCols.map((track) => (
                <div key={track.id} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: track.color }} />
                  <span className="text-[10px] text-text-secondary flex-1 truncate">{track.name}</span>
                  <VuMeter state={trackVu[track.id]} height={16} width={8} segments={5} showPeak={false} mono />
                  <button
                    className={clsx(
                      'w-5 h-5 rounded flex items-center justify-center transition-colors',
                      track.muted ? 'text-amber-400' : 'text-text-muted'
                    )}
                  >
                    {track.muted ? <VolumeX size={10} /> : <Volume2 size={10} />}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[9px] text-text-muted uppercase tracking-widest mb-2">Controls</p>
            <div className="grid grid-cols-2 gap-2">
              {['Cue A', 'Cue B', 'Filter', 'Reverb'].map((ctrl) => (
                <button
                  key={ctrl}
                  className="px-2 py-2 rounded-lg text-[10px] text-text-muted hover:text-text-primary transition-colors"
                  style={{ background: 'rgba(15,15,26,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  {ctrl}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
