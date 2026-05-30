import { useOnlineStatus } from '../hooks/useOnlineStatus'

// ─── OfflineBanner — website-level network status bar ─────────────────────────

export default function OfflineBanner() {
  const { isOnline, backendReachable } = useOnlineStatus()
  const backendDown = isOnline && backendReachable === false

  if (isOnline && !backendDown) return null

  const color  = '#ef4444'
  const bg     = 'rgba(239,68,68,0.08)'
  const border = 'rgba(239,68,68,0.2)'
  const msg    = !isOnline
    ? 'You are offline — Marketplace and cloud features are unavailable'
    : 'Server unreachable — some features may be limited'

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        background:     bg,
        borderBottom:   `1px solid ${border}`,
        color,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            8,
        padding:        '6px 16px',
        fontSize:       12,
        fontWeight:     500,
        position:       'relative',
        zIndex:         100,
      }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
        <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <circle cx="12" cy="20" r="1" />
      </svg>
      {msg}
    </div>
  )
}
