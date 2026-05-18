import { useEffect, useState } from 'react'
import { useTransportStore } from '../../store/transportStore'

export default function StatusBar() {
  const { positionBar, positionBeat, bpm } = useTransportStore()
  const [cpu, setCpu]     = useState(0)
  const [mem, setMem]     = useState(0)
  const [xruns] = useState(0)

  useEffect(() => {
    // Poll audio engine metrics via IPC (stubbed until audio engine is live)
    const id = setInterval(() => {
      setCpu(Math.round(Math.random() * 18 + 2))
      setMem(Math.round(Math.random() * 60 + 120))
    }, 2000)
    return () => clearInterval(id)
  }, [])

  const bar  = String(positionBar).padStart(3, ' ')
  const beat = String(positionBeat).padStart(1, ' ')

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

      <span style={{ color: '#2e2e42' }}>Neurotek Studio v0.2.0</span>
    </div>
  )
}

function Divider() {
  return <span style={{ color: '#1c1c2e' }}>│</span>
}
