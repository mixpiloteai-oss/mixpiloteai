// ============================================================
// NEUROTEK AI — Mix Assistant
// ============================================================
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  TrendingUp,
  Volume2,
  Zap,
  CheckCircle2,
  BarChart2,
  Activity,
} from 'lucide-react';
import clsx from 'clsx';
import { useAppStore } from '../store/appStore';
import { useAudioEngine } from '../hooks/useAudioEngine';
import { Card, CardHeader } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { VuMeter } from './ui/VuMeter';

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.07 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

const severityColor: Record<string, string> = { low: '#10b981', medium: '#f59e0b', high: '#ef4444' };
const priorityColor: Record<string, string> = { low: '#10b981', medium: '#f59e0b', high: '#ef4444' };
const suggestionTypeColor: Record<string, string> = {
  eq: '#06b6d4',
  compression: '#7c3aed',
  sidechain: '#f59e0b',
  volume: '#10b981',
  panning: '#ec4899',
  fx: '#a78bfa',
};

function SpectrumBar({ freq, gain, color = '#7c3aed' }: { freq: number; gain: number; color?: string }) {
  return (
    <div className="flex flex-col items-center justify-end gap-0.5" style={{ flex: 1 }}>
      <motion.div
        animate={{ height: `${gain * 100}%` }}
        transition={{ duration: 0.12, ease: 'easeOut' }}
        className="w-full rounded-t-sm"
        style={{ background: gain > 0.8 ? '#ef4444' : gain > 0.65 ? '#f59e0b' : color, minHeight: 2 }}
      />
    </div>
  );
}

export function MixAssistant() {
  const { mixAnalysis, activeProject, audioEngine } = useAppStore();
  const { masterVu, spectrum, playbackState } = useAudioEngine();

  const score = mixAnalysis?.score ?? 0;
  const scoreColor = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';

  const loudness = mixAnalysis?.loudness;

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="h-full overflow-y-auto scroll-area p-6 space-y-5"
    >
      <motion.div variants={item} className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Mix Assistant</h1>
          <p className="text-text-muted text-sm mt-1">
            {activeProject ? `Analysing: ${activeProject.name}` : 'No project loaded'}
          </p>
        </div>
        <Button variant="primary" icon={<Activity size={15} />} size="sm">Re-analyse</Button>
      </motion.div>

      <motion.div variants={item} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card padding="md" className="text-center">
          <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">Mix Score</p>
          <div className="relative w-16 h-16 mx-auto">
            <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
              <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
              <circle
                cx="32" cy="32" r="26" fill="none"
                stroke={scoreColor} strokeWidth="6"
                strokeDasharray={`${2 * Math.PI * 26}`}
                strokeDashoffset={`${2 * Math.PI * 26 * (1 - score / 100)}`}
                strokeLinecap="round"
                style={{ filter: `drop-shadow(0 0 4px ${scoreColor})` }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-bold" style={{ color: scoreColor }}>{score}</span>
            </div>
          </div>
        </Card>

        <Card padding="md">
          <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">Loudness</p>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-text-muted">Integrated</span>
              <span className="font-mono text-text-accent">{loudness?.integrated.toFixed(1)} LUFS</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-text-muted">True Peak</span>
              <span className={clsx('font-mono', (loudness?.truePeak ?? 0) > -1 ? 'text-amber-400' : 'text-emerald-400')}>
                {loudness?.truePeak.toFixed(1)} dBTP
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-text-muted">LRA</span>
              <span className="font-mono text-text-accent">{loudness?.lra.toFixed(1)} LU</span>
            </div>
          </div>
        </Card>

        <Card padding="md" className="flex flex-col items-center gap-2">
          <p className="text-[10px] text-text-muted uppercase tracking-wider">Master VU</p>
          <div className="flex gap-3 items-end">
            <VuMeter state={masterVu} height={60} width={20} segments={16} showPeak label="L" />
            <VuMeter
              state={{ ...masterVu, left: masterVu.right, right: masterVu.left }}
              height={60} width={20} segments={16} showPeak label="R"
            />
          </div>
          <span className={clsx('text-[10px] font-mono', masterVu.clipping ? 'text-red-400 animate-pulse' : 'text-text-muted')}>
            {masterVu.clipping ? 'CLIP!' : 'OK'}
          </span>
        </Card>

        <Card padding="md" className="flex flex-col justify-between">
          <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">Issues</p>
          <div className="space-y-2">
            {['high', 'medium', 'low'].map((sev) => {
              const count = mixAnalysis?.conflicts.filter((c) => c.severity === sev).length ?? 0;
              return (
                <div key={sev} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: severityColor[sev as keyof typeof severityColor] }} />
                    <span className="text-text-muted capitalize">{sev}</span>
                  </div>
                  <span className="font-mono font-bold" style={{ color: severityColor[sev as keyof typeof severityColor] }}>{count}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </motion.div>

      <motion.div variants={item}>
        <Card padding="md">
          <CardHeader
            title="Frequency Spectrum"
            subtitle={`${playbackState === 'playing' ? 'Live analysis' : 'Static view'}`}
            icon={<BarChart2 size={15} />}
            accent="#06b6d4"
          />
          <div className="flex items-end gap-px" style={{ height: 80, width: '100%' }}>
            {spectrum.map((band, i) => (
              <SpectrumBar
                key={i}
                freq={band.frequency}
                gain={band.gain}
                color={i < 6 ? '#7c3aed' : i < 12 ? '#06b6d4' : i < 22 ? '#10b981' : '#f59e0b'}
              />
            ))}
          </div>
          <div className="flex justify-between text-[9px] text-text-muted mt-2 font-mono">
            <span>20 Hz</span><span>100 Hz</span><span>500 Hz</span><span>2 kHz</span><span>8 kHz</span><span>20 kHz</span>
          </div>
        </Card>
      </motion.div>

      <motion.div variants={item} className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={15} className="text-amber-400" />
            <h2 className="text-sm font-semibold text-text-primary">Frequency Conflicts</h2>
            <Badge color="#ef4444" size="xs">{mixAnalysis?.conflicts.length ?? 0}</Badge>
          </div>
          <div className="space-y-3">
            {mixAnalysis?.conflicts.map((conflict, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                className="p-3 rounded-xl"
                style={{ background: 'rgba(20,20,32,0.8)', border: `1px solid ${severityColor[conflict.severity ?? 'low']}25` }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-text-primary">{conflict.trackA}</span>
                    <span className="text-text-muted text-xs">↔</span>
                    <span className="text-xs font-medium text-text-primary">{conflict.trackB}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-[10px] font-mono text-text-muted">{conflict.frequency} Hz</span>
                    <Badge color={severityColor[conflict.severity ?? 'low']} size="xs">{(conflict.severity ?? 'low').toUpperCase()}</Badge>
                  </div>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">{conflict.suggestion}</p>
              </motion.div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={15} className="text-emerald-400" />
            <h2 className="text-sm font-semibold text-text-primary">AI Suggestions</h2>
          </div>
          <div className="space-y-3">
            {mixAnalysis?.suggestions.map((sug, i) => (
              <motion.div
                key={sug.id}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                className="p-3 rounded-xl"
                style={{ background: 'rgba(20,20,32,0.8)', border: '1px solid rgba(255,255,255,0.04)' }}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge color={suggestionTypeColor[sug.type]} size="xs">{sug.type.toUpperCase()}</Badge>
                    <Badge color={priorityColor[sug.priority]} size="xs">{sug.priority}</Badge>
                  </div>
                  {sug.autoApplyable && (
                    <Button variant="success" size="xs" icon={<Zap size={10} />}>Apply</Button>
                  )}
                </div>
                <p className="text-xs font-medium text-text-primary mb-1">{sug.title}</p>
                <p className="text-xs text-text-secondary leading-relaxed">{sug.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
