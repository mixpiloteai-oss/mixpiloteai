// ─── SafeViewBoundary ──────────────────────────────────────────────────────────
// Per-view error boundary with a visible safe-mode fallback.
// Wraps each main view so a crash in one view doesn't black-screen the whole app.

import React from 'react'
import { bootLog } from '../lib/bootLogger'

interface Props {
  viewName: string
  children: React.ReactNode
}

interface State {
  hasError:  boolean
  message:   string
  stack:     string
}

export class SafeViewBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, message: '', stack: '' }
  }

  static getDerivedStateFromError(err: unknown): Partial<State> {
    return {
      hasError: true,
      message:  err instanceof Error ? err.message : String(err),
      stack:    err instanceof Error ? (err.stack ?? '') : '',
    }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    bootLog.error(`[SafeViewBoundary] ${this.props.viewName} crashed`, error)
    console.error('[SafeViewBoundary] Component stack:', info.componentStack)
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, message: '', stack: '' })
  }

  render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children

    return (
      <div
        style={{
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          height:         '100%',
          width:          '100%',
          background:     '#08080f',
          padding:        32,
          gap:            16,
        }}
      >
        <div style={{
          maxWidth:     520,
          width:        '100%',
          background:   '#0c0c14',
          border:       '1px solid rgba(239,68,68,0.3)',
          borderRadius: 12,
          padding:      24,
          boxShadow:    '0 0 40px rgba(239,68,68,0.08)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{
              width:       28,
              height:      28,
              borderRadius: 6,
              background:  'rgba(239,68,68,0.12)',
              border:      '1px solid rgba(239,68,68,0.3)',
              display:     'flex',
              alignItems:  'center',
              justifyContent: 'center',
              color:       '#ef4444',
              fontSize:    14,
              flexShrink:  0,
            }}>!</div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>
                {this.props.viewName} — render error
              </p>
              <p style={{ fontSize: 10, color: '#64748b', margin: 0, marginTop: 2 }}>
                SAFE_BOOT: other views are still available
              </p>
            </div>
          </div>

          <div style={{
            background:   'rgba(239,68,68,0.05)',
            border:       '1px solid rgba(239,68,68,0.15)',
            borderRadius: 6,
            padding:      '8px 12px',
            marginBottom: 16,
            maxHeight:    120,
            overflow:     'auto',
          }}>
            <p style={{ fontSize: 11, color: '#fca5a5', margin: 0, fontFamily: 'monospace', wordBreak: 'break-word' }}>
              {this.state.message}
            </p>
            {this.state.stack && (
              <pre style={{ fontSize: 9, color: '#64748b', margin: '6px 0 0', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                {this.state.stack.split('\n').slice(1, 6).join('\n')}
              </pre>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={this.handleRetry}
              style={{
                padding:    '7px 14px',
                borderRadius: 7,
                fontSize:   11,
                fontWeight: 600,
                background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                border:     'none',
                color:      '#fff',
                cursor:     'pointer',
              }}
            >
              Retry
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding:    '7px 14px',
                borderRadius: 7,
                fontSize:   11,
                background: 'transparent',
                border:     '1px solid #1c1c2e',
                color:      '#94a3b8',
                cursor:     'pointer',
              }}
            >
              Reload App
            </button>
          </div>
        </div>

        <p style={{ fontSize: 10, color: '#334155', textAlign: 'center' }}>
          Use the sidebar to switch to another view. Open DevTools (Ctrl+Shift+I) to inspect the error.
        </p>
      </div>
    )
  }
}
