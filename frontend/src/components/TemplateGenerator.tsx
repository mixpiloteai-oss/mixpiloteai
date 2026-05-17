// ============================================================
// NEUROTEK AI — Template Generator
// ============================================================
import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, ChevronRight, CheckCircle2, Music2, GitBranch, Layers } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { mockTemplates, genreInfo, moodColors } from '../data/mockData';
import { Button } from './ui/Button';
import { Badge, TrackTypeBadge } from './ui/Badge';
import { Card } from './ui/Card';
import { Slider } from './ui/Slider';
import type { Genre, Mood, Template } from '../types';

const genres: Genre[] = ['mentalcore', 'tribe', 'hardtek', 'acidcore', 'hard-techno', 'tekno'];
const moods: Mood[] = ['aggressive', 'dark', 'hypnotic', 'psychedelic', 'tribal', 'euphoric', 'industrial', 'minimal'];

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

function RoutingDiagram({ template }: { template: Template }) {
  const routing = template.routing ?? [];
  const masters = routing.filter((n) => n.type === 'master');
  const buses = routing.filter((n) => n.type === 'bus');
  const tracks = routing.filter((n) => n.type === 'track');

  return (
    <div className="flex flex-col items-center gap-3 p-4">
      {masters.map((m) => (
        <div key={m.id} className="flex flex-col items-center gap-1">
          <div
            className="px-4 py-1.5 rounded-lg text-xs font-bold"
            style={{ background: `${m.color}20`, border: `1px solid ${m.color}50`, color: m.color }}
          >
            {m.label}
          </div>
          <div className="w-px h-3" style={{ background: 'rgba(255,255,255,0.15)' }} />
        </div>
      ))}
      <div className="flex gap-6">
        {buses.map((bus) => (
          <div key={bus.id} className="flex flex-col items-center gap-1">
            <div
              className="px-3 py-1 rounded text-xs font-semibold"
              style={{ background: `${bus.color}15`, border: `1px solid ${bus.color}40`, color: bus.color }}
            >
              {bus.label}
            </div>
            <div className="w-px h-3" style={{ background: 'rgba(255,255,255,0.1)' }} />
            <div className="flex gap-3">
              {tracks.filter((t) => bus.children.includes(t.id)).map((track) => (
                <div
                  key={track.id}
                  className="px-2 py-0.5 rounded text-[10px]"
                  style={{ background: `${track.color}10`, border: `1px solid ${track.color}30`, color: track.color }}
                >
                  {track.label}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TemplateGenerator() {
  const { setActiveTemplate, setLoading, addNotification, setView } = useAppStore();

  const [selectedGenre, setSelectedGenre] = useState<Genre>('mentalcore');
  const [selectedMood, setSelectedMood] = useState<Mood>('aggressive');
  const [bpm, setBpm] = useState(200);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedTemplate, setGeneratedTemplate] = useState<Template | null>(null);
  const [step, setStep] = useState<'config' | 'result'>('config');

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setLoading(true, 'AI is generating your template...');

    await new Promise((r) => setTimeout(r, 2200));

    const template = mockTemplates.find((t) => t.genre === selectedGenre) ?? mockTemplates[0];
    const result: Template = {
      ...template,
      bpm,
      mood: selectedMood,
      generatedAt: new Date().toISOString(),
      aiConfidence: 0.88 + Math.random() * 0.1,
    };

    setGeneratedTemplate(result);
    setActiveTemplate(result);
    setIsGenerating(false);
    setLoading(false);
    setStep('result');
    addNotification({ type: 'success', message: `Template "${result.name}" generated successfully` });
  }, [selectedGenre, selectedMood, bpm, setActiveTemplate, setLoading, addNotification]);

  const info = genreInfo[selectedGenre];

  return (
    <div className="h-full overflow-y-auto scroll-area p-6">
      <motion.div variants={container} initial="hidden" animate="show" className="max-w-4xl mx-auto space-y-6">
        <motion.div variants={item} className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Template Generator</h1>
            <p className="text-text-muted text-sm mt-1">
              AI-powered production templates tailored to your genre and style
            </p>
          </div>
          {step === 'result' && (
            <Button variant="ghost" size="sm" onClick={() => setStep('config')}>
              ← New Template
            </Button>
          )}
        </motion.div>

        <AnimatePresence mode="wait">
          {step === 'config' ? (
            <motion.div
              key="config"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <motion.div variants={item}>
                <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
                  01 — Select Genre
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {genres.map((genre) => {
                    const g = genreInfo[genre];
                    const isSelected = selectedGenre === genre;
                    return (
                      <motion.button
                        key={genre}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          setSelectedGenre(genre);
                          setBpm(Math.round((g.bpmRange[0] + g.bpmRange[1]) / 2));
                        }}
                        className="p-4 rounded-xl text-left transition-all duration-150 relative overflow-hidden"
                        style={{
                          background: isSelected ? `${g.color}18` : 'rgba(26,26,46,0.7)',
                          border: `1px solid ${isSelected ? g.color + '60' : 'rgba(255,255,255,0.05)'}`,
                          boxShadow: isSelected ? `0 0 20px ${g.color}20` : 'none',
                        }}
                      >
                        {isSelected && (
                          <motion.div layoutId="genreIndicator" className="absolute top-2 right-2">
                            <CheckCircle2 size={14} style={{ color: g.color }} />
                          </motion.div>
                        )}
                        <div
                          className="w-3 h-3 rounded-full mb-2"
                          style={{ background: g.color, boxShadow: `0 0 8px ${g.color}80` }}
                        />
                        <p className="text-sm font-bold text-text-primary">{g.label}</p>
                        <p className="text-[10px] text-text-muted mt-1">{g.bpmRange[0]}–{g.bpmRange[1]} BPM</p>
                        <p className="text-[10px] text-text-muted mt-1 leading-relaxed line-clamp-2">{g.description}</p>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>

              <motion.div variants={item}>
                <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
                  02 — Set BPM
                </h2>
                <Card padding="md">
                  <div className="flex items-center gap-6">
                    <div className="flex-1">
                      <Slider
                        value={bpm}
                        min={info?.bpmRange[0] ?? 120}
                        max={info?.bpmRange[1] ?? 220}
                        step={1}
                        onChange={setBpm}
                        color={info?.color ?? '#7c3aed'}
                        label="Tempo"
                        showValue
                        formatValue={(v) => `${v} BPM`}
                      />
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div
                        className="text-3xl font-bold font-mono"
                        style={{
                          background: `linear-gradient(135deg, ${info?.color ?? '#7c3aed'}, #06b6d4)`,
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                        }}
                      >
                        {bpm}
                      </div>
                      <div className="text-xs text-text-muted">BPM</div>
                    </div>
                  </div>
                </Card>
              </motion.div>

              <motion.div variants={item}>
                <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
                  03 — Choose Mood
                </h2>
                <div className="flex flex-wrap gap-2">
                  {moods.map((mood) => {
                    const color = moodColors[mood];
                    const isSelected = selectedMood === mood;
                    return (
                      <motion.button
                        key={mood}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setSelectedMood(mood)}
                        className="px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-150 capitalize"
                        style={{
                          background: isSelected ? `${color}25` : 'rgba(26,26,46,0.8)',
                          border: `1px solid ${isSelected ? color + '60' : 'rgba(255,255,255,0.07)'}`,
                          color: isSelected ? color : '#94a3b8',
                          boxShadow: isSelected ? `0 0 12px ${color}25` : 'none',
                        }}
                      >
                        {mood}
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>

              <motion.div variants={item} className="pt-2">
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  loading={isGenerating}
                  icon={<Zap size={18} />}
                  onClick={handleGenerate}
                  glow
                >
                  {isGenerating ? 'Generating Template...' : 'Generate AI Template'}
                </Button>
                <p className="text-xs text-text-muted text-center mt-2">
                  AI will generate a complete project structure with tracks, FX chains, and routing
                </p>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-5"
            >
              {generatedTemplate && (
                <>
                  <Card padding="md">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 size={16} className="text-emerald-400" />
                          <span className="text-xs font-mono text-emerald-400 uppercase">Template Generated</span>
                        </div>
                        <h2 className="text-xl font-bold text-text-primary">{generatedTemplate.name}</h2>
                        <p className="text-sm text-text-secondary mt-1 leading-relaxed">{generatedTemplate.description}</p>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <Badge color="#7c3aed">{generatedTemplate.genre}</Badge>
                          <Badge color="#06b6d4">{generatedTemplate.bpm} BPM</Badge>
                          <Badge color={moodColors[generatedTemplate.mood]}>{generatedTemplate.mood}</Badge>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-xs text-text-muted mb-1">AI Confidence</div>
                        <div className="text-2xl font-bold text-emerald-400">
                          {Math.round((generatedTemplate.aiConfidence ?? 0) * 100)}%
                        </div>
                        <div className="w-20 h-1.5 rounded-full mt-1 ml-auto" style={{ background: 'rgba(255,255,255,0.07)' }}>
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${(generatedTemplate.aiConfidence ?? 0) * 100}%`, background: 'linear-gradient(90deg, #10b981, #06b6d4)' }}
                          />
                        </div>
                      </div>
                    </div>
                  </Card>

                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Layers size={15} className="text-text-muted" />
                      <h3 className="text-sm font-semibold text-text-primary">Track Structure</h3>
                      <span className="text-xs text-text-muted">({generatedTemplate.tracks.length} tracks)</span>
                    </div>
                    <div className="space-y-2">
                      {generatedTemplate.tracks.map((track, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.06 }}
                          className="flex items-center gap-3 p-3 rounded-xl"
                          style={{ background: 'rgba(26,26,46,0.7)', border: '1px solid rgba(255,255,255,0.04)' }}
                        >
                          <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ background: track.color }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-text-primary">{track.name}</span>
                              {track.type && <TrackTypeBadge type={track.type} />}
                            </div>
                            {track.notes && <p className="text-[10px] text-text-muted mt-0.5">{track.notes}</p>}
                          </div>
                          <div className="flex gap-1 flex-wrap justify-end">
                            {(track.suggestedFX ?? []).map((fx) => (
                              <span
                                key={fx.name}
                                className="text-[9px] px-1.5 py-0.5 rounded"
                                style={{ background: 'rgba(124,58,237,0.12)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.2)' }}
                              >
                                {fx.name}
                              </span>
                            ))}
                          </div>
                          <div className="text-xs font-mono text-text-muted flex-shrink-0">{track.volumeDefault}</div>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <GitBranch size={15} className="text-text-muted" />
                      <h3 className="text-sm font-semibold text-text-primary">Signal Routing</h3>
                    </div>
                    <Card padding="none" className="overflow-hidden">
                      <RoutingDiagram template={generatedTemplate} />
                    </Card>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button variant="primary" fullWidth icon={<Music2 size={15} />} onClick={() => setView('tracks')}>
                      Open in Track Organizer
                    </Button>
                    <Button variant="secondary" onClick={() => setStep('config')}>Regenerate</Button>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
