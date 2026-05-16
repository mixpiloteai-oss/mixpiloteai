// ============================================================
// ArrangementPanel — Horizontal timeline arrangement view
// ============================================================
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { motion } from 'framer-motion';
import {
  Play,
  Square,
  Circle,
  ZoomIn,
  ZoomOut,
  Repeat,
  Grid3X3,
  Music,
} from 'lucide-react';
import { audioEngine } from '../services/realAudioEngine';

// ── Local interface definitions ────────────────────────────────────
interface ArrClip {
  id: string;
  trackId: string;
  name: string;
  startBar: number;
  durationBars: number;
  color: string;
}

interface ArrTrack {
  id: string;
  name: string;
  color: string;
  muted: boolean;
  height: number;
}

// ── Constants ────────────────────────────────────────────────
const BASE_BAR_WIDTH = 60;
const TRACK_H = 40;
const HEADER_H = 32;
const TRACK_LIST_W = 180;
const RULER_FONT = '10px monospace';
const BEAT_DIVISIONS = 4;

// ── Helpers ──────────────────────────────────────────────────
function generateId(): string {
  return Math.random().toString(36).slice(2, 9);
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── Default data ─────────────────────────────────────────────
const DEFAULT_TRACKS: ArrTrack[] = [
  { id: 'kick',   name: 'Kick',   color: '#ef4444', muted: false, height: TRACK_H },
  { id: 'bass',   name: 'Bass',   color: '#f59e0b', muted: false, height: TRACK_H },
  { id: 'melody', name: 'Melody', color: '#10b981', muted: false, height: TRACK_H },
  { id: 'perc',   name: 'Perc',   color: '#06b6d4', muted: false, height: TRACK_H },
  { id: 'fx',     name: 'FX',     color: '#8b5cf6', muted: false, height: TRACK_H },
  { id: 'acid',   name: 'Acid',   color: '#ec4899', muted: false, height: TRACK_H },
];

const DEFAULT_CLIPS: ArrClip[] = [
  { id: 'c1', trackId: 'kick',   name: 'Kick Loop',  startBar: 0, durationBars: 4,  color: '#ef4444' },
  { id: 'c2', trackId: 'bass',   name: 'Bass Line',  startBar: 0, durationBars: 8,  color: '#f59e0b' },
  { id: 'c3', trackId: 'melody', name: 'Melody A',   startBar: 4, durationBars: 4,  color: '#10b981' },
  { id: 'c4', trackId: 'acid',   name: 'Acid Riff',  startBar: 8, durationBars: 4,  color: '#ec4899' },
];

// ── Drag state type ─────────────────────────────────────────────
type DragMode = 'move' | 'resize';
interface DragState {
  clipId: string;
  mode: DragMode;
  startX: number;
  origStart: number;
  origDuration: number;
}

// ── Main component ─────────────────────────────────────────────
export default function ArrangementPanel() {
  const [tracks, setTracks] = useState<ArrTrack[]>(DEFAULT_TRACKS);
  const [clips, setClips] = useState<ArrClip[]>(DEFAULT_CLIPS);
  const [zoom, setZoom] = useState(1);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [playhead, setPlayhead] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [totalBars, setTotalBars] = useState<16 | 32 | 64 | 128>(64);
  const [bpm, setBpm] = useState(audioEngine.bpm || 140);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasSizeRef = useRef({ w: 800, h: 400 });
  const dragRef = useRef<DragState | null>(null);
  const scrollRef = useRef(0);
  const zoomRef = useRef(zoom);
  const clipsRef = useRef(clips);
  const tracksRef = useRef(tracks);
  const playheadRef = useRef(playhead);

  // Keep refs in sync
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { clipsRef.current = clips; }, [clips]);
  useEffect(() => { tracksRef.current = tracks; }, [tracks]);
  useEffect(() => { playheadRef.current = playhead; }, [playhead]);

  // ── Audio engine subscriptions ─────────────────────────────────
  useEffect(() => {
    const unsub = audioEngine.onStateChange((s) => {
      setIsPlaying(s.isPlaying);
      setBpm(s.bpm);
      if (!s.isPlaying) setPlayhead(0);
    });
    const unsubBeat = audioEngine.onBeat((beat, bar) => {
      setPlayhead(bar + beat / BEAT_DIVISIONS);
    });
    return () => { unsub(); unsubBeat(); };
  }, []);

  // ── Canvas drawing ───────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { w, h } = canvasSizeRef.current;
    const barW = BASE_BAR_WIDTH * zoomRef.current;
    const sl = scrollRef.current;
    const ph = playheadRef.current;
    const tks = tracksRef.current;
    const cls = clipsRef.current;

    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = '#0d0d14';
    ctx.fillRect(0, 0, w, h);

    const visibleBars = Math.ceil(w / barW) + 2;
    const firstBar = Math.floor(sl / barW);

    // ── Grid lines ───────────────────────────────────────────
    for (let bar = firstBar; bar < firstBar + visibleBars + 1; bar++) {
      const x = bar * barW - sl;
      if (x < 0 || x > w) continue;
      // Bar line
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, HEADER_H);
      ctx.lineTo(x, h);
      ctx.stroke();
      // Beat lines
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 0.5;
      for (let beat = 1; beat < BEAT_DIVISIONS; beat++) {
        const bx = x + (beat / BEAT_DIVISIONS) * barW;
        if (bx < 0 || bx > w) continue;
        ctx.beginPath();
        ctx.moveTo(bx, HEADER_H);
        ctx.lineTo(bx, h);
        ctx.stroke();
      }
    }

    // ── Alternating track rows ───────────────────────────────────
    tks.forEach((track, ti) => {
      const ty = HEADER_H + ti * TRACK_H;
      ctx.fillStyle = ti % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent';
      ctx.fillRect(0, ty, w, TRACK_H);
    });

    // ── Loop overlay ─────────────────────────────────────────
    if (loopEnabled) {
      const loopStart = 0 * barW - sl;
      const loopEnd = 8 * barW - sl;
      ctx.fillStyle = 'rgba(124,58,237,0.12)';
      ctx.fillRect(loopStart, HEADER_H, loopEnd - loopStart, h - HEADER_H);
      ctx.strokeStyle = 'rgba(124,58,237,0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(loopStart, HEADER_H, loopEnd - loopStart, h - HEADER_H);
    }

    // ── Clip blocks ───────────────────────────────────────────
    cls.forEach((clip) => {
      const ti = tks.findIndex((t) => t.id === clip.trackId);
      if (ti < 0) return;
      const cx = clip.startBar * barW - sl;
      const cw = clip.durationBars * barW;
      const cy = HEADER_H + ti * TRACK_H + 2;
      const ch2 = TRACK_H - 4;

      if (cx + cw < 0 || cx > w) return;

      const radius = 4;
      ctx.beginPath();
      ctx.moveTo(cx + radius, cy);
      ctx.lineTo(cx + cw - radius, cy);
      ctx.quadraticCurveTo(cx + cw, cy, cx + cw, cy + radius);
      ctx.lineTo(cx + cw, cy + ch2 - radius);
      ctx.quadraticCurveTo(cx + cw, cy + ch2, cx + cw - radius, cy + ch2);
      ctx.lineTo(cx + radius, cy + ch2);
      ctx.quadraticCurveTo(cx, cy + ch2, cx, cy + ch2 - radius);
      ctx.lineTo(cx, cy + radius);
      ctx.quadraticCurveTo(cx, cy, cx + radius, cy);
      ctx.closePath();

      // Fill with gradient
      const grad = ctx.createLinearGradient(cx, cy, cx, cy + ch2);
      grad.addColorStop(0, hexToRgba(clip.color, 0.9));
      grad.addColorStop(1, hexToRgba(clip.color, 0.6));
      ctx.fillStyle = grad;
      ctx.fill();

      // Border
      ctx.strokeStyle = hexToRgba(clip.color, 1);
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Resize handle (right edge)
      const handleW = 6;
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(cx + cw - handleW, cy + 2, handleW - 1, ch2 - 4);

      // Clip name
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.save();
      ctx.rect(cx + 4, cy, Math.max(0, cw - 10), ch2);
      ctx.clip();
      ctx.fillText(clip.name, cx + 6, cy + ch2 / 2 + 4);
      ctx.restore();
    });

    // ── Ruler ────────────────────────────────────────────────
    ctx.fillStyle = '#111118';
    ctx.fillRect(0, 0, w, HEADER_H);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, HEADER_H);
    ctx.lineTo(w, HEADER_H);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = RULER_FONT;
    for (let bar = firstBar; bar < firstBar + visibleBars + 1; bar++) {
      const x = bar * barW - sl;
      if (x < 0 || x > w) continue;
      // Tick
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, HEADER_H - 6);
      ctx.lineTo(x, HEADER_H);
      ctx.stroke();
      // Label
      if (barW > 20 || bar % Math.ceil(30 / barW) === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText(`${bar + 1}`, x + 3, HEADER_H - 10);
      }
      // Beat ticks
      for (let beat = 1; beat < BEAT_DIVISIONS; beat++) {
        const bx = x + (beat / BEAT_DIVISIONS) * barW;
        if (bx < 0 || bx > w) continue;
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(bx, HEADER_H - 3);
        ctx.lineTo(bx, HEADER_H);
        ctx.stroke();
      }
    }

    // ── Playhead ─────────────────────────────────────────────
    const phX = ph * barW - sl;
    if (phX >= 0 && phX <= w) {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(phX, 0);
      ctx.lineTo(phX, h);
      ctx.stroke();
      // Playhead head triangle
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(phX - 5, 0);
      ctx.lineTo(phX + 5, 0);
      ctx.lineTo(phX, 10);
      ctx.closePath();
      ctx.fill();
    }
  }, [loopEnabled]);

  // ── ResizeObserver ───────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        canvas.width = width;
        canvas.height = height;
        canvasSizeRef.current = { w: width, h: height };
        draw();
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [draw]);

  // Redraw whenever state changes
  useEffect(() => { draw(); }, [draw, clips, tracks, zoom, scrollLeft, playhead, loopEnabled]);

  // ── Canvas interaction helpers ─────────────────────────────────
  function getBarFromX(clientX: number): number {
    const canvas = canvasRef.current;
    if (!canvas) return 0;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left + scrollRef.current;
    return Math.max(0, x / (BASE_BAR_WIDTH * zoomRef.current));
  }

  function hitTestClip(clientX: number, clientY: number): { clip: ArrClip; mode: DragMode } | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left + scrollRef.current;
    const y = clientY - rect.top;
    const barW = BASE_BAR_WIDTH * zoomRef.current;
    const tks = tracksRef.current;
    const cls = clipsRef.current;

    for (const clip of [...cls].reverse()) {
      const ti = tks.findIndex((t) => t.id === clip.trackId);
      if (ti < 0) continue;
      const cx = clip.startBar * barW;
      const cw = clip.durationBars * barW;
      const cy = HEADER_H + ti * TRACK_H;
      const ch = TRACK_H;

      if (y < cy || y > cy + ch) continue;
      if (x < cx || x > cx + cw) continue;

      const mode: DragMode = x > cx + cw - 8 ? 'resize' : 'move';
      return { clip, mode };
    }
    return null;
  }

  // ── Mouse handlers ───────────────────────────────────────────
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 2) return; // right click handled separately
    const hit = hitTestClip(e.clientX, e.clientY);
    if (hit) {
      dragRef.current = {
        clipId: hit.clip.id,
        mode: hit.mode,
        startX: e.clientX,
        origStart: hit.clip.startBar,
        origDuration: hit.clip.durationBars,
      };
      return;
    }
    // Click on empty area — create new clip
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const y = e.clientY - rect.top;
    if (y < HEADER_H) return; // clicked ruler
    const trackIdx = Math.floor((y - HEADER_H) / TRACK_H);
    const tks = tracksRef.current;
    if (trackIdx < 0 || trackIdx >= tks.length) return;
    const track = tks[trackIdx];
    let bar = getBarFromX(e.clientX);
    if (snapEnabled) bar = Math.round(bar);
    const newClip: ArrClip = {
      id: generateId(),
      trackId: track.id,
      name: `${track.name} Clip`,
      startBar: Math.floor(bar),
      durationBars: 2,
      color: track.color,
    };
    setClips((prev) => [...prev, newClip]);
  }, [snapEnabled]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const barW = BASE_BAR_WIDTH * zoomRef.current;
    const deltaBars = dx / barW;

    setClips((prev) => prev.map((c) => {
      if (c.id !== drag.clipId) return c;
      if (drag.mode === 'move') {
        let newStart = drag.origStart + deltaBars;
        if (snapEnabled) newStart = Math.round(newStart);
        return { ...c, startBar: Math.max(0, newStart) };
      } else {
        let newDur = drag.origDuration + deltaBars;
        if (snapEnabled) newDur = Math.round(newDur);
        return { ...c, durationBars: Math.max(1, newDur) };
      }
    }));
  }, [snapEnabled]);

  const handleCanvasMouseUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const handleCanvasContextMenu = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const hit = hitTestClip(e.clientX, e.clientY);
    if (hit) {
      setClips((prev) => prev.filter((c) => c.id !== hit.clip.id));
    }
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (e.shiftKey) {
      // Zoom
      setZoom((z) => Math.max(0.25, Math.min(4, z * (e.deltaY > 0 ? 0.9 : 1.1))));
    } else {
      // Horizontal scroll
      const newSl = Math.max(0, scrollRef.current + e.deltaY);
      scrollRef.current = newSl;
      setScrollLeft(newSl);
    }
  }, []);

  // ── Transport controls ──────────────────────────────────────────
  const handlePlay = async () => {
    if (isPlaying) {
      audioEngine.stop();
    } else {
      await audioEngine.init().catch(() => {});
      audioEngine.start();
    }
  };

  const handleRecord = () => setIsRecording((r) => !r);

  const handleBpmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value, 10);
    if (!isNaN(v) && v >= 60 && v <= 300) {
      setBpm(v);
      audioEngine.setBpm(v);
    }
  };

  const handleTotalBarsChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTotalBars(parseInt(e.target.value, 10) as 16 | 32 | 64 | 128);
  };

  const toggleMute = (trackId: string) => {
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id !== trackId) return t;
        const next = { ...t, muted: !t.muted };
        audioEngine.setChannelMute(trackId, next.muted);
        return next;
      })
    );
  };

  const addClipToTrack = (track: ArrTrack) => {
    const lastClip = [...clipsRef.current]
      .filter((c) => c.trackId === track.id)
      .sort((a, b) => (b.startBar + b.durationBars) - (a.startBar + a.durationBars))[0];
    const startBar = lastClip ? lastClip.startBar + lastClip.durationBars : 0;
    const newClip: ArrClip = {
      id: generateId(),
      trackId: track.id,
      name: `${track.name} Clip`,
      startBar,
      durationBars: 2,
      color: track.color,
    };
    setClips((prev) => [...prev, newClip]);
  };

  // ── BAR:BEAT display ─────────────────────────────────────────
  const bar = Math.floor(playhead) + 1;
  const beat = Math.floor((playhead % 1) * BEAT_DIVISIONS) + 1;
  const posDisplay = `${String(bar).padStart(3, '0')}:${beat}`;

  // ── Render ───────────────────────────────────────────────────
  return (
    <div
      style={{ background: '#0a0a0f', color: '#e2e8f0' }}
      className="flex flex-col h-full w-full select-none"
    >
      {/* ── Toolbar ── */}
      <div
        className="flex items-center gap-2 px-3 shrink-0 border-b"
        style={{ height: 44, borderColor: 'rgba(255,255,255,0.08)', background: '#0f0f18' }}
      >
        {/* Badge */}
        <div
          className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold tracking-widest"
          style={{ background: 'rgba(124,58,237,0.2)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.4)' }}
        >
          <Music size={10} />
          ARRANGEMENT
        </div>

        <div className="w-px h-5 mx-1" style={{ background: 'rgba(255,255,255,0.1)' }} />

        {/* Play/Stop */}
        <motion.button
          onClick={handlePlay}
          whileTap={{ scale: 0.9 }}
          className="flex items-center justify-center w-8 h-8 rounded"
          style={{
            background: isPlaying ? 'rgba(239,68,68,0.2)' : 'rgba(124,58,237,0.2)',
            border: `1px solid ${isPlaying ? '#ef4444' : '#7c3aed'}`,
            color: isPlaying ? '#ef4444' : '#a78bfa',
          }}
          title={isPlaying ? 'Stop' : 'Play'}
        >
          {isPlaying ? <Square size={14} /> : <Play size={14} />}
        </motion.button>

        {/* Record */}
        <motion.button
          onClick={handleRecord}
          whileTap={{ scale: 0.9 }}
          className="flex items-center justify-center w-8 h-8 rounded"
          style={{
            background: isRecording ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${isRecording ? '#ef4444' : 'rgba(255,255,255,0.15)'}`,
            color: isRecording ? '#ef4444' : '#94a3b8',
          }}
          title="Record"
        >
          <Circle size={12} fill={isRecording ? '#ef4444' : 'transparent'} />
        </motion.button>

        <div className="w-px h-5 mx-1" style={{ background: 'rgba(255,255,255,0.1)' }} />

        {/* BPM */}
        <div className="flex items-center gap-1">
          <span className="text-xs" style={{ color: '#64748b' }}>BPM</span>
          <input
            type="number"
            value={bpm}
            onChange={handleBpmChange}
            min={60}
            max={300}
            className="w-14 text-center text-sm font-mono rounded px-1 py-0.5 outline-none"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#f1f5f9',
            }}
          />
        </div>

        <div className="w-px h-5 mx-1" style={{ background: 'rgba(255,255,255,0.1)' }} />

        {/* Loop */}
        <motion.button
          onClick={() => setLoopEnabled((l) => !l)}
          whileTap={{ scale: 0.9 }}
          className="flex items-center justify-center w-8 h-8 rounded"
          style={{
            background: loopEnabled ? 'rgba(6,182,212,0.2)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${loopEnabled ? '#06b6d4' : 'rgba(255,255,255,0.15)'}`,
            color: loopEnabled ? '#06b6d4' : '#64748b',
          }}
          title="Loop"
        >
          <Repeat size={14} />
        </motion.button>

        {/* Snap */}
        <motion.button
          onClick={() => setSnapEnabled((s) => !s)}
          whileTap={{ scale: 0.9 }}
          className="flex items-center justify-center w-8 h-8 rounded"
          style={{
            background: snapEnabled ? 'rgba(6,182,212,0.2)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${snapEnabled ? '#06b6d4' : 'rgba(255,255,255,0.15)'}`,
            color: snapEnabled ? '#06b6d4' : '#64748b',
          }}
          title="Snap to Grid"
        >
          <Grid3X3 size={14} />
        </motion.button>

        <div className="w-px h-5 mx-1" style={{ background: 'rgba(255,255,255,0.1)' }} />

        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <motion.button
            onClick={() => setZoom((z) => Math.max(0.25, z / 1.25))}
            whileTap={{ scale: 0.9 }}
            className="flex items-center justify-center w-7 h-7 rounded"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}
          >
            <ZoomOut size={12} />
          </motion.button>
          <span className="text-xs font-mono w-10 text-center" style={{ color: '#64748b' }}>
            {(zoom * 100).toFixed(0)}%
          </span>
          <motion.button
            onClick={() => setZoom((z) => Math.min(4, z * 1.25))}
            whileTap={{ scale: 0.9 }}
            className="flex items-center justify-center w-7 h-7 rounded"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}
          >
            <ZoomIn size={12} />
          </motion.button>
        </div>

        <div className="w-px h-5 mx-1" style={{ background: 'rgba(255,255,255,0.1)' }} />

        {/* Total bars */}
        <div className="flex items-center gap-1">
          <span className="text-xs" style={{ color: '#64748b' }}>BARS</span>
          <select
            value={totalBars}
            onChange={handleTotalBarsChange}
            className="text-xs rounded px-1 py-0.5 outline-none"
            style={{
              background: '#1a1a2e',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#f1f5f9',
            }}
          >
            {([16, 32, 64, 128] as const).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        <div className="ml-auto" />

        {/* Position display */}
        <div
          className="font-mono text-sm px-2 py-1 rounded"
          style={{ background: '#0f0f1f', border: '1px solid rgba(124,58,237,0.3)', color: '#a78bfa', minWidth: 72, textAlign: 'center' }}
        >
          {posDisplay}
        </div>
      </div>

      {/* ── Main area: track list + canvas ── */}
      <div className="flex flex-row flex-1 overflow-hidden">
        {/* Track headers */}
        <div
          className="flex flex-col shrink-0 border-r"
          style={{ width: TRACK_LIST_W, background: '#0f0f18', borderColor: 'rgba(255,255,255,0.08)' }}
        >
          {/* Ruler placeholder */}
          <div
            className="shrink-0 flex items-center px-2"
            style={{ height: HEADER_H, borderBottom: '1px solid rgba(255,255,255,0.08)', background: '#111118' }}
          >
            <span className="text-xs font-bold tracking-widest" style={{ color: '#475569' }}>TRACKS</span>
          </div>

          {/* Track rows */}
          {tracks.map((track) => (
            <div
              key={track.id}
              className="flex items-center gap-2 px-2 shrink-0 border-b"
              style={{
                height: TRACK_H,
                borderColor: 'rgba(255,255,255,0.06)',
                background: 'transparent',
              }}
            >
              {/* Color strip */}
              <div
                className="w-1 rounded-full shrink-0"
                style={{ height: 24, background: track.color }}
              />

              {/* Track name */}
              <span
                className="text-xs font-medium flex-1 truncate"
                style={{ color: track.muted ? '#475569' : '#cbd5e1' }}
              >
                {track.name}
              </span>

              {/* Add clip button */}
              <motion.button
                onClick={() => addClipToTrack(track)}
                whileTap={{ scale: 0.85 }}
                className="w-5 h-5 flex items-center justify-center rounded text-xs font-bold"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#64748b',
                }}
                title="Add clip"
              >
                +
              </motion.button>

              {/* Mute button */}
              <motion.button
                onClick={() => toggleMute(track.id)}
                whileTap={{ scale: 0.85 }}
                className="w-5 h-5 flex items-center justify-center rounded text-xs font-bold"
                style={{
                  background: track.muted ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${track.muted ? '#ef4444' : 'rgba(255,255,255,0.1)'}`,
                  color: track.muted ? '#ef4444' : '#64748b',
                }}
                title="Mute"
              >
                M
              </motion.button>
            </div>
          ))}
        </div>

        {/* Canvas area */}
        <div
          ref={containerRef}
          className="flex-1 relative overflow-hidden"
          style={{ background: '#0d0d14' }}
        >
          <canvas
            ref={canvasRef}
            style={{ display: 'block', width: '100%', height: '100%', cursor: 'crosshair' }}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            onContextMenu={handleCanvasContextMenu}
            onWheel={handleWheel}
          />
        </div>
      </div>
    </div>
  );
}
