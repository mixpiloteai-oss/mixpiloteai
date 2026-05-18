import { useEffect, useRef } from 'react'
import { useTransportStore } from '../../store/transportStore'
import { useProjectStore } from '../../store/projectStore'
import { useUIStore } from '../../store/uiStore'

export default function TransportBar() {
  const {
    playing, recording, looping,
    bpm, timeSignatureTop, timeSignatureBottom,
    positionBar, positionBeat,
    play, stop, pause, toggleRecord, toggleLoop, nudgeBpm,
  } = useTransportStore()

  const projectName = useProjectStore(s => s.project.name)
  const { toggleAIPanel, aiPanelOpen } = useUIStore()

  // Tick position forward while playing
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (playing) {
      timerRef.current = setInterval(() => {
        useTransportStore.setState(s => {
          let beat = s.positionBeat + 1
          let bar  = s.positionBar
          if (beat > s.timeSignatureTop) { beat = 1; bar++ }
          return { positionBar: bar, positionBeat: beat }
        })
      }, (60000 / bpm) / timeSignatureBottom)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [playing, bpm, timeSignatureTop, timeSignatureBottom])

  const pos = `${String(positionBar).padStart(3,'0')}:${positionBeat}.00`

  return (
    <div
      className="h-12 flex items-center gap-2 px-4 shrink-0 select-none"
      style={{ background: '#0c0c14', borderBottom: '1px solid #1c1c2e' }}
    >
      {/* Transport controls */}
      <div className="flex items-center gap-1">
        {/* Stop */}
        <TBtn
          title="Stop (Space)"
          onClick={stop}
          active={false}
          dimmed={!playing}
        >
          <SquareIcon />
        </TBtn>

        {/* Play */}
        <TBtn
          title="Play (Space)"
          onClick={playing ? pause : play}
          active={playing}
          accent="purple"
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </TBtn>

        {/* Record */}
        <TBtn
          title="Record (R)"
          onClick={toggleRecord}
          active={recording}
          accent="red"
        >
          <RecordIcon />
        </TBtn>
      </div>

      <Sep />

      {/* Loop */}
      <TBtn title="Loop" onClick={toggleLoop} active={looping} accent="cyan" small>
        <span className="text-[11px]">⟳</span>
      </TBtn>

      <Sep />

      {/* Position display */}
      <div
        className="px-3 py-1 rounded font-mono text-sm tabular-nums"
        style={{ background: '#06060d', border: '1px solid #1c1c2e', color: playing ? '#a855f7' : '#64748b', minWidth: 100, textAlign: 'center' }}
      >
        {pos}
      </div>

      <Sep />

      {/* BPM */}
      <div className="flex items-center gap-1">
        <button
          className="w-5 h-5 rounded text-studio-muted hover:text-studio-text text-xs flex items-center justify-center hover:bg-white/5 transition-colors"
          onClick={() => nudgeBpm(-1)} title="BPM −1"
        >−</button>
        <div
          className="font-mono text-sm tabular-nums px-2 py-1 rounded cursor-ns-resize"
          style={{ background: '#06060d', border: '1px solid #1c1c2e', color: '#e2e8f0', minWidth: 56, textAlign: 'center' }}
          title="Drag to change BPM"
          onWheel={e => nudgeBpm(e.deltaY < 0 ? 1 : -1)}
        >
          {bpm.toFixed(1)}
        </div>
        <button
          className="w-5 h-5 rounded text-studio-muted hover:text-studio-text text-xs flex items-center justify-center hover:bg-white/5 transition-colors"
          onClick={() => nudgeBpm(1)} title="BPM +1"
        >+</button>
        <span className="text-[10px] text-studio-muted ml-0.5">BPM</span>
      </div>

      {/* Time signature */}
      <div className="font-mono text-xs text-studio-muted px-2"
        style={{ borderLeft: '1px solid #1c1c2e' }}>
        {timeSignatureTop}/{timeSignatureBottom}
      </div>

      <Sep />

      {/* Project name */}
      <span className="text-xs text-studio-muted truncate max-w-36 hidden lg:block">{projectName}</span>

      {/* Spacer */}
      <div className="flex-1" />

      {/* AI button */}
      <button
        onClick={toggleAIPanel}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
        style={{
          background: aiPanelOpen ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.04)',
          color:      aiPanelOpen ? '#a855f7' : '#64748b',
          border:     `1px solid ${aiPanelOpen ? 'rgba(124,58,237,0.4)' : 'transparent'}`,
        }}
      >
        <span>✦</span>
        <span>AI</span>
      </button>
    </div>
  )
}

function TBtn({ children, onClick, active, accent = 'purple', dimmed = false, small = false, title }: {
  children: React.ReactNode
  onClick: () => void
  active: boolean
  accent?: 'purple' | 'red' | 'cyan'
  dimmed?: boolean
  small?: boolean
  title?: string
}) {
  const colors = { purple: '#7c3aed', red: '#ef4444', cyan: '#06b6d4' }
  const color = colors[accent]
  return (
    <button
      title={title}
      onClick={onClick}
      className={`flex items-center justify-center rounded-lg transition-all ${small ? 'w-7 h-7' : 'w-8 h-8'}`}
      style={{
        background: active ? `${color}25` : 'transparent',
        color:      active ? color : dimmed ? '#2e3a4e' : '#475569',
        border:     active ? `1px solid ${color}50` : '1px solid transparent',
      }}
    >
      {children}
    </button>
  )
}

function Sep() { return <div style={{ width: 1, height: 20, background: '#1c1c2e' }} /> }

function PlayIcon()   { return <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><path d="M2 1l9 5-9 5V1z"/></svg> }
function PauseIcon()  { return <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><rect x="1.5" y="1" width="3.5" height="10" rx="1"/><rect x="7" y="1" width="3.5" height="10" rx="1"/></svg> }
function SquareIcon() { return <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><rect x="0.5" y="0.5" width="9" height="9" rx="1"/></svg> }
function RecordIcon() { return <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><circle cx="5" cy="5" r="4.5"/></svg> }
