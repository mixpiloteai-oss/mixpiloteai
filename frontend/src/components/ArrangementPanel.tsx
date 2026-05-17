// ============================================================
// ArrangementPanel — DAW arrangement timeline with undo/redo,
// clip selection, loop markers, and ruler seek
// ============================================================
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Play, Square, Circle, ZoomIn, ZoomOut, Repeat,
  Grid3X3, Music, Plus, Trash2,
} from 'lucide-react';
import { audioEngine } from '../services/realAudioEngine';
import { useHistoryStore } from '../store/historyStore';

// ── Types ─────────────────────────────────────────────────────
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

type DragTarget = 'clip' | 'loop-start' | 'loop-end' | 'playhead-ruler';
type ClipDragMode = 'move' | 'resize';

interface DragState {
  target: DragTarget;
  clipId?: string;
  mode?: ClipDragMode;
  startX: number;
  origStart?: number;
  origDuration?: number;
  origLoopBar?: number;
}

// ── Constants ─────────────────────────────────────────────────
const BASE_BAR_WIDTH  = 60;
const TRACK_H         = 40;
const HEADER_H        = 32;
const TRACK_LIST_W    = 180;
const BEAT_DIVISIONS  = 4;
const LOOP_HANDLE_W   = 8;
const RULER_FONT      = '10px monospace';

// ── Helpers ───────────────────────────────────────────────────
function generateId(): string {
  return Math.random().toString(36).slice(2, 9);
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── Default data ──────────────────────────────────────────────
const DEFAULT_TRACKS: ArrTrack[] = [
  { id: 'kick',   name: 'Kick',   color: '#ef4444', muted: false, height: TRACK_H },
  { id: 'bass',   name: 'Bass',   color: '#f59e0b', muted: false, height: TRACK_H },
  { id: 'melody', name: 'Melody', color: '#10b981', muted: false, height: TRACK_H },
  { id: 'perc',   name: 'Perc',   color: '#06b6d4', muted: false, height: TRACK_H },
  { id: 'fx',     name: 'FX',     color: '#8b5cf6', muted: false, height: TRACK_H },
  { id: 'acid',   name: 'Acid',   color: '#ec4899', muted: false, height: TRACK_H },
];

const DEFAULT_CLIPS: ArrClip[] = [
  { id: 'c1', trackId: 'kick',   name: 'Kick Loop',  startBar: 0,  durationBars: 4,  color: '#ef4444' },
  { id: 'c2', trackId: 'bass',   name: 'Bass Line',  startBar: 0,  durationBars: 8,  color: '#f59e0b' },
  { id: 'c3', trackId: 'melody', name: 'Melody A',   startBar: 4,  durationBars: 4,  color: '#10b981' },
  { id: 'c4', trackId: 'acid',   name: 'Acid Riff',  startBar: 8,  durationBars: 4,  color: '#ec4899' },
];

// ── Main component ────────────────────────────────────────────
export default function ArrangementPanel() {
  const [tracks, setTracks]               = useState<ArrTrack[]>(DEFAULT_TRACKS);
  const [clips, setClips]                 = useState<ArrClip[]>(DEFAULT_CLIPS);
  const [zoom, setZoom]                   = useState(1);
  const [scrollLeft, setScrollLeft]       = useState(0);
  const [playhead, setPlayhead]           = useState(0);
  const [isPlaying, setIsPlaying]         = useState(false);
  const [isRecording, setIsRecording]     = useState(false);
  const [loopEnabled, setLoopEnabled]     = useState(false);
  const [loopStart, setLoopStart]         = useState(0);
  const [loopEnd, setLoopEnd]             = useState(8);
  const [snapEnabled, setSnapEnabled]     = useState(true);
  const [totalBars, setTotalBars]         = useState<16 | 32 | 64 | 128>(64);
  const [bpm, setBpm]                     = useState(audioEngine.bpm || 140);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

  // ── Refs ───────────────────────────────────────────────────
  const canvasRef          = useRef<HTMLCanvasElement>(null);
  const containerRef       = useRef<HTMLDivElement>(null);
  const canvasSizeRef      = useRef({ w: 800, h: 400 });
  const dragRef            = useRef<DragState | null>(null);
  const scrollRef          = useRef(0);
  const zoomRef            = useRef(zoom);
  const clipsRef           = useRef(clips);
  const tracksRef          = useRef(tracks);
  const playheadRef        = useRef(playhead);
  const loopStartRef       = useRef(loopStart);
  const loopEndRef         = useRef(loopEnd);
  const snapRef            = useRef(snapEnabled);
  const selectedClipIdRef  = useRef(selectedClipId);

  useEffect(() => { zoomRef.current = zoom; },                   [zoom]);
  useEffect(() => { clipsRef.current = clips; },                 [clips]);
  useEffect(() => { tracksRef.current = tracks; },               [tracks]);
  useEffect(() => { playheadRef.current = playhead; },           [playhead]);
  useEffect(() => { loopStartRef.current = loopStart; },         [loopStart]);
  useEffect(() => { loopEndRef.current = loopEnd; },             [loopEnd]);
  useEffect(() => { snapRef.current = snapEnabled; },            [snapEnabled]);
  useEffect(() => { selectedClipIdRef.current = selectedClipId; }, [selectedClipId]);

  // ── Audio engine subscriptions ────────────────────────────
  useEffect(() => {
    const unsub = audioEngine.onStateChange((s) => {
      setIsPlaying(s.isPlaying);
      setBpm(s.bpm);
      if (!s.isPlaying) setPlayhead(0);
    });
    const unsubBeat = audioEngine.onBeat((beat: number, bar: number) => {
      setPlayhead(bar + beat / BEAT_DIVISIONS);
    });
    return () => { unsub(); unsubBeat(); };
  }, []);

  // ── Keyboard shortcuts ────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return;

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedClipIdRef.current) {
        e.preventDefault();
        useHistoryStore.getState().checkpoint('Delete clip');
        setClips(prev => prev.filter(c => c.id !== selectedClipIdRef.current));
        setSelectedClipId(null);
      }
      if (e.key === 'Escape') {
        setSelectedClipId(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Canvas drawing ────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { w, h } = canvasSizeRef.current;
    const barW = BASE_BAR_WIDTH * zoomRef.current;
    const sl   = scrollRef.current;
    const ph   = playheadRef.current;
    const tks  = tracksRef.current;
    const cls  = clipsRef.current;
    const lS   = loopStartRef.current;
    const lE   = loopEndRef.current;
    const selId = selectedClipIdRef.current;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0d0d14';
    ctx.fillRect(0, 0, w, h);

    const visibleBars = Math.ceil(w / barW) + 2;
    const firstBar    = Math.floor(sl / barW);

    // ── Grid lines ────────────────────────────────────────
    for (let bar = firstBar; bar < firstBar + visibleBars + 1; bar++) {
      const x = bar * barW - sl;
      if (x < 0 || x > w) continue;
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, HEADER_H); ctx.lineTo(x, h); ctx.stroke();
      // Beat lines
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 0.5;
      for (let beat = 1; beat < BEAT_DIVISIONS; beat++) {
        const bx = x + (beat / BEAT_DIVISIONS) * barW;
        if (bx < 0 || bx > w) continue;
        ctx.beginPath(); ctx.moveTo(bx, HEADER_H); ctx.lineTo(bx, h); ctx.stroke();
      }
    }

    // ── Alternating track rows ────────────────────────────
    tks.forEach((_, ti) => {
      const ty = HEADER_H + ti * TRACK_H;
      ctx.fillStyle = ti % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent';
      ctx.fillRect(0, ty, w, TRACK_H);
    });

    // ── Loop overlay ──────────────────────────────────────
    if (loopEnabled) {
      const loopX1 = lS * barW - sl;
      const loopX2 = lE * barW - sl;
      ctx.fillStyle = 'rgba(124,58,237,0.1)';
      ctx.fillRect(loopX1, HEADER_H, loopX2 - loopX1, h - HEADER_H);
      ctx.strokeStyle = 'rgba(124,58,237,0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(loopX1, HEADER_H, loopX2 - loopX1, h - HEADER_H);

      // Loop start handle
      ctx.fillStyle = '#7c3aed';
      ctx.fillRect(loopX1 - LOOP_HANDLE_W / 2, HEADER_H, LOOP_HANDLE_W, 16);
      // Loop end handle
      ctx.fillStyle = '#7c3aed';
      ctx.fillRect(loopX2 - LOOP_HANDLE_W / 2, HEADER_H, LOOP_HANDLE_W, 16);
    }

    // ── Clip blocks ───────────────────────────────────────
    cls.forEach((clip) => {
      const ti = tks.findIndex(t => t.id === clip.trackId);
      if (ti < 0) return;
      const cx  = clip.startBar * barW - sl;
      const cw  = clip.durationBars * barW;
      const cy  = HEADER_H + ti * TRACK_H + 2;
      const ch  = TRACK_H - 4;
      if (cx + cw < 0 || cx > w) return;

      const isSelected = clip.id === selId;
      const radius = 4;

      ctx.beginPath();
      ctx.moveTo(cx + radius, cy);
      ctx.lineTo(cx + cw - radius, cy);
      ctx.quadraticCurveTo(cx + cw, cy, cx + cw, cy + radius);
      ctx.lineTo(cx + cw, cy + ch - radius);
      ctx.quadraticCurveTo(cx + cw, cy + ch, cx + cw - radius, cy + ch);
      ctx.lineTo(cx + radius, cy + ch);
      ctx.quadraticCurveTo(cx, cy + ch, cx, cy + ch - radius);
      ctx.lineTo(cx, cy + radius);
      ctx.quadraticCurveTo(cx, cy, cx + radius, cy);
      ctx.closePath();

      const grad = ctx.createLinearGradient(cx, cy, cx, cy + ch);
      grad.addColorStop(0, hexToRgba(clip.color, isSelected ? 1.0 : 0.9));
      grad.addColorStop(1, hexToRgba(clip.color, isSelected ? 0.8 : 0.6));
      ctx.fillStyle = grad;
      ctx.fill();

      // Border — brighter when selected
      ctx.strokeStyle = isSelected ? '#ffffff' : hexToRgba(clip.color, 1);
      ctx.lineWidth   = isSelected ? 2 : 1.5;
      ctx.stroke();

      // Selection glow
      if (isSelected) {
        ctx.shadowColor = 'rgba(255,255,255,0.4)';
        ctx.shadowBlur  = 8;
        ctx.stroke();
        ctx.shadowBlur  = 0;
        ctx.shadowColor = 'transparent';
      }

      // Resize handle
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(cx + cw - 6, cy + 2, 5, ch - 4);

      // Clip name
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.save();
      ctx.beginPath();
      ctx.rect(cx + 4, cy, Math.max(0, cw - 10), ch);
      ctx.clip();
      ctx.fillText(clip.name, cx + 6, cy + ch / 2 + 4);
      ctx.restore();
    });

    // ── Ruler background ──────────────────────────────────
    ctx.fillStyle = '#111118';
    ctx.fillRect(0, 0, w, HEADER_H);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, HEADER_H); ctx.lineTo(w, HEADER_H); ctx.stroke();

    for (let bar = firstBar; bar < firstBar + visibleBars + 1; bar++) {
      const x = bar * barW - sl;
      if (x < 0 || x > w) continue;
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, HEADER_H - 6); ctx.lineTo(x, HEADER_H); ctx.stroke();
      if (barW > 20 || bar % Math.ceil(30 / barW) === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = RULER_FONT;
        ctx.fillText(`${bar + 1}`, x + 3, HEADER_H - 10);
      }
      for (let beat = 1; beat < BEAT_DIVISIONS; beat++) {
        const bx = x + (beat / BEAT_DIVISIONS) * barW;
        if (bx < 0 || bx > w) continue;
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.moveTo(bx, HEADER_H - 3); ctx.lineTo(bx, HEADER_H); ctx.stroke();
      }
    }

    // ── Playhead ──────────────────────────────────────────
    const phX = ph * barW - sl;
    if (phX >= 0 && phX <= w) {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(phX, 0); ctx.lineTo(phX, h); ctx.stroke();
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(phX - 5, 0); ctx.lineTo(phX + 5, 0); ctx.lineTo(phX, 10);
      ctx.closePath(); ctx.fill();
    }
  }, [loopEnabled]);

  // ── ResizeObserver ────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    const canvas    = canvasRef.current;
    if (!container || !canvas) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        canvas.width  = width;
        canvas.height = height;
        canvasSizeRef.current = { w: width, h: height };
        draw();
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [draw]);

  useEffect(() => {
    draw();
  }, [draw, clips, tracks, zoom, scrollLeft, playhead, loopEnabled, loopStart, loopEnd, selectedClipId]);

  // ── Coordinate helpers ─────────────────────────────────────
  function barFromClientX(clientX: number): number {
    const canvas = canvasRef.current;
    if (!canvas) return 0;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left + scrollRef.current;
    return Math.max(0, x / (BASE_BAR_WIDTH * zoomRef.current));
  }

  function hitTestClip(clientX: number, clientY: number): { clip: ArrClip; mode: ClipDragMode } | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect  = canvas.getBoundingClientRect();
    const x     = clientX - rect.left + scrollRef.current;
    const y     = clientY - rect.top;
    const barW  = BASE_BAR_WIDTH * zoomRef.current;
    const tks   = tracksRef.current;
    const cls   = clipsRef.current;

    for (const clip of [...cls].reverse()) {
      const ti  = tks.findIndex(t => t.id === clip.trackId);
      if (ti < 0) continue;
      const cx  = clip.startBar * barW;
      const cw  = clip.durationBars * barW;
      const cy  = HEADER_H + ti * TRACK_H;
      const ch  = TRACK_H;
      if (y < cy || y > cy + ch || x < cx || x > cx + cw) continue;
      const mode: ClipDragMode = x > cx + cw - 8 ? 'resize' : 'move';
      return { clip, mode };
    }
    return null;
  }

  function hitTestLoopHandles(clientX: number, clientY: number): 'loop-start' | 'loop-end' | null {
    const canvas = canvasRef.current;
    if (!canvas || !loopEnabled) return null;
    const rect  = canvas.getBoundingClientRect();
    const x     = clientX - rect.left + scrollRef.current;
    const y     = clientY - rect.top;
    if (y > HEADER_H + 16) return null;
    const barW  = BASE_BAR_WIDTH * zoomRef.current;
    const lSx   = loopStartRef.current * barW;
    const lEx   = loopEndRef.current   * barW;
    if (Math.abs(x - lSx) <= LOOP_HANDLE_W) return 'loop-start';
    if (Math.abs(x - lEx) <= LOOP_HANDLE_W) return 'loop-end';
    return null;
  }

  // ── Mouse handlers ─────────────────────────────────────────
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 2) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const y    = e.clientY - rect.top;

    // Ruler click → seek playhead
    if (y < HEADER_H) {
      // Check loop handles first
      const loopHandle = hitTestLoopHandles(e.clientX, e.clientY);
      if (loopHandle) {
        const origBar = loopHandle === 'loop-start' ? loopStartRef.current : loopEndRef.current;
        dragRef.current = { target: loopHandle, startX: e.clientX, origLoopBar: origBar };
        return;
      }
      // Seek
      const bar = barFromClientX(e.clientX);
      setPlayhead(Math.max(0, bar));
      dragRef.current = { target: 'playhead-ruler', startX: e.clientX };
      return;
    }

    // Loop handle hit test
    const loopHandle = hitTestLoopHandles(e.clientX, e.clientY);
    if (loopHandle) {
      const origBar = loopHandle === 'loop-start' ? loopStartRef.current : loopEndRef.current;
      dragRef.current = { target: loopHandle, startX: e.clientX, origLoopBar: origBar };
      return;
    }

    // Clip hit test
    const hit = hitTestClip(e.clientX, e.clientY);
    if (hit) {
      setSelectedClipId(hit.clip.id);
      useHistoryStore.getState().checkpoint(hit.mode === 'resize' ? 'Resize clip' : 'Move clip');
      dragRef.current = {
        target:       'clip',
        clipId:       hit.clip.id,
        mode:         hit.mode,
        startX:       e.clientX,
        origStart:    hit.clip.startBar,
        origDuration: hit.clip.durationBars,
      };
      return;
    }

    // Click on empty → create new clip
    const trackIdx = Math.floor((y - HEADER_H) / TRACK_H);
    const tks = tracksRef.current;
    if (trackIdx < 0 || trackIdx >= tks.length) return;
    const track = tks[trackIdx];
    let bar = barFromClientX(e.clientX);
    if (snapRef.current) bar = Math.round(bar);
    useHistoryStore.getState().checkpoint('Add clip');
    const newClip: ArrClip = {
      id:           generateId(),
      trackId:      track.id,
      name:         `${track.name} Clip`,
      startBar:     Math.floor(bar),
      durationBars: 2,
      color:        track.color,
    };
    setClips(prev => [...prev, newClip]);
    setSelectedClipId(newClip.id);
  }, [loopEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag) return;

    const dx    = e.clientX - drag.startX;
    const barW  = BASE_BAR_WIDTH * zoomRef.current;
    const dBars = dx / barW;

    if (drag.target === 'playhead-ruler') {
      const bar = barFromClientX(e.clientX);
      setPlayhead(Math.max(0, bar));
      return;
    }

    if (drag.target === 'loop-start') {
      const newBar = Math.max(0, (drag.origLoopBar ?? 0) + dBars);
      const snapped = snapRef.current ? Math.round(newBar) : newBar;
      setLoopStart(Math.min(snapped, loopEndRef.current - 1));
      return;
    }

    if (drag.target === 'loop-end') {
      const newBar = Math.max(1, (drag.origLoopBar ?? 8) + dBars);
      const snapped = snapRef.current ? Math.round(newBar) : newBar;
      setLoopEnd(Math.max(snapped, loopStartRef.current + 1));
      return;
    }

    if (drag.target === 'clip' && drag.clipId) {
      setClips(prev => prev.map(c => {
        if (c.id !== drag.clipId) return c;
        if (drag.mode === 'move') {
          let newStart = (drag.origStart ?? 0) + dBars;
          if (snapRef.current) newStart = Math.round(newStart);
          return { ...c, startBar: Math.max(0, newStart) };
        } else {
          let newDur = (drag.origDuration ?? 2) + dBars;
          if (snapRef.current) newDur = Math.round(newDur);
          return { ...c, durationBars: Math.max(1, newDur) };
        }
      }));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCanvasMouseUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const handleCanvasContextMenu = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const hit = hitTestClip(e.clientX, e.clientY);
    if (hit) {
      useHistoryStore.getState().checkpoint('Delete clip');
      setClips(prev => prev.filter(c => c.id !== hit.clip.id));
      if (selectedClipIdRef.current === hit.clip.id) setSelectedClipId(null);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (e.shiftKey) {
      setZoom(z => Math.max(0.25, Math.min(4, z * (e.deltaY > 0 ? 0.9 : 1.1))));
    } else {
      const newSl = Math.max(0, scrollRef.current + e.deltaY);
      scrollRef.current = newSl;
      setScrollLeft(newSl);
    }
  }, []);

  // ── Track operations ───────────────────────────────────────
  const addClipToTrack = (track: ArrTrack) => {
    const lastClip = [...clipsRef.current]
      .filter(c => c.trackId === track.id)
      .sort((a, b) => (b.startBar + b.durationBars) - (a.startBar + a.durationBars))[0];
    const startBar = lastClip ? lastClip.startBar + lastClip.durationBars : 0;
    useHistoryStore.getState().checkpoint('Add clip');
    const newClip: ArrClip = {
      id: generateId(), trackId: track.id,
      name: `${track.name} Clip`, startBar, durationBars: 2, color: track.color,
    };
    setClips(prev => [...prev, newClip]);
    setSelectedClipId(newClip.id);
  };

  const addTrack = () => {
    const colors = ['#f43f5e', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#6366f1', '#ec4899'];
    const newTrack: ArrTrack = {
      id:     generateId(),
      name:   `Track ${tracks.length + 1}`,
      color:  colors[tracks.length % colors.length],
      muted:  false,
      height: TRACK_H,
    };
    setTracks(prev => [...prev, newTrack]);
  };

  const toggleMute = (trackId: string) => {
    setTracks(prev => prev.map(t => {
      if (t.id !== trackId) return t;
      const next = { ...t, muted: !t.muted };
      audioEngine.setChannelMute(trackId, next.muted);
      return next;
    }));
  };

  const deleteTrack = (trackId: string) => {
    useHistoryStore.getState().checkpoint('Delete track');
    setTracks(prev => prev.filter(t => t.id !== trackId));
    setClips(prev => prev.filter(c => c.trackId !== trackId));
  };

  // ── Transport ──────────────────────────────────────────────
  const handlePlay = async () => {
    if (isPlaying) {
      audioEngine.stop();
    } else {
      await audioEngine.init().catch(() => {});
      audioEngine.start();
    }
  };

  const handleRecord = () => setIsRecording(r => !r);

  const handleBpmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value, 10);
    if (!isNaN(v) && v >= 60 && v <= 300) {
      setBpm(v);
      audioEngine.setBpm(v);
    }
  };

  // ── Position display ───────────────────────────────────────
  const bar         = Math.floor(playhead) + 1;
  const beat        = Math.floor((playhead % 1) * BEAT_DIVISIONS) + 1;
  const posDisplay  = `${String(bar).padStart(3, '0')}:${beat}`;

  const selectedClip = clips.find(c => c.id === selectedClipId) ?? null;

  // ── Render ─────────────────────────────────────────────────
  return (
    <div style={{ background: '#0a0a0f', color: '#e2e8f0' }} className="flex flex-col h-full w-full select-none">

      {/* ── Toolbar ── */}
      <div
        className="flex items-center gap-2 px-3 shrink-0 border-b"
        style={{ height: 44, borderColor: 'rgba(255,255,255,0.08)', background: '#0f0f18' }}
      >
        {/* Badge */}
        <div
          className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold tracking-widest shrink-0"
          style={{ background: 'rgba(124,58,237,0.2)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.4)' }}
        >
          <Music size={10} />
          ARRANGEMENT
        </div>

        <div className="w-px h-5 mx-1 shrink-0" style={{ background: 'rgba(255,255,255,0.1)' }} />

        {/* Play/Stop */}
        <motion.button onClick={handlePlay} whileTap={{ scale: 0.9 }}
          className="flex items-center justify-center w-8 h-8 rounded shrink-0"
          style={{ background: isPlaying ? 'rgba(239,68,68,0.2)' : 'rgba(124,58,237,0.2)', border: `1px solid ${isPlaying ? '#ef4444' : '#7c3aed'}`, color: isPlaying ? '#ef4444' : '#a78bfa' }}
          title={isPlaying ? 'Stop' : 'Play'}
        >
          {isPlaying ? <Square size={14} /> : <Play size={14} />}
        </motion.button>

        {/* Record */}
        <motion.button onClick={handleRecord} whileTap={{ scale: 0.9 }}
          className="flex items-center justify-center w-8 h-8 rounded shrink-0"
          style={{ background: isRecording ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.05)', border: `1px solid ${isRecording ? '#ef4444' : 'rgba(255,255,255,0.15)'}`, color: isRecording ? '#ef4444' : '#94a3b8' }}
          title="Record"
        >
          <Circle size={12} fill={isRecording ? '#ef4444' : 'transparent'} />
        </motion.button>

        <div className="w-px h-5 mx-1 shrink-0" style={{ background: 'rgba(255,255,255,0.1)' }} />

        {/* BPM */}
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-xs" style={{ color: '#64748b' }}>BPM</span>
          <input type="number" value={bpm} onChange={handleBpmChange} min={60} max={300}
            className="w-14 text-center text-sm font-mono rounded px-1 py-0.5 outline-none"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f1f5f9' }}
          />
        </div>

        <div className="w-px h-5 mx-1 shrink-0" style={{ background: 'rgba(255,255,255,0.1)' }} />

        {/* Loop */}
        <motion.button onClick={() => setLoopEnabled(l => !l)} whileTap={{ scale: 0.9 }}
          className="flex items-center justify-center w-8 h-8 rounded shrink-0"
          style={{ background: loopEnabled ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.05)', border: `1px solid ${loopEnabled ? '#7c3aed' : 'rgba(255,255,255,0.15)'}`, color: loopEnabled ? '#a78bfa' : '#64748b' }}
          title="Loop"
        >
          <Repeat size={14} />
        </motion.button>

        {/* Snap */}
        <motion.button onClick={() => setSnapEnabled(s => !s)} whileTap={{ scale: 0.9 }}
          className="flex items-center justify-center w-8 h-8 rounded shrink-0"
          style={{ background: snapEnabled ? 'rgba(6,182,212,0.2)' : 'rgba(255,255,255,0.05)', border: `1px solid ${snapEnabled ? '#06b6d4' : 'rgba(255,255,255,0.15)'}`, color: snapEnabled ? '#06b6d4' : '#64748b' }}
          title="Snap to Grid"
        >
          <Grid3X3 size={14} />
        </motion.button>

        <div className="w-px h-5 mx-1 shrink-0" style={{ background: 'rgba(255,255,255,0.1)' }} />

        {/* Zoom */}
        <div className="flex items-center gap-1 shrink-0">
          <motion.button onClick={() => setZoom(z => Math.max(0.25, z / 1.25))} whileTap={{ scale: 0.9 }}
            className="flex items-center justify-center w-7 h-7 rounded"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}
          >
            <ZoomOut size={12} />
          </motion.button>
          <span className="text-xs font-mono w-10 text-center" style={{ color: '#64748b' }}>
            {(zoom * 100).toFixed(0)}%
          </span>
          <motion.button onClick={() => setZoom(z => Math.min(4, z * 1.25))} whileTap={{ scale: 0.9 }}
            className="flex items-center justify-center w-7 h-7 rounded"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}
          >
            <ZoomIn size={12} />
          </motion.button>
        </div>

        <div className="w-px h-5 mx-1 shrink-0" style={{ background: 'rgba(255,255,255,0.1)' }} />

        {/* Total bars */}
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-xs" style={{ color: '#64748b' }}>BARS</span>
          <select value={totalBars} onChange={e => setTotalBars(parseInt(e.target.value, 10) as 16 | 32 | 64 | 128)}
            className="text-xs rounded px-1 py-0.5 outline-none"
            style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', color: '#f1f5f9' }}
          >
            {([16, 32, 64, 128] as const).map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        <div className="ml-auto" />

        {/* Selected clip info */}
        {selectedClip && (
          <div
            className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs shrink-0"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}
          >
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: selectedClip.color }} />
            <span className="truncate max-w-24">{selectedClip.name}</span>
            <span style={{ color: '#475569' }}>
              {selectedClip.startBar + 1}–{selectedClip.startBar + selectedClip.durationBars + 1}
            </span>
          </div>
        )}

        {/* Position display */}
        <div
          className="font-mono text-sm px-2 py-1 rounded shrink-0"
          style={{ background: '#0f0f1f', border: '1px solid rgba(124,58,237,0.3)', color: '#a78bfa', minWidth: 72, textAlign: 'center' }}
        >
          {posDisplay}
        </div>
      </div>

      {/* ── Main area ── */}
      <div className="flex flex-row flex-1 overflow-hidden">
        {/* Track headers */}
        <div
          className="flex flex-col shrink-0 border-r overflow-y-auto"
          style={{ width: TRACK_LIST_W, background: '#0f0f18', borderColor: 'rgba(255,255,255,0.08)' }}
        >
          {/* Header row */}
          <div
            className="shrink-0 flex items-center justify-between px-2"
            style={{ height: HEADER_H, borderBottom: '1px solid rgba(255,255,255,0.08)', background: '#111118' }}
          >
            <span className="text-xs font-bold tracking-widest" style={{ color: '#475569' }}>TRACKS</span>
            <motion.button
              onClick={addTrack}
              whileTap={{ scale: 0.85 }}
              className="w-5 h-5 flex items-center justify-center rounded text-xs"
              style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.4)', color: '#a78bfa' }}
              title="Add track"
            >
              <Plus size={10} />
            </motion.button>
          </div>

          {/* Track rows */}
          {tracks.map((track) => (
            <div
              key={track.id}
              className="flex items-center gap-1.5 px-2 shrink-0 border-b group"
              style={{ height: TRACK_H, borderColor: 'rgba(255,255,255,0.06)' }}
            >
              <div className="w-1 rounded-full shrink-0" style={{ height: 24, background: track.color }} />
              <span
                className="text-xs font-medium flex-1 truncate"
                style={{ color: track.muted ? '#475569' : '#cbd5e1' }}
              >
                {track.name}
              </span>

              {/* Add clip */}
              <motion.button onClick={() => addClipToTrack(track)} whileTap={{ scale: 0.85 }}
                className="w-5 h-5 flex items-center justify-center rounded text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#64748b' }}
                title="Add clip"
              >
                +
              </motion.button>

              {/* Mute */}
              <motion.button onClick={() => toggleMute(track.id)} whileTap={{ scale: 0.85 }}
                className="w-5 h-5 flex items-center justify-center rounded text-xs font-bold"
                style={{ background: track.muted ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)', border: `1px solid ${track.muted ? '#ef4444' : 'rgba(255,255,255,0.1)'}`, color: track.muted ? '#ef4444' : '#64748b' }}
                title="Mute"
              >
                M
              </motion.button>

              {/* Delete track */}
              <motion.button onClick={() => deleteTrack(track.id)} whileTap={{ scale: 0.85 }}
                className="w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}
                title="Delete track"
              >
                <Trash2 size={9} />
              </motion.button>
            </div>
          ))}
        </div>

        {/* Canvas area */}
        <div ref={containerRef} className="flex-1 relative overflow-hidden" style={{ background: '#0d0d14' }}>
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

      {/* ── Status bar ── */}
      <div
        className="flex items-center gap-4 px-3 shrink-0 border-t text-xs"
        style={{ height: 24, borderColor: 'rgba(255,255,255,0.06)', background: '#0a0a0f', color: '#334155' }}
      >
        <span>{tracks.length} tracks · {clips.length} clips</span>
        {loopEnabled && (
          <span style={{ color: '#7c3aed' }}>
            Loop {loopStart + 1}–{loopEnd + 1}
          </span>
        )}
        <span className="ml-auto">Right-click clip to delete · Delete key removes selected</span>
      </div>
    </div>
  );
}
