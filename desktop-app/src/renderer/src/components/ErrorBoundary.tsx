import React from 'react'
import { reportBoundaryError } from '../lib/rendererErrorReporter'

interface Props {
  children: React.ReactNode
}

interface State {
  hasError:       boolean
  message:        string
  stack:          string
  componentStack: string
}

// Minimal types for the preload-exposed crash API. Defined locally to avoid
// coupling to a global window typing change.
interface PreloadCrashAPI {
  report?: (payload: {
    source:  'renderer'
    message: string
    stack?:  string
    meta?:   Record<string, unknown>
  }) => Promise<unknown>
}

interface PreloadElectronAPI {
  crash?: PreloadCrashAPI
}

function getPreloadCrash(): PreloadCrashAPI | null {
  try {
    const w = window as unknown as { electronAPI?: PreloadElectronAPI }
    return w.electronAPI?.crash ?? null
  } catch {
    return null
  }
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, message: '', stack: '', componentStack: '' }
  }

  static getDerivedStateFromError(err: unknown): State {
    return {
      hasError:       true,
      message:        err instanceof Error ? err.message : 'Unknown render error',
      stack:          err instanceof Error ? (err.stack ?? '') : '',
      componentStack: '',
    }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Capture component stack for display
    this.setState({ componentStack: info.componentStack ?? '' })
    reportBoundaryError(error)

    const payload = {
      source:  'renderer' as const,
      message: error.message,
      stack:   error.stack,
      meta:    { componentStack: info.componentStack ?? null },
    }

    const crash = getPreloadCrash()
    if (crash?.report) {
      crash.report(payload).catch(() => {
        // Last-resort: swallow — boundary must not throw inside catch
        // eslint-disable-next-line no-console
        console.error('[ErrorBoundary] failed to ship crash to main', error)
      })
    } else {
      // eslint-disable-next-line no-console
      console.error('[ErrorBoundary]', error, info.componentStack)
    }
  }

  private handleReload = (): void => {
    try { window.location.reload() } catch { /* ignore */ }
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, message: '', stack: '', componentStack: '' })
  }

  render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children

    return (
      <div
        role="alert"
        style={{
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          height:         '100vh',
          width:          '100vw',
          background:     '#08080f',
          color:          '#e2e8f0',
          fontFamily:     'system-ui, sans-serif',
          padding:        24,
          textAlign:      'center',
        }}
      >
        <div style={{
          maxWidth:    480,
          padding:     24,
          borderRadius: 12,
          background:  '#0c0c14',
          border:      '1px solid #1c1c2e',
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: '#e2e8f0' }}>Something went wrong</h2>
          <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12, wordBreak: 'break-word' }}>
            {this.state.message}
          </p>
          {(this.state.stack || this.state.componentStack) && (
            <pre style={{
              fontSize:    10,
              color:       '#64748b',
              background:  '#08080f',
              border:      '1px solid #1c1c2e',
              borderRadius: 6,
              padding:     '8px 10px',
              textAlign:   'left',
              overflowX:   'auto',
              maxHeight:   160,
              overflowY:   'auto',
              marginBottom: 16,
              whiteSpace:  'pre-wrap',
              wordBreak:   'break-all',
            }}>
              {this.state.stack || this.state.componentStack}
            </pre>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button
              onClick={this.handleReset}
              style={{
                padding:    '8px 14px',
                fontSize:   12,
                borderRadius: 8,
                background: 'rgba(124,58,237,0.15)',
                border:     '1px solid rgba(124,58,237,0.4)',
                color:      '#c4b5fd',
                cursor:     'pointer',
              }}
            >
              Reset
            </button>
            <button
              onClick={this.handleReload}
              style={{
                padding:    '8px 14px',
                fontSize:   12,
                borderRadius: 8,
                background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                border:     'none',
                color:      '#fff',
                cursor:     'pointer',
              }}
            >
              Reload
            </button>
          </div>
        </div>
      </div>
    )
  }
}
