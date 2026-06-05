// Renderer-side error reporter.
// In production builds, captures unhandled JS errors and posts them
// to the backend error collection endpoint.
// Uses direct fetch (renderer has network access in Electron).

const BACKEND_URL = 'https://mixpiloteai-production.up.railway.app'
const REPORT_URL  = `${BACKEND_URL}/api/errors/report`

interface ErrorPayload {
  message: string
  stack?:  string
  kind:    'uncaught' | 'unhandledRejection' | 'boundary'
  ts:      number
  context: 'electron-renderer'
}

function send(payload: ErrorPayload): void {
  // Fire-and-forget — must not throw
  try {
    fetch(REPORT_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {})
  } catch { /* ignore */ }
}

// Only active in packaged builds (app.isPackaged equivalent via import.meta.env)
const isProd = import.meta.env.PROD

export function initRendererErrorReporter(): void {
  if (!isProd) return

  window.addEventListener('error', (e) => {
    const err = e.error as Error | null
    send({
      message: err?.message ?? e.message,
      stack:   err?.stack,
      kind:    'uncaught',
      ts:      Date.now(),
      context: 'electron-renderer',
    })
  })

  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason
    const err = reason instanceof Error ? reason : null
    send({
      message: err?.message ?? String(reason),
      stack:   err?.stack,
      kind:    'unhandledRejection',
      ts:      Date.now(),
      context: 'electron-renderer',
    })
  })
}

export function reportBoundaryError(error: Error): void {
  if (!isProd) return
  send({
    message: error.message,
    stack:   error.stack,
    kind:    'boundary',
    ts:      Date.now(),
    context: 'electron-renderer',
  })
}
