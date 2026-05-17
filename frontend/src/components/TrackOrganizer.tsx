// ============================================================
// NEUROTEK AI — Track Organizer
// ============================================================
import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import {
  Volume2,
  VolumeX,
  Headphones,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Zap,
  Plus,
  Wand2,
  Music2,
} from 'lucide-react';
import clsx from 'clsx';
import { useAppStore } from '../store/appStore';
import { useProjects } from '../hooks/useProjects';
import { MiniWaveform } from './ui/Waveform';
import { VuMeter } from './ui/VuMeter';
import { TrackTypeBadge } from './ui/Badge';
import { Button } from './ui/Button';
import { Slider } from './ui/Slider';
import type { Track } from '../types';

const trackTypeOrder = ['kick', 'bass', 'acid', 'melody', 'pad', 'arp', 'percussion', 'fx', 'vocal', 'master'];

function TrackRow({
  track,
  vuState,
  onMute,
  onSolo,
  onVolumeChange,
}: {
  track: Track;
  vuState?: { left: number; right: number; peak: number; clipping: boolean };
  onMute: () => void;
  onSolo: () => void;
  onVolumeChange: (v: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Reorder.Item value={track} id={track.id} as="div">
      <motion.div
        layout
        className={clsx(
          'rounded-xl overflow-hidden mb-2 transition-all duration-150',
          track.muted && 'opacity-50'
        )}
        style={{
          background: 'rgba(20,20,32,0.8)',
          border: `1px solid ${expanded ? track.color + '30' : 'rgba(255,255,255,0.04)'}`,
        }}
      >
        <div className="flex items-center gap-2 px-3 py-2.5 group">
          <button className="cursor-grab active:cursor-grabbing text-text-muted hover:text-text-primary flex-shrink-0 touch-none">
            <GripVertical size={14} />
          </button>

          <div
            className="w-1 h-8 rounded-full flex-shrink-0"
            style={{ background: track.color, boxShadow: `0 0 6px ${track.color}60` }}
          />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-text-primary truncate">{track.name}</span>
              <TrackTypeBadge type={track.type} />
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-text-muted">{track.fx?.length ?? 0} FX</span>
              <span className="text-[10px] text-text-muted">·</span>
              <span className="text-[10px] text-text-muted">{track.clipCount} clips</span>
              {track.bpm && <span className="text-[10px] text-text-muted">· {track.bpm} BPM</span>}
            </div>
          </div>

          <div className="hidden md:block w-20 h-6 flex-shrink-0">
            <MiniWaveform data={track.waveformData} color={track.color} />
          </div>

          <VuMeter state={vuState} height={28} width={12} segments={8} showPeak={false} mono />

          <div className="w-24 hidden lg:block flex-shrink-0">
            <Slider value={track.volume ?? 100} min={0} max={127} color={track.color} onChange={onVolumeChange} />
          </div>

          <span className="text-[10px] font-mono text-text-muted w-6 text-right flex-shrink-0">{track.volume}</span>

          <button
            onClick={onMute}
            className={clsx(
              'w-7 h-7 rounded flex items-center justify-center transition-colors flex-shrink-0',
              track.muted ? 'text-amber-400 bg-amber-400/15' : 'text-text-muted hover:text-amber-400'
            )}
            title="Mute"
          >
            {track.muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
          </button>

          <button
            onClick={onSolo}
            className={clsx(
              'w-7 h-7 rounded flex items-center justify-center transition-colors flex-shrink-0',
              track.soloed ? 'text-cyan-400 bg-cyan-400/15' : 'text-text-muted hover:text-cyan-400'
            )}
            title="Solo"
          >
            <Headphones size={13} />
          </button>

          <button
            onClick={() => setExpanded((e) => !e)}
            className="w-7 h-7 rounded flex items-center justify-center text-text-muted hover:text-text-primary transition-colors flex-shrink-0"
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-3 pt-1" style={{ borderTop: `1px solid ${track.color}15` }}>
                <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">FX Chain</p>
                {(track.fx?.length ?? 0) === 0 ? (
                  <p className="text-xs text-text-muted">No effects</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {(track.fx ?? []).map((fx, i) => (
                      <div
                        key={i}
                        className={clsx(
                          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs',
                          fx.enabled ? 'opacity-100' : 'opacity-40'
                        )}
                        style={{ background: `${track.color}10`, border: `1px solid ${track.color}25`, color: track.color }}
                      >
                        <Zap size={10} />
                        <span className="font-medium">{fx.name}</span>
                        <span className="text-[9px] opacity-60 capitalize">{fx.type}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-3">
                  <Slider
                    value={track.pan ?? 0}
                    min={-64}
                    max={64}
                    color={track.color}
                    label="Pan"
                    showValue
                    formatValue={(v) => v === 0 ? 'C' : v > 0 ? `R${v}` : `L${Math.abs(v)}`}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </Reorder.Item>
  );
}

export function TrackOrganizer() {
  const { activeProject, audioEngine } = useAppStore();
  const { updateActiveTrack, selectProject, projects } = useProjects();
  const [tracks, setTracks] = useState<Track[]>(activeProject?.tracks ?? []);
  const [sortBy, setSortBy] = useState<'order' | 'type' | 'name'>('order');

  const sortedTracks = [...tracks].sort((a, b) => {
    if (sortBy === 'type') return trackTypeOrder.indexOf(a.type) - trackTypeOrder.indexOf(b.type);
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    return (a.order ?? 0) - (b.order ?? 0);
  });

  const handleMute = useCallback(
    (track: Track) => {
      setTracks((prev) => prev.map((t) => (t.id === track.id ? { ...t, muted: !t.muted } : t)));
      updateActiveTrack(track.id, { muted: !track.muted });
    },
    [updateActiveTrack]
  );

  const handleSolo = useCallback(
    (track: Track) => {
      setTracks((prev) => prev.map((t) => (t.id === track.id ? { ...t, soloed: !t.soloed } : t)));
      updateActiveTrack(track.id, { soloed: !track.soloed });
    },
    [updateActiveTrack]
  );

  const handleVolume = useCallback(
    (track: Track, volume: number) => {
      setTracks((prev) => prev.map((t) => (t.id === track.id ? { ...t, volume } : t)));
      updateActiveTrack(track.id, { volume });
    },
    [updateActiveTrack]
  );

  if (!activeProject) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="text-text-muted text-center">
          <Music2 size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No project selected</p>
          <p className="text-xs mt-1">Select a project from the Dashboard</p>
        </div>
        <div className="flex flex-wrap gap-2 max-w-sm justify-center">
          {projects.slice(0, 3).map((p) => (
            <Button key={p.id} variant="secondary" size="sm" onClick={() => selectProject(p.id)}>
              {p.name}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div
        className="flex-shrink-0 flex items-center gap-3 px-6 py-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        <div className="flex-1">
          <h1 className="text-base font-semibold text-text-primary">{activeProject.name}</h1>
          <p className="text-xs text-text-muted">{tracks.length} tracks · {activeProject.bpm} BPM</p>
        </div>

        <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: 'rgba(15,15,26,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}>
          {(['order', 'type', 'name'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={clsx(
                'px-3 py-1 rounded text-xs capitalize transition-all',
                sortBy === s ? 'bg-accent-primary text-white' : 'text-text-muted hover:text-text-primary'
              )}
            >
              {s}
            </button>
          ))}
        </div>

        <Button variant="ghost" size="sm" icon={<Wand2 size={14} />}>Auto-classify</Button>
        <Button variant="secondary" size="sm" icon={<Plus size={14} />}>Add Track</Button>
      </div>

      <div className="flex-1 overflow-y-auto scroll-area p-6">
        <Reorder.Group axis="y" values={sortedTracks} onReorder={setTracks} as="div">
          {sortedTracks.map((track) => (
            <TrackRow
              key={track.id}
              track={track}
              vuState={audioEngine.trackVu[track.id]}
              onMute={() => handleMute(track)}
              onSolo={() => handleSolo(track)}
              onVolumeChange={(v) => handleVolume(track, v)}
            />
          ))}
        </Reorder.Group>

        {tracks.length === 0 && (
          <div className="text-center py-16 text-text-muted">
            <p className="text-sm">No tracks in this project</p>
          </div>
        )}
      </div>
    </div>
  );
}
