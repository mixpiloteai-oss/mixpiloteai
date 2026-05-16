// ============================================================
// NEUROTEK AI — VU Meter Component
// ============================================================
import React, { useMemo } from 'react';
import clsx from 'clsx';
import type { VuMeterState } from '../../types';

interface VuMeterProps {
  state?: VuMeterState;
  height?: number;
  width?: number;
  segments?: number;
  showPeak?: boolean;
  label?: string;
  mono?: boolean;
  className?: string;
}

function segmentColor(index: number, total: number): string {
  const pct = index / total;
  if (pct > 0.9) return '#ef4444';
  if (pct > 0.75) return '#f59e0b';
  return '#10b981';
}

function Channel({ value, segments, showPeak, peak }: {
  value: number;
  segments: number;
  showPeak: boolean;
  peak: number;
}) {
  const activeSegments = Math.round(value * segments);
  const peakSegment = Math.round(peak * segments);

  return (
    <div className="flex flex-col-reverse gap-px" style={{ flex: 1 }}>
      {Array.from({ length: segments }, (_, i) => {
        const isActive = i < activeSegments;
        const isPeak = showPeak && i === peakSegment && i >= activeSegments;
        const color = segmentColor(i, segments);

        return (
          <div
            key={i}
            className="w-full rounded-sm transition-all"
            style={{
              height: `${Math.floor(100 / segments)}%`,
              minHeight: 3,
              background: isActive ? color : isPeak ? color : 'rgba(255,255,255,0.05)',
              opacity: isActive ? 1 : isPeak ? 0.8 : 1,
              boxShadow: isActive && i / segments > 0.75 ? `0 0 4px ${color}80` : 'none',
              transition: 'background 80ms ease-out',
            }}
          />
        );
      })}
    </div>
  );
}

export function VuMeter({
  state,
  height = 80,
  width = 20,
  segments = 20,
  showPeak = true,
  label,
  mono = false,
  className,
}: VuMeterProps) {
  const left = state?.left ?? 0;
  const right = state?.right ?? 0;
  const peak = state?.peak ?? 0;
  const clipping = state?.clipping ?? false;

  return (
    <div className={clsx('flex flex-col items-center gap-1', className)}>
      <div
        className={clsx('flex gap-1 rounded overflow-hidden', clipping && 'animate-vu-flash')}
        style={{ height, width }}
      >
        <Channel value={left} segments={segments} showPeak={showPeak} peak={peak} />
        {!mono && <Channel value={right} segments={segments} showPeak={showPeak} peak={peak} />}
      </div>
      {label && (
        <span className={clsx('text-[9px] font-mono uppercase tracking-widest', clipping ? 'text-red-400' : 'text-text-muted')}>
          {label}
        </span>
      )}
    </div>
  );
}

interface MultiVuProps {
  tracks: Array<{ id: string; name: string; color: string; vu?: VuMeterState }>;
  height?: number;
  className?: string;
}

export function MultiVuMeter({ tracks, height = 60, className }: MultiVuProps) {
  return (
    <div className={clsx('flex gap-2 items-end', className)}>
      {tracks.map((track) => (
        <div key={track.id} className="flex flex-col items-center gap-1">
          <VuMeter state={track.vu} height={height} width={8} segments={15} showPeak mono={false} />
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: track.color }} />
        </div>
      ))}
    </div>
  );
}
