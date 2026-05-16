// ============================================================
// NEUROTEK AI — Badge Component
// ============================================================
import React from 'react';
import clsx from 'clsx';
import type { Genre, TrackType, Mood } from '../../types';

interface BadgeProps {
  children: React.ReactNode;
  color?: string;
  className?: string;
  size?: 'xs' | 'sm' | 'md';
  dot?: boolean;
  pulse?: boolean;
}

export function Badge({ children, color = '#7c3aed', className, size = 'sm', dot = false, pulse = false }: BadgeProps) {
  const sizeClasses = { xs: 'px-1.5 py-0.5 text-[10px]', sm: 'px-2 py-0.5 text-xs', md: 'px-3 py-1 text-sm' };

  return (
    <span
      className={clsx('inline-flex items-center gap-1.5 rounded font-medium', sizeClasses[size], className)}
      style={{ background: `${color}18`, color: color, border: `1px solid ${color}35` }}
    >
      {dot && (
        <span
          className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', pulse && 'animate-pulse')}
          style={{ background: color }}
        />
      )}
      {children}
    </span>
  );
}

const genreColors: Record<Genre, string> = {
  mentalcore: '#7c3aed',
  tribe: '#f59e0b',
  hardtek: '#ef4444',
  acidcore: '#06b6d4',
  'hard-techno': '#ec4899',
  tekno: '#10b981',
  industrial: '#475569',
  neurofunk: '#a78bfa',
};

const genreLabels: Record<Genre, string> = {
  mentalcore: 'MENTALCORE',
  tribe: 'TRIBE',
  hardtek: 'HARDTEK',
  acidcore: 'ACIDCORE',
  'hard-techno': 'HARD TECHNO',
  tekno: 'TEKNO',
  industrial: 'INDUSTRIAL',
  neurofunk: 'NEUROFUNK',
};

export function GenreBadge({ genre, size = 'sm' }: { genre: Genre; size?: 'xs' | 'sm' | 'md' }) {
  return <Badge color={genreColors[genre]} size={size}>{genreLabels[genre]}</Badge>;
}

const trackTypeColors: Record<TrackType, string> = {
  kick: '#ef4444',
  bass: '#f59e0b',
  melody: '#06b6d4',
  fx: '#10b981',
  percussion: '#ec4899',
  master: '#7c3aed',
  vocal: '#a78bfa',
  pad: '#38bdf8',
  arp: '#34d399',
  acid: '#22d3ee',
};

export function TrackTypeBadge({ type, size = 'xs' }: { type: TrackType; size?: 'xs' | 'sm' | 'md' }) {
  return <Badge color={trackTypeColors[type]} size={size}>{type.toUpperCase()}</Badge>;
}

type Status = 'active' | 'idle' | 'error' | 'processing';
const statusColors: Record<Status, string> = {
  active: '#10b981',
  idle: '#475569',
  error: '#ef4444',
  processing: '#f59e0b',
};

export function StatusBadge({ status, label }: { status: Status; label?: string }) {
  return (
    <Badge color={statusColors[status]} dot pulse={status === 'active' || status === 'processing'}>
      {label ?? status.toUpperCase()}
    </Badge>
  );
}

const moodColors: Record<Mood, string> = {
  dark: '#64748b',
  hypnotic: '#7c3aed',
  aggressive: '#ef4444',
  euphoric: '#ec4899',
  industrial: '#475569',
  psychedelic: '#06b6d4',
  tribal: '#f59e0b',
  minimal: '#10b981',
};

export function MoodBadge({ mood }: { mood: Mood }) {
  return <Badge color={moodColors[mood]} size="xs">{mood.toUpperCase()}</Badge>;
}

export function BpmBadge({ bpm }: { bpm: number }) {
  const color = bpm >= 180 ? '#ef4444' : bpm >= 160 ? '#f59e0b' : '#10b981';
  return <Badge color={color} size="xs" className="font-mono">{bpm} BPM</Badge>;
}
