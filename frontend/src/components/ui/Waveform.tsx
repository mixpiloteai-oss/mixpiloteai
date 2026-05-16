// ============================================================
// NEUROTEK AI — Waveform Component
// ============================================================
import React, { useRef, useEffect, useCallback } from 'react';
import clsx from 'clsx';

interface WaveformProps {
  data?: number[];
  color?: string;
  backgroundColor?: string;
  height?: number;
  animated?: boolean;
  className?: string;
  playhead?: number;
}

function generateFakeData(length = 128): number[] {
  const data: number[] = [];
  let prev = 0.5;
  for (let i = 0; i < length; i++) {
    const drift = (Math.random() - 0.5) * 0.3;
    prev = Math.max(0.05, Math.min(0.95, prev + drift));
    data.push(prev);
  }
  return data;
}

export function Waveform({
  data,
  color = '#7c3aed',
  backgroundColor = 'transparent',
  height = 40,
  animated = false,
  className,
  playhead,
}: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const phaseRef = useRef(0);

  const waveData = data ?? generateFakeData(128);

  const draw = useCallback(
    (phase: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const W = canvas.width;
      const H = canvas.height;

      ctx.clearRect(0, 0, W, H);

      if (backgroundColor !== 'transparent') {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, W, H);
      }

      const barW = W / waveData.length;
      const gradient = ctx.createLinearGradient(0, 0, 0, H);
      gradient.addColorStop(0, `${color}cc`);
      gradient.addColorStop(1, `${color}22`);
      ctx.fillStyle = gradient;

      waveData.forEach((val, i) => {
        const animated_val = animated
          ? val * (0.7 + 0.3 * Math.abs(Math.sin(phase + i * 0.15)))
          : val;
        const barH = animated_val * H;
        const x = i * barW;
        const y = (H - barH) / 2;

        ctx.beginPath();
        ctx.roundRect(x + 0.5, y, Math.max(1, barW - 1), barH, 1);
        ctx.fill();
      });

      if (playhead !== undefined && playhead >= 0 && playhead <= 1) {
        const px = playhead * W;
        ctx.strokeStyle = '#ffffff80';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, H);
        ctx.stroke();

        ctx.fillStyle = `${color}15`;
        ctx.fillRect(0, 0, px, H);
      }
    },
    [waveData, color, backgroundColor, animated, playhead]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);
  }, []);

  useEffect(() => {
    if (!animated) {
      draw(0);
      return;
    }

    const animate = () => {
      phaseRef.current += 0.04;
      draw(phaseRef.current);
      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [animated, draw]);

  return (
    <canvas ref={canvasRef} className={clsx('waveform', className)} style={{ height, width: '100%' }} />
  );
}

interface MiniWaveformProps {
  data?: number[];
  color?: string;
  height?: number;
  className?: string;
}

export function MiniWaveform({ data, color = '#7c3aed', height = 24, className }: MiniWaveformProps) {
  const d = data ?? generateFakeData(32);
  const max = Math.max(...d, 0.01);
  const bars = d.map((v) => v / max);

  return (
    <div className={clsx('flex items-center gap-px', className)} style={{ height }}>
      {bars.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm"
          style={{ height: `${v * 100}%`, background: color, opacity: 0.7 + v * 0.3, minWidth: 1 }}
        />
      ))}
    </div>
  );
}
