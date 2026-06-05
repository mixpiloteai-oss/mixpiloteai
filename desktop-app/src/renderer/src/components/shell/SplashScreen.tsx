// ── SplashScreen.tsx ──────────────────────────────────────────────────────────
// Shown during initial app boot (before AudioEngine, stores, etc. are ready).
// Fades out automatically once `ready` prop becomes true.

import { useEffect, useState } from 'react'

interface SplashScreenProps {
  ready: boolean
}

export default function SplashScreen({ ready }: SplashScreenProps) {
  const [visible, setVisible]  = useState(true)
  const [opacity, setOpacity]  = useState(1)
  const [step, setStep]        = useState(0)

  // Sequence of boot messages
  const STEPS = [
    'Initializing audio engine…',
    'Loading project stores…',
    'Connecting IPC bridge…',
    'Ready',
  ]

  // Cycle through loading messages
  useEffect(() => {
    if (ready) return
    const id = setInterval(() => setStep(s => Math.min(s + 1, STEPS.length - 2)), 600)
    return () => clearInterval(id)
  }, [ready])

  // When parent signals ready: advance to last step, then fade out
  useEffect(() => {
    if (!ready) return
    setStep(STEPS.length - 1)
    const fadeTimer = setTimeout(() => setOpacity(0), 300)
    const hideTimer = setTimeout(() => setVisible(false), 700)
    return () => { clearTimeout(fadeTimer); clearTimeout(hideTimer) }
  }, [ready])

  if (!visible) return null

  return (
    <div
      role="status"
      aria-label="Loading Neurotek Studio"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#08080f',
        opacity,
        transition: 'opacity 400ms ease',
        pointerEvents: opacity < 1 ? 'none' : 'auto',
      }}
    >
      {/* Background glow */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse 50% 35% at 50% 50%, rgba(124,58,237,0.1), transparent)',
        pointerEvents: 'none',
      }} />

      {/* Logo */}
      <div style={{
        width: 56,
        height: 56,
        borderRadius: 14,
        background: 'rgba(124,58,237,0.18)',
        border: '1px solid rgba(124,58,237,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 22,
        fontWeight: 800,
        color: '#a855f7',
        marginBottom: 20,
        boxShadow: '0 0 40px rgba(124,58,237,0.2)',
      }}>
        N
      </div>

      {/* App name */}
      <h1 style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0', marginBottom: 4, letterSpacing: '-0.02em' }}>
        Neurotek Studio
      </h1>
      <p style={{ fontSize: 11, color: '#334155', marginBottom: 32 }}>
        Alpha 0.5.0
      </p>

      {/* Spinner */}
      <div style={{ marginBottom: 16, position: 'relative', width: 24, height: 24 }}>
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          .ns-spinner {
            width: 24px; height: 24px;
            border: 2px solid #1c1c2e;
            border-top-color: #7c3aed;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }
        `}</style>
        <div className="ns-spinner" />
      </div>

      {/* Status text */}
      <p style={{
        fontSize: 11,
        color: '#475569',
        height: 16,
        transition: 'opacity 200ms',
      }}>
        {STEPS[step]}
      </p>

      {/* Version tag */}
      <p style={{
        position: 'absolute',
        bottom: 20,
        fontSize: 10,
        color: '#1c1c2e',
      }}>
        alpha · do not distribute
      </p>
    </div>
  )
}
