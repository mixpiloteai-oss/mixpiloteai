// ============================================================
// NEUROTEK AI — AI Production Panel
// One-click AI pattern & project generation per genre
// ============================================================
import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wand2,
  Zap,
  Layers,
  RefreshCw,
  Download,
  Play,
  Sparkles,
} from 'lucide-react';
import type { Genre, TrackType } from '../types';
import {
  generatePatternForTrack,
  generateFullProject,
  getGenreDescription,
  getSupportedGenres,
  suggestBpmForGenre,
  type GeneratedPattern,
  type GeneratedProject,
} from '../services/aiMusicEngine';
import { audioEngine } from '../services/realAudioEngine';

// ── Genre config ──────────────────────────────────────────────

const GENRE_COLORS: Record<Genre, string> = {
  mentalcore:    '#ef4444',
  hardtek:       '#f59e0b',
  tribe:         '#10b981',
  acidcore:      '#06b6d4',
  'hard-techno': '#8b5cf6',
  tekno:         '#ec4899',
  industrial:    '#64748b',
  neurofunk:     '#7c3aed',
};

const GENRE_ICONS: Record<Genre, string> = {
  mentalcore:    '⚡',
  hardtek:       '🔥',
  tribe:         '🌀',
  acidcore:      '🧪',
  'hard-techno': '🏭',
  tekno:         '🎛️',
  industrial:    '⚙️',
  neurofunk:     '🧠',
};

const TRACK_TYPES: Array<{ type: TrackType; label: string; icon: string }> = [
  { type: 'kick',       label: 'Kick',  icon: '🥁' },
  { type: 'bass',       label: 'Bass',  icon: '🎸' },
  { type: 'melody',     label: 'Melody',icon: '🎹' },
  { type: 'acid',       label: 'Acid',  icon: '🧪' },
  { type: 'percussion', label: 'Perc',  icon: '🪘' },
  { type: 'pad',        label: 'Pad',   icon: '🌊' },
];

// ── Mini piano roll preview ───────────────────────────────────

function PatternPreview({ pattern }: { pattern: GeneratedPattern }) {
  if (!pattern.notes.length) return null;
  const totalBeats = pattern.lengthBars * 4;
  const minP = Math.min(...pattern.notes.map((n) => n.pitch));
  const maxP = Math.max(...pattern.notes.map((n) => n.pitch));
  const pitchRange = Math.max(maxP - minP + 1, 12);

  return (
    <div
      className="w-full rounded overflow-hidden relative"
      style={{ height: 48, background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      {pattern.notes.slice(0, 64).map((note, i) => {
        const x = (note.beat / totalBeats) * 100;
        const w = Math.max(1, (note.duration / totalBeats) * 100);
        const y = ((maxP - note.pitch) / pitchRange) * 100;
        const h = (1 / pitchRange) * 100;
        const alpha = 0.5 + (note.velocity / 127) * 0.5;
        return (
          <div
            key={i}
            className="absolute rounded-sm"
            style={{
              left: `${x}%`, width: `${w}%`,
              top: `${y}%`, height: `${Math.max(h, 4)}%`,
              background: `rgba(124,58,237,${alpha})`,
            }}
          />
        );
      })}
    </div>
  );
}

// ── Generated pattern card ────────────────────────────────────

function PatternCard({
  trackType, pattern, onRegenerate, onPreview,
}: {
  trackType: TrackType; pattern: GeneratedPattern;
  onRegenerate: () => void; onPreview: () => void;
}) {
  const info = TRACK_TYPES.find((t) => t.type === trackType);
  return (
    <div
      className="rounded-lg p-3 flex flex-col gap-2"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">{info?.icon}</span>
          <span className="text-xs font-bold" style={{ color: '#cbd5e1' }}>{info?.label}</span>
          <span className="text-xs" style={{ color: '#475569' }}>{pattern.notes.length} notes</span>
        </div>
        <div className="flex items-center gap-1">
          <motion.button whileTap={{ scale: 0.9 }} onClick={onPreview}
            className="w-6 h-6 flex items-center justify-center rounded"
            style={{ background: 'rgba(6,182,212,0.15)', border: '1px solid rgba(6,182,212,0.3)', color: '#06b6d4' }}
            title="Preview"
          >
            <Play size={9} />
          </motion.button>
          <motion.button whileTap={{ scale: 0.9 }} onClick={onRegenerate}
            className="w-6 h-6 flex items-center justify-center rounded"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#64748b' }}
            title="Regenerate"
          >
            <RefreshCw size={9} />
          </motion.button>
        </div>
      </div>
      <PatternPreview pattern={pattern} />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────

export default function AIProductionPanel() {
  const [selectedGenre, setSelectedGenre] = useState<Genre>('hardtek');
  const [bpm, setBpm] = useState(suggestBpmForGenre('hardtek'));
  const [bars, setBars] = useState(2);
  const [generating, setGenerating] = useState(false);
  const [patterns, setPatterns] = useState<Map<TrackType, GeneratedPattern>>(new Map());
  const [generatedProject, setGeneratedProject] = useState<GeneratedProject | null>(null);
  const [playingTrack, setPlayingTrack] = useState<TrackType | null>(null);
  const [activeTab, setActiveTab] = useState<'patterns' | 'project'>('patterns');
  const [seeds, setSeeds] = useState<Map<TrackType, number>>(new Map());

  const genres = getSupportedGenres();

  const handleGenreSelect = (genre: Genre) => {
    setSelectedGenre(genre);
    setBpm(suggestBpmForGenre(genre));
  };

  const generateSinglePattern = useCallback(
    async (trackType: TrackType, customSeed?: number) => {
      const seed = customSeed ?? Math.floor(Math.random() * 100000);
      setSeeds((prev) => new Map(prev).set(trackType, seed));
      const p = generatePatternForTrack(trackType, selectedGenre, bars, seed);
      setPatterns((prev) => new Map(prev).set(trackType, p));
    },
    [selectedGenre, bars],
  );

  const generateAllPatterns = useCallback(async () => {
    setGenerating(true);
    try {
      const newPatterns = new Map<TrackType, GeneratedPattern>();
      const newSeeds = new Map<TrackType, number>();
      for (const { type } of TRACK_TYPES) {
        const seed = Math.floor(Math.random() * 100000);
        newSeeds.set(type, seed);
        newPatterns.set(type, generatePatternForTrack(type, selectedGenre, bars, seed));
        await new Promise<void>((r) => setTimeout(r, 60));
      }
      setPatterns(newPatterns);
      setSeeds(newSeeds);
    } finally {
      setGenerating(false);
    }
  }, [selectedGenre, bars]);

  const generateProject = useCallback(async () => {
    setGenerating(true);
    try {
      await new Promise<void>((r) => setTimeout(r, 400));
      const proj = generateFullProject(selectedGenre);
      setGeneratedProject(proj);
      const newPatterns = new Map<TrackType, GeneratedPattern>();
      for (const { trackType, pattern } of proj.patterns) newPatterns.set(trackType, pattern);
      setPatterns(newPatterns);
      setActiveTab('project');
    } finally {
      setGenerating(false);
    }
  }, [selectedGenre]);

  const previewPattern = useCallback(
    async (trackType: TrackType) => {
      const pattern = patterns.get(trackType);
      if (!pattern || !pattern.notes.length) return;
      try {
        await audioEngine.init();
        audioEngine.setBpm(bpm);
        setPlayingTrack(trackType);
        if (trackType === 'kick') {
          const kickNotes = pattern.notes.slice(0, 8);
          const beatDur = 60 / bpm;
          kickNotes.forEach((note) => {
            setTimeout(() => audioEngine.synthesisKick('preview-kick', { freq: 55, decay: 0.3 }), note.beat * beatDur * 1000);
          });
          const endMs = (kickNotes[kickNotes.length - 1]?.beat ?? 1) * beatDur * 1000 + 400;
          setTimeout(() => setPlayingTrack(null), endMs);
        } else if (trackType === 'acid') {
          const acidNotes = pattern.notes.slice(0, 16);
          const beatDur = 60 / bpm;
          const freqs = [55, 73, 82, 110, 123, 146];
          acidNotes.forEach((note, i) => {
            setTimeout(() => audioEngine.synthesisAcidBass('preview-acid', {
              freq: freqs[i % freqs.length], cutoff: 800 + Math.sin(i * 0.8) * 400, resonance: 15, duration: note.duration * beatDur,
            }), note.beat * beatDur * 1000);
          });
          const endMs = (acidNotes[acidNotes.length - 1]?.beat ?? 2) * beatDur * 1000 + 400;
          setTimeout(() => setPlayingTrack(null), endMs);
        } else {
          setTimeout(() => setPlayingTrack(null), 1500);
        }
      } catch {
        setPlayingTrack(null);
      }
    },
    [patterns, bpm],
  );

  // suppress unused warning
  void playingTrack;

  const color = GENRE_COLORS[selectedGenre];

  return (
    <div className="flex flex-col h-full w-full overflow-hidden" style={{ background: '#0a0a0f', color: '#e2e8f0' }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 shrink-0 border-b"
        style={{ height: 48, borderColor: 'rgba(255,255,255,0.08)', background: '#0f0f18' }}
      >
        <div
          className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold tracking-widest"
          style={{ background: 'rgba(124,58,237,0.2)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.4)' }}
        >
          <Sparkles size={10} />
          AI PRODUCTION
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs" style={{ color: '#475569' }}>BPM</span>
          <input
            type="number" value={bpm}
            onChange={(e) => setBpm(Math.max(60, Math.min(300, parseInt(e.target.value, 10) || 140)))}
            min={60} max={300}
            className="w-14 text-center text-xs font-mono rounded px-1 py-0.5 outline-none"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f1f5f9' }}
          />
          <span className="text-xs" style={{ color: '#475569' }}>BARS</span>
          <select
            value={bars} onChange={(e) => setBars(parseInt(e.target.value, 10))}
            className="text-xs rounded px-1 py-0.5 outline-none"
            style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', color: '#f1f5f9' }}
          >
            {[1, 2, 4, 8].map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Genre sidebar */}
        <div
          className="flex flex-col shrink-0 gap-1 p-2 overflow-y-auto border-r"
          style={{ width: 140, borderColor: 'rgba(255,255,255,0.08)', background: '#0c0c14' }}
        >
          <p className="text-xs font-bold tracking-widest px-1 mb-1" style={{ color: '#475569' }}>GENRE</p>
          {genres.map((genre) => (
            <motion.button
              key={genre} onClick={() => handleGenreSelect(genre)} whileTap={{ scale: 0.97 }}
              className="flex items-center gap-2 px-2 py-1.5 rounded text-left w-full text-xs font-medium transition-all"
              style={{
                background: selectedGenre === genre ? `${GENRE_COLORS[genre]}22` : 'transparent',
                border: `1px solid ${selectedGenre === genre ? GENRE_COLORS[genre] + '66' : 'transparent'}`,
                color: selectedGenre === genre ? GENRE_COLORS[genre] : '#64748b',
              }}
            >
              <span>{GENRE_ICONS[genre]}</span>
              <span className="capitalize">{genre}</span>
            </motion.button>
          ))}
        </div>

        {/* Main content */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <div
            className="px-4 py-2 shrink-0 text-xs border-b"
            style={{ borderColor: 'rgba(255,255,255,0.06)', color: '#64748b' }}
          >
            <span style={{ color }}>{GENRE_ICONS[selectedGenre]} {selectedGenre.toUpperCase()} — </span>
            {getGenreDescription(selectedGenre)}
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 px-3 pt-2 pb-0 shrink-0 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            {(['patterns', 'project'] as const).map((tab) => (
              <button
                key={tab} onClick={() => setActiveTab(tab)}
                className="px-3 py-1 text-xs rounded-t font-medium capitalize"
                style={{
                  background: activeTab === tab ? 'rgba(124,58,237,0.2)' : 'transparent',
                  color: activeTab === tab ? '#a78bfa' : '#475569',
                  borderBottom: activeTab === tab ? '2px solid #7c3aed' : '2px solid transparent',
                }}
              >
                {tab === 'patterns' ? 'Track Patterns' : 'Full Project'}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
            {activeTab === 'patterns' && (
              <>
                <div className="flex items-center gap-2">
                  <motion.button
                    onClick={generateAllPatterns} disabled={generating} whileTap={{ scale: 0.97 }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold"
                    style={{ background: `${color}22`, border: `1px solid ${color}66`, color, opacity: generating ? 0.6 : 1 }}
                  >
                    <Wand2 size={12} className={generating ? 'animate-spin' : ''} />
                    {generating ? 'Generating…' : 'Generate All Patterns'}
                  </motion.button>
                  <motion.button
                    onClick={generateProject} disabled={generating} whileTap={{ scale: 0.97 }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold ml-auto"
                    style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.5)', color: '#a78bfa', opacity: generating ? 0.6 : 1 }}
                  >
                    <Zap size={12} />
                    Full Project
                  </motion.button>
                </div>

                <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                  {TRACK_TYPES.map(({ type }) => {
                    const pattern = patterns.get(type);
                    return (
                      <AnimatePresence key={type} mode="wait">
                        {pattern ? (
                          <motion.div
                            key={`${type}-${seeds.get(type)}`}
                            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                          >
                            <PatternCard trackType={type} pattern={pattern}
                              onRegenerate={() => generateSinglePattern(type)}
                              onPreview={() => previewPattern(type)}
                            />
                          </motion.div>
                        ) : (
                          <motion.button
                            key={`empty-${type}`}
                            onClick={() => generateSinglePattern(type)}
                            whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                            className="rounded-lg p-3 flex items-center justify-center gap-2 text-xs"
                            style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)', color: '#475569', minHeight: 80 }}
                          >
                            <Wand2 size={12} />
                            Generate {TRACK_TYPES.find((t) => t.type === type)?.label}
                          </motion.button>
                        )}
                      </AnimatePresence>
                    );
                  })}
                </div>
              </>
            )}

            {activeTab === 'project' && (
              <>
                <div className="flex items-center gap-2">
                  <motion.button
                    onClick={generateProject} disabled={generating} whileTap={{ scale: 0.97 }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold"
                    style={{ background: `${color}22`, border: `1px solid ${color}66`, color, opacity: generating ? 0.6 : 1 }}
                  >
                    <Zap size={12} className={generating ? 'animate-spin' : ''} />
                    {generating ? 'Generating Project…' : 'Generate Full Project'}
                  </motion.button>
                </div>

                {generatedProject ? (
                  <div className="flex flex-col gap-3">
                    <div className="rounded-lg p-3" style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)' }}>
                      <div className="flex items-center gap-2 mb-2">
                        <Layers size={14} style={{ color: '#a78bfa' }} />
                        <span className="text-sm font-bold" style={{ color: '#e2e8f0' }}>{generatedProject.name}</span>
                        <span className="px-1.5 py-0.5 rounded text-xs font-bold ml-auto" style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}>
                          {generatedProject.bpm} BPM
                        </span>
                      </div>
                      <p className="text-xs" style={{ color: '#64748b' }}>
                        {generatedProject.arrangement.reduce(
                          (acc, t) => acc + t.clips.reduce((s, c) => Math.max(s, c.startBar + c.durationBars), 0), 0,
                        )} bars total · {generatedProject.patterns.length} tracks
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-bold mb-2" style={{ color: '#64748b' }}>ARRANGEMENT</p>
                      <div className="flex flex-col gap-1">
                        {generatedProject.arrangement.map(({ trackType, clips }) => {
                          if (!clips.length) return null;
                          const totalBars = clips.reduce((m, c) => Math.max(m, c.startBar + c.durationBars), 0);
                          const trackInfo = TRACK_TYPES.find((t) => t.type === trackType);
                          return (
                            <div key={trackType} className="flex items-center gap-2">
                              <span className="text-xs w-16 shrink-0" style={{ color: '#475569' }}>{trackInfo?.icon} {trackInfo?.label}</span>
                              <div className="flex-1 relative rounded overflow-hidden" style={{ height: 12, background: 'rgba(255,255,255,0.04)' }}>
                                {clips.map((clip, i) => (
                                  <div key={i} className="absolute top-0 h-full rounded-sm"
                                    style={{ left: `${(clip.startBar / totalBars) * 100}%`, width: `${(clip.durationBars / totalBars) * 100}%`, background: color, opacity: 0.7 }}
                                  />
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-bold mb-2" style={{ color: '#64748b' }}>PATTERNS</p>
                      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                        {generatedProject.patterns.map(({ trackType, pattern }) => (
                          <PatternCard key={trackType} trackType={trackType} pattern={pattern}
                            onRegenerate={() => generateSinglePattern(trackType)}
                            onPreview={() => previewPattern(trackType)}
                          />
                        ))}
                      </div>
                    </div>

                    <div
                      className="flex items-center gap-2 px-3 py-2 rounded text-xs"
                      style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)', color: '#06b6d4' }}
                    >
                      <Download size={12} />
                      Load into Arrangement to start editing — drag clips, edit piano roll, add FX
                    </div>
                  </div>
                ) : (
                  <div
                    className="flex flex-col items-center justify-center gap-3 rounded-lg"
                    style={{ minHeight: 200, border: '1px dashed rgba(255,255,255,0.1)', color: '#475569' }}
                  >
                    <Wand2 size={28} style={{ opacity: 0.3 }} />
                    <p className="text-sm">Click "Generate Full Project" to create a complete arrangement</p>
                    <p className="text-xs" style={{ color: '#334155' }}>
                      Generates kick, bass, melody, percussion, pad, and acid patterns<br />
                      with a full intro → build → drop → break → drop → outro arrangement
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
