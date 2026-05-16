// ============================================================
// NEUROTEK AI — Piano Roll Panel
// Full-featured MIDI piano roll with canvas rendering
// ============================================================

import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { motion } from 'framer-motion';
import { Play, Square, ZoomIn, ZoomOut, Trash2, Music2 } from 'lucide-react';
import { audioEngine } from '../services/realAudioEngine';

// ── Constants ────────────────────────────────────────────────
const KEY_WIDTH = 52;
const NOTE_HEIGHT = 12;
const HEADER_H = 32;
const VELOCITY_H = 80;
const MIN_PITCH = 21;  // A0
const MAX_PITCH = 108; // C8
const TOTAL_KEYS = 88;
const BEATS_PER_BAR = 4;

// ── Types ────────────────────────────────────────────────────
interface Note {
  id: string;
  pitch: number;    // MIDI 21-108
  beat: number;     // float, start position in beats
  duration: number; // float, length in beats
  velocity: number; // 0-127
}

type DragMode = 'move' | 'resize' | 'none';

interface DragState {
  mode: DragMode;
  noteId: string | null;
  startX: number;
  startY: number;
  startBeat: number;
  startPitch: number;
  startDuration: number;
  offsetBeat: number;
  offsetPitch: number;
}

// ── Quantize ─────────────────────────────────────────────────
const QUANTIZE_VALUES = [4, 2, 1, 0.5, 0.25, 0.125];
const QUANTIZE_LABELS = ['1/1', '1/2', '1/4', '1/8', '1/16', '1/32'];

// ── Helpers ──────────────────────────────────────────────────
function isBlackKey(midi: number): boolean {
  return [1, 3, 6, 8, 10].includes(midi % 12);
}

function noteLabel(midi: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return names[midi % 12] + (Math.floor(midi / 12) - 1);
}

function snap(beat: number, q: number): number {
  return Math.floor(beat / q) * q;
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ── Main Component ───────────────────────────────────────────
export default function PianoRollPanel() {
  // ── State ──────────────────────────────────────────────────
  const [notes, setNotes] = useState<Note[]>([]);
  const [tool, setTool] = useState<'draw' | 'select' | 'erase'>('draw');
  const [quantize, setQuantize] = useState<number>(0.25);
  const [zoom, setZoom] = useState<number>(1.0);
  const [scrollX, setScrollX] = useState<number>(0);
  const [scrollY, setScrollY] = useState<number>(
    Math.max(0, TOTAL_KEYS * NOTE_HEIGHT / 2 - 200)
  );
  const [lengthBars, setLengthBars] = useState<number>(4);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playhead, setPlayhead] = useState<number>(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Refs ───────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const pianoCanvasRef = useRef<HTMLCanvasElement>(null);
  const rulerCanvasRef = useRef<HTMLCanvasElement>(null);
  const gridCanvasRef = useRef<HTMLCanvasElement>(null);
  const velocityCanvasRef = useRef<HTMLCanvasElement>(null);

  const notesRef = useRef<Note[]>(notes);
  const selectedIdsRef = useRef<Set<string>>(selectedIds);
  const scrollXRef = useRef<number>(scrollX);
  const scrollYRef = useRef<number>(scrollY);
  const zoomRef = useRef<number>(zoom);
  const quantizeRef = useRef<number>(quantize);
  const toolRef = useRef<typeof tool>(tool);
  const playheadRef = useRef<number>(playhead);

  useEffect(() => { notesRef.current = notes; }, [notes]);
  useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);
  useEffect(() => { scrollXRef.current = scrollX; }, [scrollX]);
  useEffect(() => { scrollYRef.current = scrollY; }, [scrollY]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { quantizeRef.current = quantize; }, [quantize]);
  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { playheadRef.current = playhead; }, [playhead]);

  const dragRef = useRef<DragState>({
    mode: 'none',
    noteId: null,
    startX: 0,
    startY: 0,
    startBeat: 0,
    startPitch: 0,
    startDuration: 0,
    offsetBeat: 0,
    offsetPitch: 0,
  });

  const velocityDragRef = useRef<boolean>(false);

  // ── Beat width ─────────────────────────────────────────────
  const beatWidth = (z: number) => 80 * z;

  // ── Coordinate helpers ─────────────────────────────────────
  function xToBeat(x: number, sx: number, z: number): number {
    return (x + sx) / beatWidth(z);
  }

  function yToPitch(y: number, sy: number): number {
    return MAX_PITCH - Math.floor((y + sy) / NOTE_HEIGHT);
  }

  function beatToX(beat: number, sx: number, z: number): number {
    return beat * beatWidth(z) - sx;
  }

  function pitchToY(pitch: number, sy: number): number {
    return (MAX_PITCH - pitch) * NOTE_HEIGHT - sy;
  }

  function noteAtPosition(
    x: number,
    y: number,
    ns: Note[],
    sx: number,
    sy: number,
    z: number
  ): Note | null {
    for (let i = ns.length - 1; i >= 0; i--) {
      const n = ns[i];
      const nx = beatToX(n.beat, sx, z);
      const ny = pitchToY(n.pitch, sy);
      if (x >= nx && x <= nx + n.duration * beatWidth(z) && y >= ny && y <= ny + NOTE_HEIGHT) {
        return n;
      }
    }
    return null;
  }

  // ── Draw: Piano keyboard ────────────────────────────────────
  const drawKeys = useCallback(() => {
    const canvas = pianoCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { width, height } = canvas;
    const sy = scrollYRef.current;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, width, height);

    for (let pitch = MAX_PITCH; pitch >= MIN_PITCH; pitch--) {
      const y = (MAX_PITCH - pitch) * NOTE_HEIGHT - sy;
      if (y + NOTE_HEIGHT < 0 || y > height) continue;

      const black = isBlackKey(pitch);

      if (!black) {
        ctx.fillStyle = '#e8e0f0';
        ctx.fillRect(0, y, KEY_WIDTH, NOTE_HEIGHT);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(0, y, KEY_WIDTH, NOTE_HEIGHT);

        // C note label
        if (pitch % 12 === 0) {
          ctx.fillStyle = '#7c3aed';
          ctx.font = 'bold 8px sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(noteLabel(pitch), KEY_WIDTH - 3, y + NOTE_HEIGHT - 3);
        }
      } else {
        const bw = KEY_WIDTH * 0.65;
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, y, bw, NOTE_HEIGHT);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(0, y, bw, NOTE_HEIGHT);
      }
    }

    // Right border
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(KEY_WIDTH - 0.5, 0);
    ctx.lineTo(KEY_WIDTH - 0.5, height);
    ctx.stroke();
  }, []);

  // ── Draw: Ruler ─────────────────────────────────────────────
  const drawRuler = useCallback((width: number) => {
    const canvas = rulerCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const sx = scrollXRef.current;
    const z = zoomRef.current;
    const bw = beatWidth(z);
    const totalBeats = lengthBars * BEATS_PER_BAR;

    ctx.clearRect(0, 0, width, HEADER_H);
    ctx.fillStyle = '#0d0d18';
    ctx.fillRect(0, 0, width, HEADER_H);

    ctx.font = '10px monospace';
    ctx.textAlign = 'left';

    for (let bar = 0; bar <= lengthBars; bar++) {
      const beatPos = bar * BEATS_PER_BAR;
      const x = beatPos * bw - sx;
      if (x < -50 || x > width) continue;

      // Bar line
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, HEADER_H);
      ctx.stroke();

      // Bar label
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(`${bar + 1}`, x + 3, HEADER_H - 8);

      // Beat ticks within bar
      if (bw > 20) {
        for (let b = 1; b < BEATS_PER_BAR; b++) {
          const bx = (beatPos + b) * bw - sx;
          if (bx < 0 || bx > width) continue;
          ctx.strokeStyle = 'rgba(255,255,255,0.1)';
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(bx, HEADER_H / 2);
          ctx.lineTo(bx, HEADER_H);
          ctx.stroke();
        }
      }
    }

    // Playhead on ruler
    const ph = playheadRef.current;
    if (ph >= 0 && ph <= totalBeats) {
      const phx = ph * bw - sx;
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.moveTo(phx - 6, 0);
      ctx.lineTo(phx + 6, 0);
      ctx.lineTo(phx, 10);
      ctx.closePath();
      ctx.fill();
    }

    // Bottom border
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, HEADER_H - 0.5);
    ctx.lineTo(width, HEADER_H - 0.5);
    ctx.stroke();
  }, [lengthBars]);

  // ── Draw: Note grid ─────────────────────────────────────────
  const drawGrid = useCallback((width: number, height: number) => {
    const canvas = gridCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const sx = scrollXRef.current;
    const sy = scrollYRef.current;
    const z = zoomRef.current;
    const q = quantizeRef.current;
    const ns = notesRef.current;
    const sel = selectedIdsRef.current;
    const bw = beatWidth(z);
    const totalBeats = lengthBars * BEATS_PER_BAR;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, width, height);

    // Background rows
    for (let pitch = MAX_PITCH; pitch >= MIN_PITCH; pitch--) {
      const y = (MAX_PITCH - pitch) * NOTE_HEIGHT - sy;
      if (y + NOTE_HEIGHT < 0 || y > height) continue;

      const black = isBlackKey(pitch);
      const isC = pitch % 12 === 0;

      if (black) {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
      } else if (isC) {
        ctx.fillStyle = 'rgba(124,58,237,0.06)';
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.02)';
      }
      ctx.fillRect(0, y, width, NOTE_HEIGHT);
    }

    // Vertical grid lines
    const subStep = q < 1 ? q : 0;

    for (let beat = 0; beat <= totalBeats; beat += 1) {
      const x = beat * bw - sx;
      if (x < -2 || x > width + 2) continue;
      const isBar = beat % BEATS_PER_BAR === 0;

      ctx.strokeStyle = isBar ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)';
      ctx.lineWidth = isBar ? 1.5 : 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Sub-beat lines
    if (subStep > 0 && bw * subStep > 4) {
      ctx.strokeStyle = 'rgba(255,255,255,0.025)';
      ctx.lineWidth = 0.5;
      for (let b = 0; b <= totalBeats; b += subStep) {
        if (b % 1 === 0) continue; // already drawn above
        const x = b * bw - sx;
        if (x < -1 || x > width + 1) continue;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
    }

    // Notes
    for (const n of ns) {
      const nx = beatToX(n.beat, sx, z);
      const ny = pitchToY(n.pitch, sy);
      const nw = n.duration * bw;
      const nh = NOTE_HEIGHT;

      if (nx + nw < 0 || nx > width || ny + nh < 0 || ny > height) continue;

      const isSelected = sel.has(n.id);
      const vel = n.velocity;
      const noteColor = isSelected
        ? '#facc15'
        : `hsl(${270 - (vel / 127) * 60}, 70%, ${40 + (vel / 127) * 20}%)`;

      // Shadow
      ctx.shadowColor = isSelected ? 'rgba(250,204,21,0.4)' : 'rgba(124,58,237,0.3)';
      ctx.shadowBlur = isSelected ? 6 : 4;

      ctx.fillStyle = noteColor;
      ctx.fillRect(nx, ny + 1, Math.max(nw - 1, 2), nh - 2);

      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';

      // Darker border
      ctx.strokeStyle = isSelected ? '#d97706' : 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(nx, ny + 1, Math.max(nw - 1, 2), nh - 2);

      // Resize handle strip at right edge
      if (nw > 6) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(nx + nw - 3, ny + 1, 3, nh - 2);
      }
    }

    // Playhead
    const ph = playheadRef.current;
    if (ph >= 0 && ph <= totalBeats) {
      const phx = ph * bw - sx;
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(phx, 0);
      ctx.lineTo(phx, height);
      ctx.stroke();

      // Triangle at top
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.moveTo(phx - 5, 0);
      ctx.lineTo(phx + 5, 0);
      ctx.lineTo(phx, 8);
      ctx.closePath();
      ctx.fill();
    }
  }, [lengthBars]);

  // ── Draw: Velocity ───────────────────────────────────────────
  const drawVelocity = useCallback((width: number) => {
    const canvas = velocityCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const height = VELOCITY_H;

    const sx = scrollXRef.current;
    const z = zoomRef.current;
    const ns = notesRef.current;
    const sel = selectedIdsRef.current;
    const bw = beatWidth(z);

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, 0, width, height);

    // Top border
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(width, 0);
    ctx.stroke();

    // Velocity bars
    const barW = Math.max(2, bw * 0.25);
    for (const n of ns) {
      const x = beatToX(n.beat, sx, z);
      if (x + barW < 0 || x > width) continue;

      const isSelected = sel.has(n.id);
      const velH = Math.round((n.velocity / 127) * (height - 8));

      ctx.fillStyle = isSelected ? '#facc15' : '#7c3aed';
      ctx.fillRect(x, height - velH, Math.max(barW - 1, 1), velH);

      // Highlight top
      ctx.fillStyle = isSelected ? 'rgba(250,204,21,0.5)' : 'rgba(168,85,247,0.5)';
      ctx.fillRect(x, height - velH, Math.max(barW - 1, 1), 2);
    }

    // Label
    ctx.fillStyle = 'rgba(226,232,240,0.4)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('VELOCITY', 6, 12);
  }, []);

  // ── Redraw all canvases ──────────────────────────────────────
  const redrawAll = useCallback(() => {
    const gridCanvas = gridCanvasRef.current;
    const velCanvas = velocityCanvasRef.current;

    const gw = gridCanvas?.width ?? 0;
    const gh = gridCanvas?.height ?? 0;
    const vw = velCanvas?.width ?? 0;

    drawGrid(gw, gh);
    drawVelocity(vw);
    drawRuler(gw);
  }, [drawGrid, drawVelocity, drawRuler]);

  // ── ResizeObserver ───────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver(() => {
      const gridCanvas = gridCanvasRef.current;
      const pianoCanvas = pianoCanvasRef.current;
      const rulerCanvas = rulerCanvasRef.current;
      const velCanvas = velocityCanvasRef.current;

      if (!gridCanvas || !pianoCanvas || !rulerCanvas || !velCanvas) return;

      const totalW = container.clientWidth;
      const totalH = container.clientHeight;

      const gridW = Math.max(1, totalW - KEY_WIDTH);
      const topBarH = 48;
      const gridH = Math.max(1, totalH - topBarH - HEADER_H - VELOCITY_H);

      pianoCanvas.width = KEY_WIDTH;
      pianoCanvas.height = gridH;

      rulerCanvas.width = gridW;
      rulerCanvas.height = HEADER_H;

      gridCanvas.width = gridW;
      gridCanvas.height = gridH;

      velCanvas.width = gridW;
      velCanvas.height = VELOCITY_H;

      drawKeys();
      redrawAll();
    });

    ro.observe(container);
    return () => ro.disconnect();
  }, [drawKeys, redrawAll]);

  // ── Main redraw effect ────────────────────────────────────────
  useEffect(() => {
    redrawAll();
  }, [notes, scrollX, scrollY, zoom, playhead, selectedIds, redrawAll]);

  // ── Piano keyboard redraw when scrollY changes ───────────────
  useEffect(() => {
    drawKeys();
  }, [scrollY, drawKeys]);

  // ── Mouse: Note grid ─────────────────────────────────────────
  const handleGridMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = gridCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const sx = scrollXRef.current;
    const sy = scrollYRef.current;
    const z = zoomRef.current;
    const q = quantizeRef.current;
    const currentTool = toolRef.current;
    const currentNotes = notesRef.current;
    const bw = beatWidth(z);

    const hitNote = noteAtPosition(x, y, currentNotes, sx, sy, z);

    if (e.button === 2 || currentTool === 'erase') {
      // Delete note
      if (hitNote) {
        setNotes(prev => prev.filter(n => n.id !== hitNote.id));
        setSelectedIds(prev => {
          const next = new Set(prev);
          next.delete(hitNote.id);
          return next;
        });
      }
      return;
    }

    if (currentTool === 'select') {
      if (hitNote) {
        setSelectedIds(prev => {
          const next = new Set(prev);
          if (next.has(hitNote.id)) {
            next.delete(hitNote.id);
          } else {
            next.add(hitNote.id);
          }
          return next;
        });
      } else {
        setSelectedIds(new Set());
      }
      return;
    }

    // Draw tool
    if (hitNote) {
      const noteX = beatToX(hitNote.beat, sx, z);
      const noteRight = noteX + hitNote.duration * bw;
      const nearRight = x >= noteRight - 5;

      dragRef.current = {
        mode: nearRight ? 'resize' : 'move',
        noteId: hitNote.id,
        startX: x,
        startY: y,
        startBeat: hitNote.beat,
        startPitch: hitNote.pitch,
        startDuration: hitNote.duration,
        offsetBeat: xToBeat(x, sx, z) - hitNote.beat,
        offsetPitch: yToPitch(y, sy) - hitNote.pitch,
      };
    } else {
      // Create new note
      const rawBeat = xToBeat(x, sx, z);
      const snappedBeat = snap(rawBeat, q);
      const pitch = Math.max(MIN_PITCH, Math.min(MAX_PITCH, yToPitch(y, sy)));
      const newNote: Note = {
        id: uid(),
        pitch,
        beat: snappedBeat,
        duration: q,
        velocity: 100,
      };

      setNotes(prev => [...prev, newNote]);

      dragRef.current = {
        mode: 'resize',
        noteId: newNote.id,
        startX: x,
        startY: y,
        startBeat: newNote.beat,
        startPitch: newNote.pitch,
        startDuration: newNote.duration,
        offsetBeat: 0,
        offsetPitch: 0,
      };
    }
  }, []);

  const handleGridMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (drag.mode === 'none' || !drag.noteId) return;

    const canvas = gridCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const sx = scrollXRef.current;
    const sy = scrollYRef.current;
    const z = zoomRef.current;
    const q = quantizeRef.current;

    const rawBeat = xToBeat(x, sx, z);
    const noteId = drag.noteId;

    if (drag.mode === 'resize') {
      const snappedEnd = snap(rawBeat, q);
      const newDuration = Math.max(q, snappedEnd - drag.startBeat);
      setNotes(prev =>
        prev.map(n => n.id === noteId ? { ...n, duration: newDuration } : n)
      );
    } else if (drag.mode === 'move') {
      const newBeat = Math.max(0, snap(rawBeat - drag.offsetBeat, q));
      const rawPitch = yToPitch(y, sy);
      const newPitch = Math.max(MIN_PITCH, Math.min(MAX_PITCH, rawPitch));
      setNotes(prev =>
        prev.map(n => n.id === noteId ? { ...n, beat: newBeat, pitch: newPitch } : n)
      );
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    dragRef.current = {
      mode: 'none',
      noteId: null,
      startX: 0,
      startY: 0,
      startBeat: 0,
      startPitch: 0,
      startDuration: 0,
      offsetBeat: 0,
      offsetPitch: 0,
    };
  }, []);

  // ── Wheel on note grid ────────────────────────────────────────
  const handleGridWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (e.shiftKey) {
      setScrollX(prev => Math.max(0, prev + e.deltaY));
    } else {
      setScrollY(prev =>
        Math.max(0, Math.min(TOTAL_KEYS * NOTE_HEIGHT - 200, prev + e.deltaY))
      );
    }
  }, []);

  // ── Velocity canvas interaction ───────────────────────────────
  const handleVelocityMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    velocityDragRef.current = true;
    updateVelocityFromMouse(e);
  }, []);

  const handleVelocityMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!velocityDragRef.current) return;
    updateVelocityFromMouse(e);
  }, []);

  const handleVelocityMouseUp = useCallback(() => {
    velocityDragRef.current = false;
  }, []);

  function updateVelocityFromMouse(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = velocityCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const sx = scrollXRef.current;
    const z = zoomRef.current;
    const bw = beatWidth(z);
    const ns = notesRef.current;

    if (ns.length === 0) return;

    const clickBeat = xToBeat(x, sx, z);

    // Find closest note by beat
    let closest: Note | null = null;
    let minDist = Infinity;
    for (const n of ns) {
      const dist = Math.abs(n.beat - clickBeat);
      if (dist < minDist) {
        minDist = dist;
        closest = n;
      }
    }

    if (!closest) return;
    if (minDist * bw > 40) return; // too far

    const newVelocity = Math.max(1, Math.min(127,
      Math.round(((VELOCITY_H - y) / VELOCITY_H) * 127)
    ));

    const id = closest.id;
    setNotes(prev =>
      prev.map(n => n.id === id ? { ...n, velocity: newVelocity } : n)
    );
  }

  // ── Transport ─────────────────────────────────────────────────
  const handlePlay = useCallback(async () => {
    try {
      await audioEngine.init();
      audioEngine.start();
      audioEngine.onBeat((beat: number, bar: number) => {
        setPlayhead(bar * BEATS_PER_BAR + beat);
      });
      setIsPlaying(true);
    } catch (err) {
      console.warn('[PianoRoll] Play error:', err);
    }
  }, []);

  const handleStop = useCallback(() => {
    audioEngine.stop();
    setIsPlaying(false);
    setPlayhead(0);
  }, []);

  // ── Render ────────────────────────────────────────────────────
  const totalBeats = lengthBars * BEATS_PER_BAR;

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        background: '#0a0a0f',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'sans-serif',
        color: '#e2e8f0',
        userSelect: 'none',
      }}
    >
      {/* ── Toolbar ─────────────────────────────────────────── */}
      <div
        style={{
          height: 48,
          minHeight: 48,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 12px',
          background: 'rgba(255,255,255,0.03)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          flexShrink: 0,
          overflowX: 'auto',
        }}
      >
        {/* Title badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '3px 10px',
            background: 'rgba(124,58,237,0.2)',
            border: '1px solid rgba(124,58,237,0.4)',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.5,
            color: '#a78bfa',
            whiteSpace: 'nowrap',
          }}
        >
          <Music2 size={12} />
          PIANO ROLL
        </div>

        <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.08)' }} />

        {/* Play / Stop */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={isPlaying ? handleStop : handlePlay}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '5px 10px',
            background: isPlaying ? 'rgba(244,63,94,0.2)' : 'rgba(124,58,237,0.2)',
            border: `1px solid ${isPlaying ? 'rgba(244,63,94,0.5)' : 'rgba(124,58,237,0.4)'}`,
            borderRadius: 6,
            color: isPlaying ? '#f43f5e' : '#a78bfa',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          {isPlaying ? <Square size={13} /> : <Play size={13} />}
          {isPlaying ? 'STOP' : 'PLAY'}
        </motion.button>

        <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.08)' }} />

        {/* Tool selector */}
        <div style={{ display: 'flex', gap: 2 }}>
          {(['draw', 'select', 'erase'] as const).map(t => (
            <motion.button
              key={t}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setTool(t)}
              style={{
                padding: '4px 9px',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: 0.5,
                background: tool === t ? 'rgba(124,58,237,0.35)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${tool === t ? 'rgba(124,58,237,0.6)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 5,
                color: tool === t ? '#a78bfa' : '#94a3b8',
                cursor: 'pointer',
                textTransform: 'uppercase',
              }}
            >
              {t === 'erase' ? <Trash2 size={11} style={{ display: 'inline' }} /> : t.slice(0, 4).toUpperCase()}
            </motion.button>
          ))}
        </div>

        <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.08)' }} />

        {/* Quantize grid selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 10, color: '#64748b', letterSpacing: 1 }}>GRID</span>
          {QUANTIZE_VALUES.map((v, i) => (
            <motion.button
              key={v}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setQuantize(v)}
              style={{
                padding: '3px 7px',
                fontSize: 10,
                background: quantize === v ? 'rgba(6,182,212,0.25)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${quantize === v ? 'rgba(6,182,212,0.5)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 4,
                color: quantize === v ? '#06b6d4' : '#64748b',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {QUANTIZE_LABELS[i]}
            </motion.button>
          ))}
        </div>

        <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.08)' }} />

        {/* Bars selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 10, color: '#64748b', letterSpacing: 1 }}>BARS</span>
          {[2, 4, 8, 16].map(b => (
            <motion.button
              key={b}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setLengthBars(b)}
              style={{
                padding: '3px 7px',
                fontSize: 10,
                background: lengthBars === b ? 'rgba(6,182,212,0.25)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${lengthBars === b ? 'rgba(6,182,212,0.5)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 4,
                color: lengthBars === b ? '#06b6d4' : '#64748b',
                cursor: 'pointer',
              }}
            >
              {b}
            </motion.button>
          ))}
        </div>

        <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.08)' }} />

        {/* Zoom */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setZoom(z => Math.max(0.25, +(z - 0.25).toFixed(2)))}
            style={{
              padding: 4,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 4,
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ZoomOut size={13} />
          </motion.button>
          <span style={{ fontSize: 10, color: '#64748b', minWidth: 32, textAlign: 'center' }}>
            {Math.round(zoom * 100)}%
          </span>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setZoom(z => Math.min(4, +(z + 0.25).toFixed(2)))}
            style={{
              padding: 4,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 4,
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ZoomIn size={13} />
          </motion.button>
        </div>

        <div style={{ flex: 1 }} />

        {/* Note count */}
        <div
          style={{
            padding: '3px 10px',
            fontSize: 11,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 6,
            color: '#64748b',
            whiteSpace: 'nowrap',
          }}
        >
          {notes.length} note{notes.length !== 1 ? 's' : ''}
          {selectedIds.size > 0 && (
            <span style={{ color: '#facc15', marginLeft: 6 }}>
              ({selectedIds.size} sel)
            </span>
          )}
        </div>
      </div>

      {/* ── Editor body ─────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Ruler row */}
        <div style={{ display: 'flex', flexShrink: 0 }}>
          {/* Ruler spacer (under piano keys) */}
          <div
            style={{
              width: KEY_WIDTH,
              minWidth: KEY_WIDTH,
              height: HEADER_H,
              background: '#0d0d18',
              borderRight: '1px solid rgba(255,255,255,0.08)',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              flexShrink: 0,
            }}
          />
          {/* Ruler canvas */}
          <div style={{ flex: 1, overflow: 'hidden', height: HEADER_H }}>
            <canvas
              ref={rulerCanvasRef}
              style={{ display: 'block' }}
            />
          </div>
        </div>

        {/* Piano + Grid row */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Piano keyboard */}
          <div
            style={{
              width: KEY_WIDTH,
              minWidth: KEY_WIDTH,
              overflow: 'hidden',
              flexShrink: 0,
              borderRight: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <canvas
              ref={pianoCanvasRef}
              style={{ display: 'block' }}
            />
          </div>

          {/* Note grid */}
          <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
            <canvas
              ref={gridCanvasRef}
              style={{ display: 'block', cursor: tool === 'erase' ? 'cell' : tool === 'select' ? 'crosshair' : 'default' }}
              onMouseDown={handleGridMouseDown}
              onMouseMove={handleGridMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleGridWheel}
              onContextMenu={e => e.preventDefault()}
            />
          </div>
        </div>

        {/* Velocity row */}
        <div
          style={{
            display: 'flex',
            flexShrink: 0,
            height: VELOCITY_H,
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {/* Velocity label area */}
          <div
            style={{
              width: KEY_WIDTH,
              minWidth: KEY_WIDTH,
              height: VELOCITY_H,
              background: 'rgba(0,0,0,0.4)',
              borderRight: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: 8,
                color: '#334155',
                letterSpacing: 1.5,
                transform: 'rotate(-90deg)',
                whiteSpace: 'nowrap',
                fontWeight: 700,
              }}
            >
              VEL
            </span>
          </div>

          {/* Velocity canvas */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <canvas
              ref={velocityCanvasRef}
              style={{ display: 'block', cursor: 'ns-resize' }}
              onMouseDown={handleVelocityMouseDown}
              onMouseMove={handleVelocityMouseMove}
              onMouseUp={handleVelocityMouseUp}
              onMouseLeave={handleVelocityMouseUp}
              onContextMenu={e => e.preventDefault()}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
