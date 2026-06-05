// ── ToastContainer.tsx ────────────────────────────────────────────────────────
// Renders the global toast/notification queue.
// Mount once in App.tsx; use the toast.* API from anywhere.

import { useEffect, useRef } from 'react'
import { useToastStore } from '../../store/toastStore'
import type { Toast } from '../../store/toastStore'

const COLORS: Record<Toast['type'], { border: string; icon: string; bg: string }> = {
  info:    { border: '#3b82f6', icon: 'ℹ', bg: 'rgba(59,130,246,0.12)' },
  success: { border: '#10b981', icon: '✓', bg: 'rgba(16,185,129,0.12)' },
  warn:    { border: '#f59e0b', icon: '⚠', bg: 'rgba(245,158,11,0.12)' },
  error:   { border: '#ef4444', icon: '✕', bg: 'rgba(239,68,68,0.12)'  },
}

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToastStore(s => s.dismiss)
  const tick    = useToastStore(s => s.tick)
  const startRef = useRef<number | null>(null)
  const rafRef   = useRef<number | null>(null)

  useEffect(() => {
    startRef.current = performance.now()
    function frame(now: number) {
      const elapsed = now - (startRef.current ?? now)
      if (elapsed >= toast.durationMs) {
        dismiss(toast.id)
        return
      }
      tick(toast.id, elapsed)
      rafRef.current = requestAnimationFrame(frame)
    }
    rafRef.current = requestAnimationFrame(frame)
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current) }
  }, [toast.id, toast.durationMs, dismiss, tick])

  const c = COLORS[toast.type]

  return (
    <div
      role="alert"
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '10px 14px',
        borderRadius: 10,
        background: '#0c0c14',
        border: `1px solid ${c.border}40`,
        boxShadow: `0 4px 24px rgba(0,0,0,0.5), inset 0 0 0 1px ${c.border}18`,
        minWidth: 260,
        maxWidth: 360,
        overflow: 'hidden',
        animation: 'toastIn 220ms cubic-bezier(0.34,1.56,0.64,1)',
      }}
    >
      {/* Accent bar */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: c.border, borderRadius: '10px 0 0 10px' }} />

      {/* Icon */}
      <span style={{ fontSize: 13, color: c.border, fontWeight: 700, paddingLeft: 6, paddingTop: 1, flexShrink: 0 }}>
        {c.icon}
      </span>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', lineHeight: 1.3 }}>{toast.title}</p>
        {toast.message && (
          <p style={{ fontSize: 11, color: '#64748b', marginTop: 2, lineHeight: 1.4 }}>{toast.message}</p>
        )}
      </div>

      {/* Dismiss button */}
      <button
        onClick={() => dismiss(toast.id)}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#334155', fontSize: 12, lineHeight: 1, flexShrink: 0 }}
        aria-label="Dismiss"
      >
        ✕
      </button>

      {/* Auto-dismiss progress bar */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: '#0f0f1a' }}>
        <div style={{
          height: '100%',
          background: c.border,
          width: `${toast.progress}%`,
          transition: 'width 0.05s linear',
        }} />
      </div>
    </div>
  )
}

export default function ToastContainer() {
  const toasts = useToastStore(s => s.toasts)

  return (
    <>
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(20px) scale(0.96); }
          to   { opacity: 1; transform: translateX(0)    scale(1);    }
        }
      `}</style>
      <div
        aria-live="polite"
        style={{
          position: 'fixed',
          bottom: 28,
          right: 20,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          pointerEvents: toasts.length > 0 ? 'auto' : 'none',
        }}
      >
        {toasts.map(t => <ToastItem key={t.id} toast={t} />)}
      </div>
    </>
  )
}
