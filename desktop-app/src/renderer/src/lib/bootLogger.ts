// ─── Boot Logger ──────────────────────────────────────────────────────────────
// Structured console output for the Electron renderer boot sequence.
// Only active in development (import.meta.env.DEV).

const BOOT_COLOR = '#7c3aed'
const OK_COLOR   = '#10b981'
const ERR_COLOR  = '#ef4444'
const WARN_COLOR = '#f59e0b'

const isDev = import.meta.env.DEV
let t0 = performance.now()

function elapsed(): string {
  return `+${(performance.now() - t0).toFixed(0)}ms`
}

export const bootLog = {
  start(label: string): void {
    if (!isDev) return
    t0 = performance.now()
    console.groupCollapsed(
      `%c[BOOT] %c${label}`,
      `color:${BOOT_COLOR};font-weight:700`,
      'color:#94a3b8',
    )
    console.log('%cElectron renderer boot sequence started', 'color:#64748b;font-size:11px')
    console.groupEnd()
  },

  step(label: string, detail?: string): void {
    if (!isDev) return
    console.log(
      `%c[BOOT] %c${elapsed()} %c${label}${detail ? ' — ' + detail : ''}`,
      `color:${BOOT_COLOR};font-weight:600`,
      'color:#334155',
      'color:#94a3b8',
    )
  },

  ok(label: string): void {
    if (!isDev) return
    console.log(
      `%c[BOOT] %c✓ %c${label} %c${elapsed()}`,
      `color:${BOOT_COLOR};font-weight:600`,
      `color:${OK_COLOR};font-weight:700`,
      'color:#e2e8f0',
      'color:#334155',
    )
  },

  warn(label: string, detail?: string): void {
    if (!isDev) return
    console.warn(
      `%c[BOOT] %c⚠ ${label}${detail ? ': ' + detail : ''}`,
      `color:${BOOT_COLOR};font-weight:600`,
      `color:${WARN_COLOR}`,
    )
  },

  error(label: string, err?: unknown): void {
    // Always log errors even in production
    console.error(
      `%c[BOOT] %c✕ ${label}`,
      `color:${BOOT_COLOR};font-weight:600`,
      `color:${ERR_COLOR}`,
      err ?? '',
    )
  },

  preload(available: boolean): void {
    if (!isDev) return
    if (available) {
      const api = (window as { electronAPI?: Record<string, unknown> }).electronAPI
      const keys = api ? Object.keys(api).length : 0
      bootLog.ok(`preload IPC ready — ${keys} methods`)
    } else {
      bootLog.warn('preload IPC not available (non-Electron context)')
    }
  },

  mount(componentName: string): void {
    if (!isDev) return
    console.log(
      `%c[MOUNT] %c${componentName} %c${elapsed()}`,
      `color:#06b6d4;font-weight:600`,
      'color:#e2e8f0',
      'color:#334155',
    )
  },
}
