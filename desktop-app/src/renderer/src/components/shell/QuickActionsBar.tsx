import { useRef } from 'react'
import { useTransportStore } from '../../store/transportStore'
import { useUIStore } from '../../store/uiStore'
import { useHistoryStore } from '../../store/historyStore'
import { useProjectStore } from '../../store/projectStore'
import { HotkeyManager } from '../../hotkeys/HotkeyManager'

// ─── Types ────────────────────────────────────────────────────────────────────

interface BtnProps {
  title: string
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
  active?: boolean
  activeRecord?: boolean
  children: React.ReactNode
}

function Btn({ title, onClick, active, activeRecord, children }: BtnProps): JSX.Element {
  let background = 'transparent'
  let border = '1px solid transparent'
  let color = '#c0c0d0'

  if (activeRecord) {
    background = 'rgba(239, 68, 68, 0.2)'
    border = '1px solid #ef4444'
    color = '#ef4444'
  } else if (active) {
    background = 'rgba(16, 185, 129, 0.2)'
    border = '1px solid #10b981'
    color = '#10b981'
  }

  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        width: 28,
        height: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background,
        border,
        borderRadius: 4,
        cursor: 'pointer',
        fontSize: 14,
        color,
        padding: 0,
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        if (!active && !activeRecord) {
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)'
        }
      }}
      onMouseLeave={(e) => {
        if (!active && !activeRecord) {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
        }
      }}
    >
      {children}
    </button>
  )
}

function Separator(): JSX.Element {
  return (
    <div
      style={{
        width: 1,
        height: 20,
        background: 'rgba(255,255,255,0.1)',
        margin: '0 4px',
        flexShrink: 0,
      }}
    />
  )
}

// ─── QuickActionsBar ──────────────────────────────────────────────────────────

export function QuickActionsBar(): JSX.Element {
  const playing = useTransportStore((s) => s.playing)
  const recording = useTransportStore((s) => s.recording)
  const looping = useTransportStore((s) => s.looping)
  const bpm = useTransportStore((s) => s.bpm)
  const timeSigTop = useTransportStore((s) => s.timeSignatureTop)
  const timeSigBottom = useTransportStore((s) => s.timeSignatureBottom)
  const metronomeEnabled = useTransportStore((s) => s.metronomeEnabled)

  const mixerVisible = useUIStore((s) => s.mixerVisible)
  const pianoRollVisible = useUIStore((s) => s.pianoRollVisible)
  const beginnerMode = useUIStore((s) => s.beginnerMode)

  const canUndo = useHistoryStore((s) => s.canUndo)
  const canRedo = useHistoryStore((s) => s.canRedo)

  const bpmInputRef = useRef<HTMLInputElement>(null)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        height: 36,
        padding: '0 8px',
        background: '#08080f',
        borderBottom: '1px solid #1a1a2e',
        flexShrink: 0,
        overflowX: 'auto',
      }}
    >
      {/* File actions */}
      <Btn
        title="Nouveau projet (Ctrl+N)"
        onClick={() => {
          useProjectStore.setState((s) => ({
            project: { ...s.project, name: 'Untitled Session', tracks: [] },
          }))
        }}
      >
        N
      </Btn>
      <Btn
        title="Ouvrir (Ctrl+O)"
        onClick={() => alert('Open via File > Import')}
      >
        O
      </Btn>
      <Btn
        title="Enregistrer (Ctrl+S)"
        onClick={() => {
          const project = useProjectStore.getState().project
          localStorage.setItem('neurotek-project', JSON.stringify(project))
        }}
      >
        S
      </Btn>

      <Separator />

      {/* Undo / Redo */}
      <Btn
        title="Annuler (Ctrl+Z)"
        onClick={() => useHistoryStore.getState().undo()}
        active={false}
      >
        <span style={{ opacity: canUndo ? 1 : 0.35 }}>↩</span>
      </Btn>
      <Btn
        title="Rétablir (Ctrl+Y)"
        onClick={() => useHistoryStore.getState().redo()}
        active={false}
      >
        <span style={{ opacity: canRedo ? 1 : 0.35 }}>↪</span>
      </Btn>

      <Separator />

      {/* Cut / Copy / Paste */}
      <Btn
        title="Couper (Ctrl+X)"
        onClick={() => HotkeyManager.getInstance().registry.execute('edit.cut')}
      >
        ✂
      </Btn>
      <Btn
        title="Copier (Ctrl+C)"
        onClick={() => HotkeyManager.getInstance().registry.execute('edit.copy')}
      >
        ⎘
      </Btn>
      <Btn
        title="Coller (Ctrl+V)"
        onClick={() => HotkeyManager.getInstance().registry.execute('edit.paste')}
      >
        ⎗
      </Btn>

      <Separator />

      {/* Transport */}
      <Btn
        title={playing ? 'Pause (Space)' : 'Play (Space)'}
        onClick={() => useTransportStore.getState().play()}
        active={playing}
      >
        {playing ? '⏸' : '▶'}
      </Btn>
      <Btn
        title="Stop (Escape)"
        onClick={() => useTransportStore.getState().stop()}
      >
        ⏹
      </Btn>
      <Btn
        title="Enregistrer (Ctrl+R)"
        onClick={() => useTransportStore.getState().toggleRecord()}
        activeRecord={recording}
      >
        ⏺
      </Btn>
      <Btn
        title="Loop (Ctrl+L)"
        onClick={() => useTransportStore.getState().toggleLoop()}
        active={looping}
      >
        ⟳
      </Btn>
      <Btn
        title="Métronome"
        onClick={() => useTransportStore.getState().toggleMetronome()}
        active={metronomeEnabled}
      >
        ♩
      </Btn>

      <Separator />

      {/* BPM */}
      <span style={{ fontSize: 11, color: '#888', marginRight: 2, flexShrink: 0 }}>BPM</span>
      <input
        ref={bpmInputRef}
        type="number"
        value={bpm}
        min={20}
        max={300}
        onChange={(e) => {
          const val = parseInt(e.target.value, 10)
          if (!isNaN(val) && val >= 20 && val <= 300) {
            useTransportStore.getState().setBpm(val)
          }
        }}
        style={{
          width: 50,
          height: 22,
          background: '#0d0d1a',
          border: '1px solid #1a1a2e',
          borderRadius: 4,
          color: '#e2e8f0',
          fontSize: 13,
          textAlign: 'center',
          padding: '0 4px',
          flexShrink: 0,
        }}
      />
      <Btn
        title="BPM +1 (Shift: +10)"
        onClick={(e) => useTransportStore.getState().nudgeBpm(e.shiftKey ? 10 : 1)}
      >
        +
      </Btn>
      <Btn
        title="BPM -1 (Shift: -10)"
        onClick={(e) => useTransportStore.getState().nudgeBpm(e.shiftKey ? -10 : -1)}
      >
        -
      </Btn>

      <Separator />

      {/* Time signature */}
      <span style={{ fontSize: 11, color: '#888', marginRight: 2, flexShrink: 0 }}>Sig</span>
      <select
        value={timeSigTop}
        onChange={(e) =>
          useTransportStore
            .getState()
            .setTimeSignature(parseInt(e.target.value, 10), timeSigBottom)
        }
        style={{
          width: 36,
          height: 22,
          background: '#0d0d1a',
          border: '1px solid #1a1a2e',
          borderRadius: 4,
          color: '#e2e8f0',
          fontSize: 12,
          padding: '0 2px',
          flexShrink: 0,
        }}
      >
        {[2, 3, 4, 5, 6, 7, 8, 9, 12].map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <span style={{ fontSize: 12, color: '#666', margin: '0 2px' }}>/</span>
      <select
        value={timeSigBottom}
        onChange={(e) =>
          useTransportStore
            .getState()
            .setTimeSignature(timeSigTop, parseInt(e.target.value, 10))
        }
        style={{
          width: 36,
          height: 22,
          background: '#0d0d1a',
          border: '1px solid #1a1a2e',
          borderRadius: 4,
          color: '#e2e8f0',
          fontSize: 12,
          padding: '0 2px',
          flexShrink: 0,
        }}
      >
        {[2, 4, 8, 16].map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>

      <Separator />

      {/* View toggles */}
      <Btn
        title="Browser"
        onClick={() => useUIStore.getState().setView('ai')}
      >
        🗂
      </Btn>
      <Btn
        title="Mixer"
        onClick={() => useUIStore.getState().toggleMixer()}
        active={mixerVisible}
      >
        🎚
      </Btn>
      <Btn
        title="Piano Roll"
        onClick={() => useUIStore.getState().togglePianoRoll()}
        active={pianoRollVisible}
      >
        🎹
      </Btn>

      <Separator />

      {/* Beginner mode */}
      <Btn
        title="Mode Débutant — affiche les conseils et raccourcis"
        onClick={() => useUIStore.getState().toggleBeginnerMode()}
        active={beginnerMode}
      >
        ?
      </Btn>

      {/* Spacer to push track count indicator to right */}
      <div style={{ flex: 1 }} />

      {/* Track count indicator */}
      <TrackCountBadge />
    </div>
  )
}

function TrackCountBadge(): JSX.Element {
  const trackCount = useProjectStore((s) => s.project.tracks.length)
  const projectName = useProjectStore((s) => s.project.name)

  return (
    <div
      style={{
        fontSize: 11,
        color: '#555',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        paddingRight: 4,
      }}
      title={projectName}
    >
      {projectName} — {trackCount} {trackCount === 1 ? 'piste' : 'pistes'}
    </div>
  )
}

