// ============================================================
// MixerPanel — Professional DAW mixer with EQ, compressor, sends
// ============================================================
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { motion } from 'framer-motion';
import {
  SlidersHorizontal,
  Volume2,
  VolumeX,
  Zap,
  RotateCcw,
  Radio,
  Plus,
} from 'lucide-react';
import { audioEngine } from '../services/realAudioEngine';

// ── Interface definitions ────────────────────────────────────
type EQBandType = 'lowshelf' | 'peaking' | 'highshelf';

interface EQBand {
  freq: number;
  gain: number;
  q: number;
  type: EQBandType;
  enabled: boolean;
}

interface CompressorSettings {
  threshold: number;
  ratio: number;
  attack: number;
  release: number;
  makeupGain: number;
  enabled: boolean;
}

interface MixChannel {
  id: string;
  name: string;
  color: string;
  volume: number;
  pan: number;
  muted: boolean;
  soloed: boolean;
  eq: [EQBand, EQBand, EQBand];
  compressor: CompressorSettings;
  reverbSend: number;
  delaySend: number;
  level: number;
}

// ── Constants ────────────────────────────────────────────────
const STRIP_W = 88;
const MASTER_W = 100;
const FADER_H = 100;
const VU_H = 120;

const DEFAULT_EQ: [EQBand, EQBand, EQBand] = [
  { freq: 100,  gain: 0, q: 0.7, type: 'lowshelf',  enabled: true },
  { freq: 1000, gain: 0, q: 1,   type: 'peaking',   enabled: true },
  { freq: 8000, gain: 0, q: 0.7, type: 'highshelf', enabled: true },
];

const DEFAULT_COMP: CompressorSettings = {
  threshold: -24, ratio: 4, attack: 10, release: 200, makeupGain: 0, enabled: false,
};

const CHANNEL_DEFS = [
  { id: 'kick',   name: 'Kick',   color: '#ef4444' },
  { id: 'bass',   name: 'Bass',   color: '#f59e0b' },
  { id: 'melody', name: 'Melody', color: '#10b981' },
  { id: 'perc',   name: 'Perc',   color: '#06b6d4' },
  { id: 'fx',     name: 'FX',     color: '#8b5cf6' },
  { id: 'acid',   name: 'Acid',   color: '#ec4899' },
];

function makeDefaultChannels(): MixChannel[] {
  return CHANNEL_DEFS.map((def) => ({
    ...def,
    volume: 0.75,
    pan: 0,
    muted: false,
    soloed: false,
    eq: [
      { ...DEFAULT_EQ[0] },
      { ...DEFAULT_EQ[1] },
      { ...DEFAULT_EQ[2] },
    ] as [EQBand, EQBand, EQBand],
    compressor: { ...DEFAULT_COMP },
    reverbSend: 0.1,
    delaySend: 0,
    level: 0,
  }));
}

interface ReturnChannel {
  id: string;
  name: string;
  volume: number;
  level: number;
}

// ── Knob component ───────────────────────────────────────────
interface KnobProps {
  value: number;       // 0-1 normalised
  onChange: (v: number) => void;
  size?: number;
  color?: string;
  label?: string;
  valueLabel?: string;
}

function Knob({ value, onChange, size = 36, color = '#7c3aed', label, valueLabel }: KnobProps) {
  const dragStartY = useRef<number | null>(null);
  const dragStartVal = useRef(value);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragStartY.current = e.clientY;
    dragStartVal.current = value;

    const onMove = (me: MouseEvent) => {
      if (dragStartY.current === null) return;
      const dy = dragStartY.current - me.clientY; // up = increase
      const delta = dy / 150;
      onChange(Math.max(0, Math.min(1, dragStartVal.current + delta)));
    };
    const onUp = () => {
      dragStartY.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Arc from 225deg to 315deg (270deg sweep), value mapped
  const startAngle = 225 * (Math.PI / 180);
  const sweep = 270 * (Math.PI / 180);
  const angle = startAngle + value * sweep;
  const r = (size - 6) / 2;
  const cx = size / 2;
  const cy = size / 2;

  // Track arc
  const trackPath = (() => {
    const pts: string[] = [];
    const steps = 64;
    for (let i = 0; i <= steps; i++) {
      const a = startAngle + (i / steps) * sweep;
      const x = cx + r * Math.cos(a);
      const y = cy + r * Math.sin(a);
      pts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`);
    }
    return pts.join(' ');
  })();

  // Value arc
  const valuePath = (() => {
    const pts: string[] = [];
    const steps = 32;
    const totalSteps = Math.ceil(value * steps);
    for (let i = 0; i <= totalSteps; i++) {
      const a = startAngle + (i / steps) * sweep;
      const x = cx + r * Math.cos(a);
      const y = cy + r * Math.sin(a);
      pts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`);
    }
    return pts.join(' ');
  })();

  // Indicator dot
  const dotX = cx + (r - 2) * Math.cos(angle);
  const dotY = cy + (r - 2) * Math.sin(angle);

  return (
    <div className="flex flex-col items-center gap-0.5" style={{ cursor: 'ns-resize', userSelect: 'none' }}>
      {label && <span className="text-xs" style={{ color: '#475569', fontSize: 9 }}>{label}</span>}
      <svg
        width={size}
        height={size}
        onMouseDown={handleMouseDown}
        style={{ display: 'block' }}
      >
        {/* Track */}
        <path d={trackPath} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={3} strokeLinecap="round" />
        {/* Value */}
        {value > 0 && (
          <path d={valuePath} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" />
        )}
        {/* Center circle */}
        <circle cx={cx} cy={cy} r={r - 6} fill="#1a1a2e" stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
        {/* Indicator */}
        <circle cx={dotX} cy={dotY} r={2.5} fill={color} />
      </svg>
      {valueLabel && (
        <span className="font-mono" style={{ color: '#94a3b8', fontSize: 9 }}>{valueLabel}</span>
      )}
    </div>
  );
}

// ── Mini Knob ────────────────────────────────────────────────
function MiniKnob({ value, onChange, color = '#7c3aed', label }: {
  value: number; onChange: (v: number) => void; color?: string; label?: string;
}) {
  return <Knob value={value} onChange={onChange} size={26} color={color} label={label} />;
}

// ── VU Meter ─────────────────────────────────────────────────
interface VUMeterProps {
  level: number;        // 0-1
  peakLevel: number;    // 0-1
  height?: number;
}

function VUMeter({ level, peakLevel, height = VU_H }: VUMeterProps) {
  const segments = 24;
  const greenEnd = Math.floor(segments * 0.7);
  const yellowEnd = Math.floor(segments * 0.9);

  return (
    <div
      className="relative flex flex-col-reverse gap-px"
      style={{ width: 10, height, flexShrink: 0 }}
    >
      {Array.from({ length: segments }, (_, i) => {
        const threshold = i / segments;
        const active = level > threshold;
        let color: string;
        if (i < greenEnd) color = active ? '#22c55e' : 'rgba(34,197,94,0.15)';
        else if (i < yellowEnd) color = active ? '#eab308' : 'rgba(234,179,8,0.15)';
        else color = active ? '#ef4444' : 'rgba(239,68,68,0.15)';

        const segH = (height - (segments - 1)) / segments;
        const isPeak = Math.abs(i / segments - peakLevel) < 1 / segments;

        return (
          <div
            key={i}
            style={{
              height: segH,
              background: isPeak && peakLevel > 0.05 ? '#ffffff' : color,
              borderRadius: 1,
              transition: 'background 0.05s',
            }}
          />
        );
      })}
    </div>
  );
}

// ── EQ Mini Display ──────────────────────────────────────────
interface EQMiniProps {
  bands: [EQBand, EQBand, EQBand];
  onBandChange: (index: number, partial: Partial<EQBand>) => void;
}

function EQMiniDisplay({ bands, onBandChange }: EQMiniProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const w = STRIP_W - 8;
  const h = 60;
  const dragInfo = useRef<{ bandIdx: number; startY: number; startGain: number } | null>(null);

  const freqToX = (freq: number) =>
    (Math.log10(freq / 20) / Math.log10(20000 / 20)) * w;
  const gainToY = (gain: number) => h / 2 - (gain / 12) * (h / 2 - 4);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();

    // Approximate curve (connect band points)
    const points: { x: number; y: number }[] = [];
    points.push({ x: 0, y: h / 2 });
    bands.forEach((b) => {
      points.push({ x: freqToX(b.freq), y: gainToY(b.gain) });
    });
    points.push({ x: w, y: h / 2 });

    ctx.beginPath();
    ctx.strokeStyle = 'rgba(124,58,237,0.7)';
    ctx.lineWidth = 1.5;
    points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.stroke();

    // Band dots
    const dotColors = ['#ef4444', '#f59e0b', '#10b981'];
    bands.forEach((b, i) => {
      const x = freqToX(b.freq);
      const y = gainToY(b.gain);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = b.enabled ? dotColors[i] : '#475569';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  }, [bands, w, h]);

  useEffect(() => { draw(); }, [draw]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (w / rect.width);
    const my = (e.clientY - rect.top) * (h / rect.height);

    let closest = -1;
    let minDist = Infinity;
    bands.forEach((b, i) => {
      const dx = freqToX(b.freq) - mx;
      const dy = gainToY(b.gain) - my;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) { minDist = dist; closest = i; }
    });

    if (closest >= 0 && minDist < 20) {
      dragInfo.current = { bandIdx: closest, startY: e.clientY, startGain: bands[closest].gain };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const drag = dragInfo.current;
    if (!drag) return;
    const dy = drag.startY - e.clientY;
    const newGain = Math.max(-12, Math.min(12, drag.startGain + dy * 0.15));
    onBandChange(drag.bandIdx, { gain: newGain });
  };

  const handleMouseUp = () => { dragInfo.current = null; };

  return (
    <canvas
      ref={canvasRef}
      width={w}
      height={h}
      style={{ width: w, height: h, display: 'block', borderRadius: 3, cursor: 'ns-resize' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    />
  );
}

// ── Pan Arc ──────────────────────────────────────────────────
function PanArc({ pan, onChange }: { pan: number; onChange: (v: number) => void }) {
  const dragStartX = useRef<number | null>(null);
  const dragStartPan = useRef(pan);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragStartX.current = e.clientX;
    dragStartPan.current = pan;
    const onMove = (me: MouseEvent) => {
      if (dragStartX.current === null) return;
      const dx = me.clientX - dragStartX.current;
      const newPan = Math.max(-1, Math.min(1, dragStartPan.current + dx / 80));
      onChange(newPan);
    };
    const onUp = () => {
      dragStartX.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const size = 32;
  const cx = size / 2;
  const cy = size / 2;
  const r = 12;
  // Pan arc: center (0) = top (270deg), left=-1→180deg, right=1→360deg
  const baseDeg = 270;
  const panDeg = baseDeg + pan * 90; // -90 to +90 range
  const panRad = panDeg * (Math.PI / 180);
  const dotX = cx + r * Math.cos(panRad);
  const dotY = cy + r * Math.sin(panRad);

  // Arc from center to pan position
  const centerRad = baseDeg * (Math.PI / 180);
  const startAngle = pan < 0 ? panRad : centerRad;
  const endAngle = pan < 0 ? centerRad : panRad;

  const arcX1 = cx + r * Math.cos(startAngle);
  const arcY1 = cy + r * Math.sin(startAngle);
  const arcX2 = cx + r * Math.cos(endAngle);
  const arcY2 = cy + r * Math.sin(endAngle);
  const largeArc = Math.abs(pan * 90) > 180 ? 1 : 0;
  const sweep = pan < 0 ? 0 : 1;

  return (
    <div
      style={{ cursor: 'ew-resize', userSelect: 'none' }}
      onMouseDown={handleMouseDown}
      title={`Pan: ${pan === 0 ? 'C' : pan > 0 ? `R${Math.round(pan * 100)}` : `L${Math.round(-pan * 100)}`}`}
    >
      <svg width={size} height={size}>
        {/* Full track arc */}
        <path
          d={`M ${cx + r * Math.cos(180 * (Math.PI / 180))} ${cy + r * Math.sin(180 * (Math.PI / 180))} A ${r} ${r} 0 1 1 ${cx + r * Math.cos(0)} ${cy + r * Math.sin(0)}`}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={2}
        />
        {/* Active arc */}
        {Math.abs(pan) > 0.01 && (
          <path
            d={`M ${arcX1.toFixed(2)} ${arcY1.toFixed(2)} A ${r} ${r} 0 ${largeArc} ${sweep} ${arcX2.toFixed(2)} ${arcY2.toFixed(2)}`}
            fill="none"
            stroke="#06b6d4"
            strokeWidth={2}
          />
        )}
        {/* Dot */}
        <circle cx={dotX} cy={dotY} r={3} fill="#06b6d4" />
        {/* Center tick */}
        <line
          x1={cx}
          y1={cy - r + 2}
          x2={cx}
          y2={cy - r + 6}
          stroke="rgba(255,255,255,0.3)"
          strokeWidth={1}
        />
      </svg>
    </div>
  );
}

// ── Vertical Fader ───────────────────────────────────────────
function VerticalFader({ value, onChange, color }: { value: number; onChange: (v: number) => void; color: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    const onMove = (me: MouseEvent) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const t = 1 - (me.clientY - rect.top) / rect.height;
      onChange(Math.max(0, Math.min(1, t)));
    };
    const onUp = () => {
      isDragging.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const thumbPos = (1 - value) * FADER_H; // px from top

  return (
    <div
      ref={trackRef}
      style={{
        width: 14,
        height: FADER_H,
        background: 'rgba(255,255,255,0.06)',
        borderRadius: 7,
        position: 'relative',
        cursor: 'ns-resize',
        userSelect: 'none',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Fill */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 2,
          right: 2,
          height: `${value * 100}%`,
          background: `linear-gradient(to top, ${color}88, ${color}44)`,
          borderRadius: 5,
        }}
      />
      {/* Thumb */}
      <div
        style={{
          position: 'absolute',
          top: thumbPos - 6,
          left: 0,
          right: 0,
          height: 12,
          background: '#e2e8f0',
          borderRadius: 6,
          boxShadow: `0 0 4px ${color}`,
          border: `2px solid ${color}`,
        }}
      />
    </div>
  );
}

// ── Compressor indicator ─────────────────────────────────────
function CompressorIndicator({ settings, gainReduction }: {
  settings: CompressorSettings;
  gainReduction: number; // 0-1 (simulated)
}) {
  return (
    <div
      className="w-full flex flex-col gap-0.5 px-0.5"
      style={{ height: 40 }}
    >
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 8, color: '#475569' }}>COMP</span>
        <span
          style={{
            fontSize: 8,
            color: settings.enabled ? '#a78bfa' : '#334155',
            fontFamily: 'monospace',
          }}
        >
          {settings.enabled ? `${settings.ratio}:1` : 'OFF'}
        </span>
      </div>
      {/* GR meter */}
      <div
        style={{
          height: 6,
          background: 'rgba(255,255,255,0.06)',
          borderRadius: 3,
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${gainReduction * 100}%`,
            background: settings.enabled ? 'linear-gradient(to right, #7c3aed, #a78bfa)' : '#334155',
            borderRadius: 3,
            transition: 'width 0.1s',
          }}
        />
      </div>
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 7, color: '#334155', fontFamily: 'monospace' }}>
          THR {settings.threshold}dB
        </span>
        <span style={{ fontSize: 7, color: gainReduction > 0 ? '#a78bfa' : '#334155', fontFamily: 'monospace' }}>
          GR -{(gainReduction * 12).toFixed(1)}
        </span>
      </div>
    </div>
  );
}

// ── Channel Strip ─────────────────────────────────────────────
interface ChannelStripProps {
  channel: MixChannel;
  showFx: boolean;
  onUpdate: (partial: Partial<MixChannel>) => void;
  onUpdateEQ: (index: number, partial: Partial<EQBand>) => void;
  onUpdateComp: (partial: Partial<CompressorSettings>) => void;
  gainReduction: number;
  isMaster?: boolean;
}

function ChannelStrip({
  channel, showFx, onUpdate, onUpdateEQ, onUpdateComp, gainReduction,
}: ChannelStripProps) {
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(channel.name);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingName && nameRef.current) nameRef.current.focus();
  }, [editingName]);

  const commitName = () => {
    onUpdate({ name: nameVal || channel.name });
    setEditingName(false);
  };

  const panLabel = channel.pan === 0 ? 'C'
    : channel.pan > 0 ? `R${Math.round(channel.pan * 100)}`
      : `L${Math.round(-channel.pan * 100)}`;

  return (
    <div
      className="flex flex-col items-center shrink-0 border-r"
      style={{
        width: STRIP_W,
        borderColor: 'rgba(255,255,255,0.06)',
        background: channel.soloed
          ? 'rgba(6,182,212,0.05)'
          : channel.muted
          ? 'rgba(0,0,0,0.2)'
          : 'transparent',
      }}
    >
      {/* Color bar */}
      <div style={{ width: '100%', height: 6, background: channel.color, flexShrink: 0 }} />

      {/* Channel name */}
      <div
        className="w-full px-1 py-1"
        style={{ flexShrink: 0 }}
        onDoubleClick={() => setEditingName(true)}
      >
        {editingName ? (
          <input
            ref={nameRef}
            value={nameVal}
            onChange={(e) => setNameVal(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => { if (e.key === 'Enter') commitName(); }}
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(124,58,237,0.5)',
              borderRadius: 3,
              color: '#f1f5f9',
              fontSize: 10,
              padding: '1px 3px',
              outline: 'none',
            }}
          />
        ) : (
          <div
            className="truncate text-center font-medium"
            style={{ fontSize: 10, color: channel.muted ? '#475569' : '#cbd5e1', cursor: 'text' }}
          >
            {channel.name}
          </div>
        )}
      </div>

      {/* EQ Mini */}
      <div className="px-1 mb-1" style={{ flexShrink: 0 }}>
        <EQMiniDisplay bands={channel.eq} onBandChange={onUpdateEQ} />
      </div>

      {/* Compressor indicator */}
      <div style={{ width: '100%', flexShrink: 0 }}>
        <CompressorIndicator settings={channel.compressor} gainReduction={gainReduction} />
      </div>

      {/* Send knobs */}
      {showFx && (
        <div className="flex gap-1 mb-1" style={{ flexShrink: 0 }}>
          <MiniKnob
            value={channel.reverbSend}
            onChange={(v) => onUpdate({ reverbSend: v })}
            color="#7c3aed"
            label="REV"
          />
          <MiniKnob
            value={channel.delaySend}
            onChange={(v) => onUpdate({ delaySend: v })}
            color="#06b6d4"
            label="DLY"
          />
        </div>
      )}

      {/* Pan */}
      <div className="flex flex-col items-center mb-1" style={{ flexShrink: 0 }}>
        <PanArc pan={channel.pan} onChange={(v) => { onUpdate({ pan: v }); audioEngine.setChannelPan(channel.id, v); }} />
        <span style={{ fontSize: 8, color: '#475569', fontFamily: 'monospace' }}>{panLabel}</span>
      </div>

      {/* VU + Fader row */}
      <div className="flex items-end gap-1 justify-center mb-1" style={{ flexShrink: 0 }}>
        <VUMeter level={channel.level} peakLevel={Math.min(1, channel.level * 1.05)} height={VU_H} />
        <VerticalFader
          value={channel.volume}
          color={channel.color}
          onChange={(v) => {
            onUpdate({ volume: v });
            audioEngine.setChannelVolume(channel.id, v);
          }}
        />
        <VUMeter level={channel.level * 0.95} peakLevel={Math.min(1, channel.level)} height={VU_H} />
      </div>

      {/* Mute / Solo */}
      <div className="flex gap-1 mb-1" style={{ flexShrink: 0 }}>
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={() => {
            const next = !channel.muted;
            onUpdate({ muted: next });
            audioEngine.setChannelMute(channel.id, next);
          }}
          style={{
            width: 28,
            height: 20,
            borderRadius: 3,
            border: `1px solid ${channel.muted ? '#ef4444' : 'rgba(255,255,255,0.15)'}`,
            background: channel.muted ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.05)',
            color: channel.muted ? '#ef4444' : '#64748b',
            fontSize: 9,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          M
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={() => onUpdate({ soloed: !channel.soloed })}
          style={{
            width: 28,
            height: 20,
            borderRadius: 3,
            border: `1px solid ${channel.soloed ? '#f59e0b' : 'rgba(255,255,255,0.15)'}`,
            background: channel.soloed ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.05)',
            color: channel.soloed ? '#f59e0b' : '#64748b',
            fontSize: 9,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          S
        </motion.button>
      </div>

      {/* Channel number label */}
      <div
        className="pb-1"
        style={{ fontSize: 8, color: '#334155', fontFamily: 'monospace', flexShrink: 0 }}
      >
        {channel.id.toUpperCase()}
      </div>
    </div>
  );
}

// ── Master Strip ─────────────────────────────────────────────
function MasterStrip({ masterVolume, masterLevel, masterPeak, onVolumeChange }: {
  masterVolume: number;
  masterLevel: number;
  masterPeak: number;
  onVolumeChange: (v: number) => void;
}) {
  return (
    <div
      className="flex flex-col items-center shrink-0"
      style={{ width: MASTER_W, background: 'rgba(124,58,237,0.06)', borderLeft: '1px solid rgba(124,58,237,0.3)' }}
    >
      <div style={{ width: '100%', height: 6, background: 'linear-gradient(to right, #7c3aed, #06b6d4)', flexShrink: 0 }} />

      <div className="py-1" style={{ flexShrink: 0 }}>
        <span className="text-xs font-bold tracking-widest" style={{ color: '#a78bfa', fontSize: 10 }}>MASTER</span>
      </div>

      {/* Stereo VU */}
      <div className="flex items-end gap-1 justify-center mb-1" style={{ flexShrink: 0, marginTop: 'auto' }}>
        <VUMeter level={masterLevel} peakLevel={masterPeak} height={VU_H + 80} />
        <VerticalFader
          value={masterVolume}
          color="#7c3aed"
          onChange={onVolumeChange}
        />
        <VUMeter level={masterLevel * 0.97} peakLevel={masterPeak} height={VU_H + 80} />
      </div>

      <div className="mb-2" style={{ flexShrink: 0 }}>
        <span style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>
          {(masterVolume * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

// ── Return Strip ─────────────────────────────────────────────
function ReturnStrip({ ch, onVolumeChange }: { ch: ReturnChannel; onVolumeChange: (v: number) => void }) {
  return (
    <div
      className="flex flex-col items-center shrink-0 border-r"
      style={{ width: STRIP_W, borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(6,182,212,0.04)' }}
    >
      <div style={{ width: '100%', height: 6, background: '#06b6d4', flexShrink: 0 }} />
      <div className="py-1" style={{ flexShrink: 0 }}>
        <span style={{ fontSize: 10, color: '#06b6d4', fontWeight: 700 }}>{ch.name}</span>
      </div>
      <div style={{ flex: 1 }} />
      <div className="flex items-end gap-1 justify-center mb-1" style={{ flexShrink: 0 }}>
        <VUMeter level={ch.level} peakLevel={ch.level} height={VU_H} />
        <VerticalFader value={ch.volume} color="#06b6d4" onChange={onVolumeChange} />
        <VUMeter level={ch.level * 0.95} peakLevel={ch.level} height={VU_H} />
      </div>
      <div className="mb-1" style={{ fontSize: 8, color: '#334155', fontFamily: 'monospace', flexShrink: 0 }}>
        {ch.id.toUpperCase()}
      </div>
    </div>
  );
}

// ── Main MixerPanel ───────────────────────────────────────────
export default function MixerPanel() {
  const [channels, setChannels] = useState<MixChannel[]>(makeDefaultChannels);
  const [masterVolume, setMasterVolume] = useState(0.85);
  const [showFx, setShowFx] = useState(true);
  const [showReturns, setShowReturns] = useState(false);
  const [engineState, setEngineState] = useState(audioEngine.getState());
  const [returns, setReturns] = useState<ReturnChannel[]>([
    { id: 'reverb', name: 'REVERB', volume: 0.8, level: 0 },
    { id: 'delay',  name: 'DELAY',  volume: 0.7, level: 0 },
  ]);

  const [masterLevel, setMasterLevel] = useState(0);
  const [masterPeak, setMasterPeak] = useState(0);
  const rafRef = useRef<number>(0);
  const peakHoldRef = useRef<number[]>(channels.map(() => 0));
  const masterPeakRef = useRef(0);
  const masterPeakHoldTimer = useRef(0);

  // ── Simulated gain reductions (per channel) ──────────────────
  const [gainReductions, setGainReductions] = useState<number[]>(channels.map(() => 0));

  // ── Engine state ─────────────────────────────────────────────
  useEffect(() => {
    const unsub = audioEngine.onStateChange((s) => setEngineState(s));
    return unsub;
  }, []);

  // ── VU animation loop ─────────────────────────────────────────
  useEffect(() => {
    const animate = () => {
      const isPlaying = audioEngine.getState().isPlaying;

      setChannels((prev) => prev.map((ch, i) => {
        let lvl: number;
        if (isPlaying) {
          // Simulate level with some randomness
          const base = ch.muted ? 0 : ch.volume * (0.4 + Math.random() * 0.4);
          lvl = Math.max(0, Math.min(1, base));
          if (lvl > (peakHoldRef.current[i] ?? 0)) {
            peakHoldRef.current[i] = lvl;
          } else {
            peakHoldRef.current[i] = Math.max(0, (peakHoldRef.current[i] ?? 0) - 0.003);
          }
        } else {
          lvl = Math.max(0, ch.level - 0.05);
          peakHoldRef.current[i] = Math.max(0, (peakHoldRef.current[i] ?? 0) - 0.01);
        }
        return { ...ch, level: lvl };
      }));

      // Gain reduction simulation (when compressor enabled + playing)
      setGainReductions((prev) =>
        prev.map((gr, i) => {
          const ch = channels[i];
          if (!ch || !ch.compressor.enabled || !isPlaying) return Math.max(0, gr - 0.02);
          const target = ch.volume > Math.pow(10, ch.compressor.threshold / 20) + 0.5 ? Math.random() * 0.4 : 0;
          return gr + (target - gr) * 0.1;
        })
      );

      // Master VU
      const masterLvl = isPlaying ? 0.3 + Math.random() * 0.45 : Math.max(0, masterLevel - 0.05);
      setMasterLevel(masterLvl);
      if (masterLvl > masterPeakRef.current) {
        masterPeakRef.current = masterLvl;
        masterPeakHoldTimer.current = 60;
      } else {
        masterPeakHoldTimer.current = Math.max(0, masterPeakHoldTimer.current - 1);
        if (masterPeakHoldTimer.current === 0) {
          masterPeakRef.current = Math.max(0, masterPeakRef.current - 0.005);
        }
      }
      setMasterPeak(masterPeakRef.current);

      // Return levels
      setReturns((prev) => prev.map((r) => ({
        ...r,
        level: isPlaying ? Math.random() * 0.3 * r.volume : Math.max(0, r.level - 0.05),
      })));

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Channel updaters ─────────────────────────────────────────
  const updateChannel = useCallback((id: string, partial: Partial<MixChannel>) => {
    setChannels((prev) => prev.map((c) => c.id === id ? { ...c, ...partial } : c));
  }, []);

  const updateChannelEQ = useCallback((id: string, bandIdx: number, partial: Partial<EQBand>) => {
    setChannels((prev) => prev.map((c) => {
      if (c.id !== id) return c;
      const newEQ = [...c.eq] as [EQBand, EQBand, EQBand];
      newEQ[bandIdx] = { ...newEQ[bandIdx], ...partial };
      return { ...c, eq: newEQ };
    }));
  }, []);

  const updateChannelComp = useCallback((id: string, partial: Partial<CompressorSettings>) => {
    setChannels((prev) => prev.map((c) =>
      c.id === id ? { ...c, compressor: { ...c.compressor, ...partial } } : c
    ));
  }, []);

  const handleMasterVolume = (v: number) => {
    setMasterVolume(v);
    audioEngine.setMasterVolume(v);
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <div
      style={{ background: '#0a0a0f', color: '#e2e8f0' }}
      className="flex flex-col h-full w-full select-none"
    >
      {/* ── Top bar ── */}
      <div
        className="flex items-center gap-2 px-3 shrink-0 border-b"
        style={{ height: 44, borderColor: 'rgba(255,255,255,0.08)', background: '#0f0f18' }}
      >
        {/* Badge */}
        <div
          className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold tracking-widest"
          style={{ background: 'rgba(124,58,237,0.2)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.4)' }}
        >
          <SlidersHorizontal size={10} />
          MIXER
        </div>

        <div className="w-px h-5 mx-1" style={{ background: 'rgba(255,255,255,0.1)' }} />

        {/* Master volume knob */}
        <div className="flex items-center gap-1">
          <Knob
            value={masterVolume}
            onChange={handleMasterVolume}
            size={30}
            color="#7c3aed"
            label="MASTER"
            valueLabel={`${(masterVolume * 100).toFixed(0)}%`}
          />
        </div>

        {/* Master VU mini */}
        <div className="flex items-center gap-0.5 ml-1">
          <VUMeter level={masterLevel} peakLevel={masterPeak} height={24} />
          <VUMeter level={masterLevel * 0.97} peakLevel={masterPeak} height={24} />
        </div>

        <div className="w-px h-5 mx-1" style={{ background: 'rgba(255,255,255,0.1)' }} />

        {/* FX toggle */}
        <motion.button
          onClick={() => setShowFx((f) => !f)}
          whileTap={{ scale: 0.9 }}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs"
          style={{
            background: showFx ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${showFx ? '#7c3aed' : 'rgba(255,255,255,0.15)'}`,
            color: showFx ? '#a78bfa' : '#64748b',
          }}
        >
          <Zap size={12} />
          FX
        </motion.button>

        {/* Returns toggle */}
        <motion.button
          onClick={() => setShowReturns((r) => !r)}
          whileTap={{ scale: 0.9 }}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs"
          style={{
            background: showReturns ? 'rgba(6,182,212,0.2)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${showReturns ? '#06b6d4' : 'rgba(255,255,255,0.15)'}`,
            color: showReturns ? '#06b6d4' : '#64748b',
          }}
        >
          <Radio size={12} />
          RETURNS
        </motion.button>

        <div className="w-px h-5 mx-1" style={{ background: 'rgba(255,255,255,0.1)' }} />

        {/* Add channel */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#64748b',
          }}
          onClick={() => {
            const colors = ['#ef4444', '#f59e0b', '#10b981', '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
            const newCh: MixChannel = {
              id: `ch${Date.now()}`,
              name: `Ch ${channels.length + 1}`,
              color: colors[channels.length % colors.length],
              volume: 0.75, pan: 0, muted: false, soloed: false,
              eq: [{ ...DEFAULT_EQ[0] }, { ...DEFAULT_EQ[1] }, { ...DEFAULT_EQ[2] }] as [EQBand, EQBand, EQBand],
              compressor: { ...DEFAULT_COMP },
              reverbSend: 0.1, delaySend: 0, level: 0,
            };
            setChannels((prev) => [...prev, newCh]);
            setGainReductions((prev) => [...prev, 0]);
            peakHoldRef.current.push(0);
          }}
        >
          <Plus size={12} />
          ADD
        </motion.button>

        <div className="ml-auto" />

        {/* Reset */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => {
            setChannels(makeDefaultChannels());
            setGainReductions(Array(6).fill(0));
          }}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#64748b',
          }}
          title="Reset to defaults"
        >
          <RotateCcw size={12} />
        </motion.button>
      </div>

      {/* ── Strips area ── */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden flex flex-row" style={{ minHeight: 0 }}>
        {/* Channel strips */}
        {channels.map((ch, idx) => (
          <ChannelStrip
            key={ch.id}
            channel={ch}
            showFx={showFx}
            gainReduction={gainReductions[idx] ?? 0}
            onUpdate={(p) => updateChannel(ch.id, p)}
            onUpdateEQ={(bi, p) => updateChannelEQ(ch.id, bi, p)}
            onUpdateComp={(p) => updateChannelComp(ch.id, p)}
          />
        ))}

        {/* Return channels */}
        {showReturns && returns.map((r, i) => (
          <ReturnStrip
            key={r.id}
            ch={r}
            onVolumeChange={(v) =>
              setReturns((prev) => prev.map((x, j) => j === i ? { ...x, volume: v } : x))
            }
          />
        ))}

        {/* Spacer */}
        <div className="flex-1" style={{ minWidth: 8 }} />

        {/* Master */}
        <MasterStrip
          masterVolume={masterVolume}
          masterLevel={masterLevel}
          masterPeak={masterPeak}
          onVolumeChange={handleMasterVolume}
        />
      </div>

      {/* ── Status bar ── */}
      <div
        className="flex items-center gap-4 px-3 shrink-0 border-t"
        style={{ height: 24, borderColor: 'rgba(255,255,255,0.08)', background: '#0a0a12' }}
      >
        <div className="flex items-center gap-1">
          <span style={{ fontSize: 9, color: '#334155' }}>LATENCY</span>
          <span style={{ fontSize: 9, color: '#475569', fontFamily: 'monospace' }}>
            {engineState.latencyMs.toFixed(1)}ms
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span style={{ fontSize: 9, color: '#334155' }}>CPU</span>
          <span
            style={{
              fontSize: 9,
              fontFamily: 'monospace',
              color: engineState.cpuLoad > 80 ? '#ef4444' : engineState.cpuLoad > 60 ? '#f59e0b' : '#22c55e',
            }}
          >
            {engineState.cpuLoad.toFixed(1)}%
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span style={{ fontSize: 9, color: '#334155' }}>SR</span>
          <span style={{ fontSize: 9, color: '#475569', fontFamily: 'monospace' }}>
            {(engineState.sampleRate / 1000).toFixed(0)}kHz
          </span>
        </div>
        {engineState.overload && (
          <span style={{ fontSize: 9, color: '#ef4444', fontWeight: 700 }}>OVERLOAD</span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Volume2 size={10} style={{ color: '#334155' }} />
          <span style={{ fontSize: 9, color: '#475569', fontFamily: 'monospace' }}>
            {channels.filter((c) => !c.muted).length}/{channels.length} active
          </span>
          {channels.some((c) => c.soloed) && (
            <span style={{ fontSize: 9, color: '#f59e0b', fontWeight: 700, marginLeft: 4 }}>SOLO</span>
          )}
        </div>
      </div>
    </div>
  );
}
