import { useEffect, useState } from 'react'
import { useMidiStore } from '../../store/midiStore'
import { getMidiLearnManager } from '../../audio/midi/MidiLearnManager'

// ─── MidiLearnOverlay ─────────────────────────────────────────────────────────

export default function MidiLearnOverlay(): JSX.Element | null {
  const isLearning      = useMidiStore(s => s.isLearning)
  const learnTargetLabel = useMidiStore(s => s.learnTargetLabel)
  const setLearning      = useMidiStore(s => s.setLearning)

  // Pulsating border via toggled opacity
  const [borderOpacity, setBorderOpacity] = useState<number>(0.5)

  useEffect(() => {
    if (!isLearning) return
    const id = setInterval(() => {
      setBorderOpacity(prev => (prev > 0.5 ? 0.3 : 0.8))
    }, 500)
    return () => { clearInterval(id) }
  }, [isLearning])

  if (!isLearning) return null

  function handleCancel(): void {
    getMidiLearnManager().disarm()
    setLearning(false)
  }

  const containerStyle: React.CSSProperties = {
    position:     'fixed',
    bottom:       24,
    right:        24,
    zIndex:       9999,
    background:   'rgba(15,5,30,0.95)',
    border:       `1px solid rgba(124,58,237,${borderOpacity})`,
    borderRadius: 8,
    padding:      '14px 18px',
    minWidth:     260,
    maxWidth:     340,
    fontFamily:   'monospace',
    boxShadow:    `0 0 24px rgba(124,58,237,${borderOpacity * 0.4}), 0 8px 32px rgba(0,0,0,0.6)`,
    transition:   'border-color 0.4s, box-shadow 0.4s',
  }

  const iconRowStyle: React.CSSProperties = {
    display:      'flex',
    alignItems:   'center',
    gap:          8,
    marginBottom: 8,
  }

  const iconStyle: React.CSSProperties = {
    fontSize:    16,
    lineHeight:  1,
  }

  const headingStyle: React.CSSProperties = {
    fontSize:    11,
    fontWeight:  700,
    letterSpacing: '0.1em',
    color:       '#a855f7',
    textTransform: 'uppercase',
  }

  const bodyStyle: React.CSSProperties = {
    fontSize:    10,
    color:       '#64748b',
    marginBottom: 6,
    lineHeight:  1.5,
  }

  const targetStyle: React.CSSProperties = {
    fontSize:    10,
    color:       '#94a3b8',
    marginBottom: 12,
  }

  const targetNameStyle: React.CSSProperties = {
    color:      '#e2e8f0',
    fontWeight: 600,
  }

  const cancelBtnStyle: React.CSSProperties = {
    width:        '100%',
    padding:      '6px 0',
    background:   'rgba(239,68,68,0.1)',
    border:       '1px solid rgba(239,68,68,0.3)',
    borderRadius: 4,
    color:        '#f87171',
    fontSize:     10,
    fontWeight:   700,
    letterSpacing: '0.08em',
    cursor:       'pointer',
    fontFamily:   'monospace',
    textTransform: 'uppercase',
  }

  return (
    <div style={containerStyle} role="dialog" aria-label="MIDI Learn Active">
      <div style={iconRowStyle}>
        <span style={iconStyle} aria-hidden="true">🎛</span>
        <span style={headingStyle}>MIDI Learn Active</span>
      </div>

      <div style={bodyStyle}>Move a knob, fader, or button on your controller.</div>

      {learnTargetLabel && (
        <div style={targetStyle}>
          Target: <span style={targetNameStyle}>"{learnTargetLabel}"</span>
        </div>
      )}

      <button style={cancelBtnStyle} onClick={handleCancel}>
        Cancel
      </button>
    </div>
  )
}
