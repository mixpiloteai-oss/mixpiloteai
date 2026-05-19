import { useEffect, useState } from 'react'
import { useTransportStore } from '../../store/transportStore'
import { useSaveStore }      from '../../store/saveStore'

export default function StatusBar() {
  const { positionBar, positionBeat, bpm } = useTransportStore()
  const { status, historyOpen, toggleHistory } = useSaveStore()
  const [cpu, setCpu]     = useState(0)
  const [mem, setMem]     = useState(0)
  const [xruns] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setCpu(Math.round(Math.random() * 18 + 2))
      setMem(Math.round(Math.random() * 60 + 120))
    }, 2000)
    return () => clearInterval(id)
  }, [])

  const bar  = String(positionBar).padStart(3, ' ')
  const beat = String(positionBeat).padStart(1, ' ')

  // ── Save status label ────────────────────────────────────────────────────────
  let saveLabel: string
  let saveColor: string
  if (status.state === 'saving') {
    saveLabel = 'Saving…'
    saveColor = '#a78bfa'
  } else if (status.state === 'error') {
    saveLabel = `Save error`
    saveColor = '#ef4444'
  } else if (status.isDirty) {
    saveLabel = `Unsaved · ${status.autoSaveIn}s`
    saveColor = '#f59e0b'
  } else if (status.lastSavedAt) {
    const ago   = Math.round((Date.now() - status.lastSavedAt) / 1000)
    const label = ago < 60 ? `${ago}s ago` : `${Math.floor(ago / 60)}m ago`
    saveLabel   = `Saved ${label}`
    saveColor   = '#475569'
  } else {
    saveLabel = `Auto-save in ${status.autoSaveIn}s`
    saveColor = '#334155'
  }

  return (
    <div
      className="h-6 flex items-center px-4 gap-5 text-[10px] font-mono shrink-0 select-none"
      style={{ background: '#06060d', borderTop: '1px solid #1c1c2e', color: '#475569' }}
    >
      {/* Position */}
      <span className="text-studio-muted/70">
        {bar}:{beat}.00
      </span>

      <Divider />

      {/* BPM */}
      <span>{bpm} BPM</span>

      <Divider />

      {/* Audio engine */}
      <span className={cpu > 75 ? 'text-red-400' : ''}>CPU {cpu}%</span>
      <span>{mem} MB</span>
      <span>44100 Hz · 512</span>
      <span>WASAPI · 12ms</span>

      {xruns > 0 && (
        <>
          <Divider />
          <span className="text-red-400">{xruns} xruns</span>
        </>
      )}

      {/* Spacer */}
      <span className="flex-1" />

      {/* Save status */}
      <Divider />
      <span style={{ color: saveColor, transition: 'color 0.3s' }}>
        {saveLabel}
      </span>

      {/* History toggle */}
      <button
        onClick={toggleHistory}
        title="Save history"
        style={{
          padding:      '1px 5px',
          borderRadius: 3,
          background:   historyOpen ? 'rgba(124,58,237,0.15)' : 'transparent',
          border:       `1px solid ${historyOpen ? 'rgba(124,58,237,0.35)' : 'transparent'}`,
          color:        historyOpen ? '#a78bfa' : '#334155',
          fontSize:     9,
          cursor:       'pointer',
          fontFamily:   'inherit',
        }}
      >
        History
      </button>

      <Divider />
      <span style={{ color: '#2e2e42' }}>Neurotek Studio v0.2.0</span>
    </div>
  )
}

function Divider() {
  return <span style={{ color: '#1c1c2e' }}>│</span>
}
