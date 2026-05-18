import { useRef } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { useTransportStore } from '../../store/transportStore'
import type { Track, Clip } from '../../types/project'

const HEADER_W = 200   // px — track header width
const BAR_W    = 48    // px per bar at zoom 1×
const TRACK_H  = 64    // px per track

export default function ArrangementView() {
  const { project, selectedTrackId, selectedClipId, selectTrack, selectClip, toggleMute, toggleSolo, toggleArm } = useProjectStore()
  const { positionBar, playing } = useTransportStore()
  const scrollRef = useRef<HTMLDivElement>(null)

  const totalWidth = project.totalBars * BAR_W

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: '#0a0a0f' }}>

      {/* Time ruler row */}
      <div className="flex shrink-0" style={{ height: 28, borderBottom: '1px solid #1c1c2e' }}>
        {/* Blank corner above headers */}
        <div style={{ width: HEADER_W, minWidth: HEADER_W, background: '#08080f', borderRight: '1px solid #1c1c2e' }} />

        {/* Ruler */}
        <div className="overflow-hidden flex-1 relative" style={{ background: '#08080f' }}>
          <TimeRuler totalBars={project.totalBars} loopStart={project.loopStart} loopEnd={project.loopEnd} />
        </div>
      </div>

      {/* Body — headers + lanes */}
      <div className="flex flex-1 overflow-hidden">

        {/* Track headers (fixed) */}
        <div
          className="shrink-0 overflow-y-auto"
          style={{ width: HEADER_W, minWidth: HEADER_W, background: '#08080f', borderRight: '1px solid #1c1c2e' }}
        >
          {project.tracks.map(track => (
            <TrackHeader
              key={track.id}
              track={track}
              selected={selectedTrackId === track.id}
              onSelect={() => selectTrack(track.id)}
              onMute={() => toggleMute(track.id)}
              onSolo={() => toggleSolo(track.id)}
              onArm={() => toggleArm(track.id)}
            />
          ))}
          {/* Add track button */}
          <button
            className="w-full h-8 flex items-center justify-center gap-1 text-xs text-studio-muted/50 hover:text-studio-muted transition-colors"
            style={{ borderTop: '1px solid #1c1c2e' }}
          >
            <span>+</span> Add Track
          </button>
        </div>

        {/* Lane area (scrolls horizontally) */}
        <div ref={scrollRef} className="flex-1 overflow-auto relative">
          <div style={{ width: totalWidth, minHeight: '100%', position: 'relative' }}>
            {/* Playhead */}
            <Playhead bar={positionBar} playing={playing} />

            {/* Beat grid */}
            <BeatGrid totalBars={project.totalBars} tracks={project.tracks} />

            {/* Clips */}
            {project.tracks.map((track, i) => (
              <div
                key={track.id}
                className="absolute"
                style={{ top: i * TRACK_H, height: TRACK_H, left: 0, right: 0 }}
              >
                {track.clips.map(clip => (
                  <ClipBlock
                    key={clip.id}
                    clip={clip}
                    track={track}
                    selected={selectedClipId === clip.id}
                    onSelect={() => { selectTrack(track.id); selectClip(clip.id) }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function TrackHeader({ track, selected, onSelect, onMute, onSolo, onArm }: {
  track: Track; selected: boolean
  onSelect: () => void; onMute: () => void; onSolo: () => void; onArm: () => void
}) {
  return (
    <div
      onClick={onSelect}
      className="flex items-center gap-1.5 px-2 cursor-pointer transition-colors shrink-0"
      style={{
        height: TRACK_H,
        borderBottom: '1px solid #1c1c2e',
        background: selected ? 'rgba(124,58,237,0.06)' : 'transparent',
        borderLeft: selected ? `2px solid ${track.color}` : '2px solid transparent',
      }}
    >
      {/* Color swatch */}
      <div className="w-1 h-8 rounded-full shrink-0" style={{ background: track.color }} />

      {/* Name + type */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate" style={{ color: selected ? '#e2e8f0' : '#94a3b8' }}>{track.name}</p>
        <p className="text-[10px] uppercase tracking-wide" style={{ color: track.color, opacity: 0.7 }}>{track.type}</p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-0.5">
        <TrackBtn active={track.muted} onClick={onMute} activeColor="#f59e0b" title="Mute">M</TrackBtn>
        <TrackBtn active={track.soloed} onClick={onSolo} activeColor="#06b6d4" title="Solo">S</TrackBtn>
        <TrackBtn active={track.armed} onClick={onArm} activeColor="#ef4444" title="Record Arm">R</TrackBtn>
      </div>
    </div>
  )
}

function TrackBtn({ children, active, onClick, activeColor, title }: {
  children: React.ReactNode; active: boolean; onClick: (e: React.MouseEvent) => void; activeColor: string; title: string
}) {
  return (
    <button
      title={title}
      onClick={e => { e.stopPropagation(); onClick(e) }}
      className="w-5 h-5 rounded text-[9px] font-bold transition-all"
      style={{
        background: active ? `${activeColor}25` : 'rgba(255,255,255,0.04)',
        color:      active ? activeColor : '#334155',
        border:     `1px solid ${active ? activeColor + '50' : 'transparent'}`,
      }}
    >
      {children}
    </button>
  )
}

function ClipBlock({ clip, track, selected, onSelect }: {
  clip: Clip; track: Track; selected: boolean; onSelect: () => void
}) {
  const left   = (clip.startBar - 1) * BAR_W
  const width  = clip.lengthBars * BAR_W - 2
  const top    = 6
  const height = TRACK_H - 12

  return (
    <div
      onClick={onSelect}
      title={clip.name}
      className="absolute rounded-lg overflow-hidden cursor-pointer transition-all group"
      style={{
        left, top, width, height,
        background:   `${clip.color}18`,
        border:       `1px solid ${selected ? clip.color : clip.color + '55'}`,
        boxShadow:    selected ? `0 0 10px ${clip.color}40` : 'none',
        opacity:      clip.muted || track.muted ? 0.35 : 1,
      }}
    >
      {/* Waveform bars (decorative) */}
      <div className="absolute inset-0 flex items-end gap-px px-1 pb-1 opacity-40">
        {Array.from({ length: Math.max(4, clip.lengthBars * 4) }).map((_, i) => (
          <div key={i} className="flex-1 rounded-t-sm" style={{
            background: clip.color,
            height: `${25 + Math.sin(i * 0.8) * 15 + Math.random() * 20}%`,
          }} />
        ))}
      </div>
      {/* Clip name */}
      <p className="relative text-[10px] font-medium px-1.5 pt-1 truncate" style={{ color: clip.color }}>
        {clip.name}
      </p>
    </div>
  )
}

function TimeRuler({ totalBars, loopStart, loopEnd }: { totalBars: number; loopStart: number; loopEnd: number }) {
  return (
    <div className="relative h-full" style={{ width: totalBars * BAR_W }}>
      {/* Loop region */}
      <div
        className="absolute top-0 bottom-0 opacity-20"
        style={{
          left:       (loopStart - 1) * BAR_W,
          width:      (loopEnd - loopStart) * BAR_W,
          background: 'rgba(124,58,237,0.4)',
        }}
      />
      {/* Bar numbers */}
      {Array.from({ length: totalBars }).map((_, i) => (
        <div
          key={i}
          className="absolute flex items-center"
          style={{ left: i * BAR_W, top: 0, height: '100%', width: BAR_W }}
        >
          <div style={{ width: 1, height: '60%', background: i % 4 === 0 ? '#2e2e42' : '#1c1c2e' }} />
          {i % 4 === 0 && (
            <span className="text-[9px] font-mono pl-1" style={{ color: '#334155' }}>{i + 1}</span>
          )}
        </div>
      ))}
    </div>
  )
}

function BeatGrid({ totalBars, tracks }: { totalBars: number; tracks: Track[] }) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {Array.from({ length: totalBars }).map((_, i) => (
        <div
          key={i}
          className="absolute top-0 bottom-0"
          style={{
            left:        i * BAR_W,
            width:       1,
            background:  i % 4 === 0 ? '#1c1c2e' : '#13131f',
          }}
        />
      ))}
      {tracks.map((_, ti) => (
        <div
          key={ti}
          className="absolute"
          style={{ top: ti * TRACK_H + TRACK_H - 1, left: 0, right: 0, height: 1, background: '#13131f' }}
        />
      ))}
    </div>
  )
}

function Playhead({ bar, playing }: { bar: number; playing: boolean }) {
  return (
    <div
      className="absolute top-0 bottom-0 pointer-events-none z-10"
      style={{
        left:      (bar - 1) * BAR_W,
        width:     2,
        background: playing ? '#a855f7' : '#475569',
        boxShadow:  playing ? '0 0 8px rgba(168,85,247,0.6)' : 'none',
      }}
    >
      <div className="w-3 h-3 -ml-[5px] -mt-0.5" style={{
        background:  playing ? '#a855f7' : '#475569',
        clipPath: 'polygon(50% 100%, 0 0, 100% 0)',
      }} />
    </div>
  )
}
