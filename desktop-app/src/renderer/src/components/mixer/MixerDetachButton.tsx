// ─── MixerDetachButton.tsx ────────────────────────────────────────────────────
// Toolbar button that opens/closes the detachable mixer window.

import React, { useState } from 'react'
import { mixerWindowManager } from './MixerWindowManager'

export const MixerDetachButton: React.FC = () => {
  const [open, setOpen] = useState(false)

  function handleClick() {
    mixerWindowManager.toggle()
    setOpen(mixerWindowManager.isOpen())
  }

  return (
    <button
      onClick={handleClick}
      title={open ? 'Close detached mixer' : 'Open mixer in separate window'}
      style={{
        padding:      '3px 8px',
        borderRadius: 4,
        fontSize:     10,
        fontWeight:   open ? 600 : 400,
        cursor:       'pointer',
        background:   open ? 'rgba(124,58,237,0.22)' : 'rgba(255,255,255,0.04)',
        color:        open ? '#a855f7' : '#475569',
        border:       `1px solid ${open ? 'rgba(124,58,237,0.40)' : 'rgba(255,255,255,0.06)'}`,
        transition:   'all 0.12s',
        display:      'flex',
        alignItems:   'center',
        gap:          4,
      }}
    >
      <svg width={11} height={11} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <rect x={1} y={3} width={8} height={7} rx={1} />
        <path d="M5 1h5v5" />
        <path d="M10 1L6 5" />
      </svg>
      Detach
    </button>
  )
}

export default MixerDetachButton
