/**
 * EngineStatusBanner — shows whether the native Rust audio engine is active
 * or whether the app is running in Web Audio fallback mode.
 *
 * Renders nothing when:
 *   • the status has not loaded yet
 *   • running outside Electron (web preview)
 *   • native engine is active and the user has dismissed the banner
 *
 * Shows a dismissible WARNING banner when the native engine binary was NOT
 * found.  This replaces the previous silent fallback behaviour.
 *
 * Usage (place near the top of the main layout):
 *   <EngineStatusBanner />
 */

import { useEffect, useState } from 'react'

// ─── Types (mirrors AudioEngineProcess.EngineStatus) ─────────────────────────

interface EngineStatus {
  mode:         'native' | 'web-audio-fallback'
  binaryFound:  boolean
  binaryPath:   string | null
  checkedPaths: string[]
  platform:     string
  isRunning:    boolean
  restarts:     number
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EngineStatusBanner() {
  const [status,    setStatus]    = useState<EngineStatus | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [expanded,  setExpanded]  = useState(false)

  // ── Load status on mount ────────────────────────────────────────────────
  useEffect(() => {
    const api = (window as any).electronAPI
    if (!api) return   // running in browser — skip

    // Initial poll
    api.audioEngineStatus?.()
      .then((s: EngineStatus) => setStatus(s))
      .catch(() => { /* main process may not be ready yet */ })

    // Subscribe to live mode-change events (fires immediately after start())
    api.onAudioEngineMode?.((s: EngineStatus) => setStatus(s))
  }, [])

  // ── Nothing to show ─────────────────────────────────────────────────────
  if (!status)       return null     // not loaded yet
  if (dismissed)     return null     // user dismissed
  if (status.mode === 'native' && status.isRunning) return null   // all good

  // ── Native mode but process not yet running (startup) ───────────────────
  if (status.mode === 'native' && !status.isRunning) {
    return (
      <div style={styles.info}>
        <span style={styles.icon}>⚙️</span>
        <span style={styles.text}>Native audio engine starting…</span>
      </div>
    )
  }

  // ── Fallback mode ────────────────────────────────────────────────────────
  return (
    <div style={styles.warning}>
      <div style={styles.row}>
        <span style={styles.icon}>⚠️</span>
        <span style={styles.text}>
          <strong>Web Audio fallback mode</strong>
          {' — '}Native audio engine binary not found.
          Low-latency ASIO/WASAPI/CoreAudio output is unavailable.
        </span>

        <button
          style={styles.detailBtn}
          onClick={() => setExpanded(e => !e)}
          title="Show diagnostic details"
        >
          {expanded ? 'Hide details' : 'Details'}
        </button>

        <button
          style={styles.dismissBtn}
          onClick={() => setDismissed(true)}
          title="Dismiss this warning"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>

      {expanded && (
        <div style={styles.details}>
          <p style={styles.detailLine}>
            <strong>Platform:</strong> {status.platform}
          </p>
          <p style={styles.detailLine}>
            <strong>Binary searched at:</strong>
          </p>
          <ul style={styles.pathList}>
            {status.checkedPaths.map((p, i) => (
              <li key={i} style={styles.pathItem}>
                <code style={styles.code}>{p}</code>
              </li>
            ))}
          </ul>
          <p style={styles.detailLine}>
            <strong>Fix:</strong>{' '}
            <code style={styles.code}>cd native/audio-engine &amp;&amp; cargo build --release</code>
            {' '}then restart the app.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  warning: {
    position: 'fixed' as const,
    bottom: '0',
    left: '0',
    right: '0',
    zIndex: 9999,
    backgroundColor: '#7c3a001a',
    borderTop: '1px solid #c2440680',
    padding: '6px 12px',
    fontSize: '12px',
    color: '#fbbf24',
    backdropFilter: 'blur(4px)',
  },
  info: {
    position: 'fixed' as const,
    bottom: '0',
    left: '0',
    right: '0',
    zIndex: 9999,
    backgroundColor: '#1e40af22',
    borderTop: '1px solid #3b82f640',
    padding: '4px 12px',
    fontSize: '11px',
    color: '#93c5fd',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  row: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: '8px',
    flexWrap: 'wrap' as const,
  },
  icon: {
    flexShrink: 0,
    fontSize: '14px',
  },
  text: {
    flex: 1,
    lineHeight: 1.4,
  },
  detailBtn: {
    background: 'transparent',
    border: '1px solid #c2440680',
    borderRadius: '3px',
    color: '#fbbf24',
    fontSize: '11px',
    padding: '1px 6px',
    cursor: 'pointer',
    flexShrink: 0,
  },
  dismissBtn: {
    background: 'transparent',
    border: 'none',
    color: '#9ca3af',
    fontSize: '14px',
    padding: '0 4px',
    cursor: 'pointer',
    flexShrink: 0,
    lineHeight: 1,
  },
  details: {
    marginTop: '6px',
    paddingTop: '6px',
    borderTop: '1px solid #c2440640',
    color: '#d1d5db',
  },
  detailLine: {
    margin: '2px 0',
    fontSize: '11px',
  },
  pathList: {
    margin: '2px 0 4px 12px',
    padding: 0,
    listStyle: 'disc',
  },
  pathItem: {
    margin: '1px 0',
    fontSize: '10px',
  },
  code: {
    fontFamily: 'monospace',
    fontSize: '10px',
    backgroundColor: '#00000040',
    borderRadius: '2px',
    padding: '0 3px',
  },
}
