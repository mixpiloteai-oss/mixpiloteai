// ============================================================
// NEUROTEK AI — Spectral Analyzer (Priority #7)
// Real-time FFT waterfall + bar display + peak hold
// ============================================================
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { audioEngine } from '../services/realAudioEngine';

type DisplayMode = 'bars' | 'line' | 'waterfall';

const FFT_BINS = 512;
const WATERFALL_ROWS = 120;
const BAR_COUNT = 64;

const GRADIENT_COLORS = [
  { stop: 0.0, color: [124, 58, 237] },   // purple  (low)
  { stop: 0.4, color: [6, 182, 212] },    // cyan
  { stop: 0.7, color: [16, 185, 129] },   // emerald
  { stop: 0.85, color: [245, 158, 11] },  // amber
  { stop: 1.0, color: [239, 68, 68] },    // red     (high)
];

function lerpColor(t: number): [number, number, number] {
  let lo = GRADIENT_COLORS[0], hi = GRADIENT_COLORS[GRADIENT_COLORS.length - 1];
  for (let i = 0; i < GRADIENT_COLORS.length - 1; i++) {
    if (t >= GRADIENT_COLORS[i].stop && t <= GRADIENT_COLORS[i + 1].stop) {
      lo = GRADIENT_COLORS[i]; hi = GRADIENT_COLORS[i + 1]; break;
    }
  }
  const s = (t - lo.stop) / (hi.stop - lo.stop + 1e-10);
  return [
    Math.round(lo.color[0] + s * (hi.color[0] - lo.color[0])),
    Math.round(lo.color[1] + s * (hi.color[1] - lo.color[1])),
    Math.round(lo.color[2] + s * (hi.color[2] - lo.color[2])),
  ];
}

// Frequency bands for bar display (log-spaced 20Hz–20kHz)
function freqBands(count: number, sampleRate: number): number[] {
  return Array.from({ length: count }, (_, i) =>
    Math.round(20 * Math.pow(20000 / 20, i / (count - 1)))
  );
}

interface Props {
  width?: number;
  height?: number;
  standalone?: boolean;
}

export default function SpectrumAnalyzer({ width, height, standalone = true }: Props) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const waterfallRef = useRef<ImageData | null>(null);
  const peakRef      = useRef<Float32Array>(new Float32Array(BAR_COUNT));
  const peakDecayRef = useRef<Float32Array>(new Float32Array(BAR_COUNT));
  const rafRef       = useRef<number>(0);

  const [mode, setMode]       = useState<DisplayMode>('bars');
  const [freeze, setFreeze]   = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [gain, setGain]       = useState(1.5);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;

    const rawSpectrum = audioEngine.getMasterSpectrum();

    // ─── Compute bar values from FFT bins ──────────────────────
    const bars = new Float32Array(BAR_COUNT);
    if (rawSpectrum && rawSpectrum.length > 0) {
      const len = rawSpectrum.length;
      for (let b = 0; b < BAR_COUNT; b++) {
        const lo = Math.floor((b / BAR_COUNT) * len);
        const hi = Math.floor(((b + 1) / BAR_COUNT) * len);
        let max = -200;
        for (let i = lo; i < Math.min(hi + 1, len); i++) {
          if (rawSpectrum[i] > max) max = rawSpectrum[i];
        }
        // Normalise: analyser typically returns -200..0 dBFS
        bars[b] = Math.min(1, Math.max(0, (max + 100) / 100 * gain));
      }
    }

    // ─── Peak hold decay ────────────────────────────────────
    for (let b = 0; b < BAR_COUNT; b++) {
      if (bars[b] >= peakRef.current[b]) {
        peakRef.current[b] = bars[b];
        peakDecayRef.current[b] = 0;
      } else {
        peakDecayRef.current[b] += 0.005;
        peakRef.current[b] = Math.max(0, peakRef.current[b] - peakDecayRef.current[b]);
      }
    }

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, W, H);

    if (mode === 'bars') drawBars(ctx, W, H, bars);
    else if (mode === 'line') drawLine(ctx, W, H, bars);
    else drawWaterfall(ctx, W, H, bars);

    if (showGrid) drawGrid(ctx, W, H);

    rafRef.current = requestAnimationFrame(draw);
  }, [mode, gain, showGrid, freeze]);

  // ─── Draw modes ────────────────────────────────────────────
  function drawBars(ctx: CanvasRenderingContext2D, W: number, H: number, bars: Float32Array) {
    const bw = W / BAR_COUNT;
    for (let b = 0; b < BAR_COUNT; b++) {
      const v = bars[b];
      const bh = v * H;
      const x = b * bw;
      const [r, g, bl] = lerpColor(v);

      const grad = ctx.createLinearGradient(0, H, 0, H - bh);
      grad.addColorStop(0, `rgba(${r},${g},${bl},0.9)`);
      grad.addColorStop(1, `rgba(${r},${g},${bl},0.3)`);
      ctx.fillStyle = grad;
      ctx.fillRect(x + 1, H - bh, bw - 2, bh);

      // Peak hold
      const ph = peakRef.current[b];
      if (ph > 0.02) {
        const [pr, pg, pb] = lerpColor(ph);
        ctx.fillStyle = `rgb(${pr},${pg},${pb})`;
        ctx.fillRect(x + 1, H - ph * H - 2, bw - 2, 2);
      }
    }
  }

  function drawLine(ctx: CanvasRenderingContext2D, W: number, H: number, bars: Float32Array) {
    ctx.beginPath();
    ctx.strokeStyle = '#7c3aed';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#7c3aed';
    ctx.shadowBlur = 8;
    for (let b = 0; b < BAR_COUNT; b++) {
      const x = (b / (BAR_COUNT - 1)) * W;
      const y = H - bars[b] * H;
      b === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Fill below line
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(124,58,237,0.3)');
    grad.addColorStop(1, 'rgba(124,58,237,0)');
    ctx.fillStyle = grad;
    ctx.fill();
  }

  function drawWaterfall(ctx: CanvasRenderingContext2D, W: number, H: number, bars: Float32Array) {
    // Shift existing waterfall down
    if (!waterfallRef.current || waterfallRef.current.width !== W || waterfallRef.current.height !== H) {
      waterfallRef.current = ctx.createImageData(W, H);
    }
    const data = waterfallRef.current.data;
    const rowBytes = W * 4;
    // Shift rows down by 1
    data.copyWithin(rowBytes, 0, data.length - rowBytes);

    // Write new top row
    for (let b = 0; b < BAR_COUNT; b++) {
      const v = bars[b];
      const [r, g, bl] = lerpColor(v);
      const bw = W / BAR_COUNT;
      const xStart = Math.floor(b * bw);
      const xEnd   = Math.floor((b + 1) * bw);
      for (let x = xStart; x < xEnd; x++) {
        const idx = x * 4;
        data[idx]     = r;
        data[idx + 1] = g;
        data[idx + 2] = bl;
        data[idx + 3] = Math.round(v * 255);
      }
    }
    ctx.putImageData(waterfallRef.current, 0, 0);
  }

  function drawGrid(ctx: CanvasRenderingContext2D, W: number, H: number) {
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 0.5;
    // Horizontal lines at -6dB intervals
    for (let db = -6; db >= -60; db -= 6) {
      const y = H - ((db + 100) / 100) * gain * H;
      if (y < 0 || y > H) continue;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      if (mode !== 'waterfall') {
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.font = '9px monospace';
        ctx.fillText(`${db}`, 2, y - 2);
      }
    }
    // Frequency labels
    const freqs = [100, 500, 1000, 5000, 10000, 20000];
    freqs.forEach(f => {
      const logPos = Math.log(f / 20) / Math.log(20000 / 20);
      const x = logPos * W;
      if (x < 0 || x > W) return;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.font = '9px monospace';
      const label = f >= 1000 ? `${f / 1000}k` : `${f}`;
      ctx.fillText(label, x + 2, H - 4);
    });
  }

  // ─── Animation loop ───────────────────────────────────────────
  useEffect(() => {
    if (!freeze) {
      rafRef.current = requestAnimationFrame(draw);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw, freeze]);

  // ─── Canvas sizing ───────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const ro = new ResizeObserver(() => {
      canvas.width  = width  ?? parent.clientWidth;
      canvas.height = height ?? parent.clientHeight;
      waterfallRef.current = null; // reset waterfall on resize
    });
    ro.observe(parent);
    return () => ro.disconnect();
  }, [width, height]);

  if (!standalone) {
    return <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />;
  }

  return (
    <div className="flex flex-col h-full" style={{ background: '#0a0a0f' }}>
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-white/5 flex-shrink-0">
        <span className="text-xs font-bold text-purple-300 tracking-wider">SPECTRUM ANALYZER</span>
        <div className="w-px h-4 bg-white/10" />
        {(['bars', 'line', 'waterfall'] as DisplayMode[]).map(m => (
          <button key={m} onClick={() => setMode(m)}
            className="px-2 py-1 rounded text-[10px] uppercase font-bold transition-colors"
            style={{ background: mode === m ? '#7c3aed25' : 'transparent', color: mode === m ? '#a78bfa' : '#6b7280', border: `1px solid ${mode === m ? '#7c3aed40' : 'transparent'}` }}
          >{m}</button>
        ))}
        <div className="w-px h-4 bg-white/10" />
        <button onClick={() => setShowGrid(g => !g)}
          className="px-2 py-1 rounded text-[10px] uppercase font-bold transition-colors"
          style={{ background: showGrid ? '#06b6d420' : 'transparent', color: showGrid ? '#67e8f9' : '#6b7280', border: `1px solid ${showGrid ? '#06b6d440' : 'transparent'}` }}
        >Grid</button>
        <button onClick={() => setFreeze(f => !f)}
          className="px-2 py-1 rounded text-[10px] uppercase font-bold transition-colors"
          style={{ background: freeze ? '#ef444420' : 'transparent', color: freeze ? '#f87171' : '#6b7280', border: `1px solid ${freeze ? '#ef444440' : 'transparent'}` }}
        >{freeze ? 'Frozen' : 'Live'}</button>
        <div className="w-px h-4 bg-white/10" />
        <span className="text-[10px] text-text-muted">Gain</span>
        <input type="range" min="0.5" max="4" step="0.1" value={gain}
          onChange={e => setGain(Number(e.target.value))}
          className="w-20 accent-purple-500 cursor-pointer"
        />
        <span className="text-[10px] font-mono text-purple-300">{gain.toFixed(1)}×</span>
      </div>
      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden">
        <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      </div>
    </div>
  );
}
