// Production error reporter — captures unhandled exceptions and
// POSTs them to the backend's error collection endpoint.
// Only active in production builds (import.meta.env.PROD).

const REPORT_URL = (import.meta.env.VITE_API_URL ?? 'https://mixpiloteai-production.up.railway.app')
  + '/api/errors/report'

interface ErrorPayload {
  message:  string
  stack?:   string
  url:      string
  ua:       string
  ts:       number
  kind:     'uncaught' | 'unhandledRejection' | 'boundary'
}

function sendReport(payload: ErrorPayload): void {
  // Fire-and-forget — don't await, don't block the user
  try {
    navigator.sendBeacon(REPORT_URL, JSON.stringify(payload))
  } catch {
    // sendBeacon unavailable — silent fallback
    try {
      fetch(REPORT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {})
    } catch { /* ignore */ }
  }
}

function buildPayload(
  kind: ErrorPayload['kind'],
  error: Error | null,
  message?: string
): ErrorPayload {
  return {
    message: message ?? error?.message ?? 'Unknown error',
    stack:   error?.stack,
    url:     typeof window !== 'undefined' ? window.location.href : '',
    ua:      typeof navigator !== 'undefined' ? navigator.userAgent : '',
    ts:      Date.now(),
    kind,
  }
}

export function initErrorReporter(): void {
  if (!import.meta.env.PROD) return   // only in production builds

  window.addEventListener('error', (event) => {
    sendReport(buildPayload('uncaught', event.error as Error | null, event.message))
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    const err = reason instanceof Error ? reason : null
    const msg = typeof reason === 'string' ? reason : (err?.message ?? 'Unhandled rejection')
    sendReport(buildPayload('unhandledRejection', err, msg))
  })
}

// Export for manual boundary reporting
export function reportBoundaryError(error: Error): void {
  if (!import.meta.env.PROD) return
  sendReport(buildPayload('boundary', error))
}
