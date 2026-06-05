// ── logger.ts ─────────────────────────────────────────────────────────────────
// Structured logger for the Electron main process.
// Wraps console.* with level control and feeds into DiagnosticLogger when available.
//
// Usage:
//   import { logger } from './logger'
//   const log = logger('vst-host')
//   log.info('plugin loaded', { path, instanceId })
//   log.warn('high latency', { ms: 42 })
//   log.error('crash', err)

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

type LogData = Record<string, unknown> | Error | string | number | undefined

// In production builds the DiagnosticLogger is available; in unit tests it is not.
// We lazy-import to avoid circular deps and to tolerate test environments.
function tryGetDiagnosticLogger() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('./DiagnosticLogger') as typeof import('./DiagnosticLogger')
    return mod.getDiagnosticLogger?.() ?? null
  } catch {
    return null
  }
}

// Global log level — can be overridden by LOG_LEVEL env var at startup
const ENV_LEVEL = (process.env['LOG_LEVEL'] ?? 'info') as LogLevel
const LEVEL_ORDER: LogLevel[] = ['debug', 'info', 'warn', 'error', 'fatal']

function levelIndex(l: LogLevel): number {
  return LEVEL_ORDER.indexOf(l)
}

let _globalLevel: LogLevel = ENV_LEVEL

export function setLogLevel(level: LogLevel): void {
  _globalLevel = level
}

export function getLogLevel(): LogLevel {
  return _globalLevel
}

function shouldLog(level: LogLevel): boolean {
  return levelIndex(level) >= levelIndex(_globalLevel)
}

function formatData(data: LogData): string {
  if (data === undefined) return ''
  if (data instanceof Error) return ` — ${data.message}${data.stack ? `\n${data.stack}` : ''}`
  if (typeof data === 'string' || typeof data === 'number') return ` — ${data}`
  try { return ` — ${JSON.stringify(data)}` } catch { return '' }
}

function emit(level: LogLevel, category: string, msg: string, data: LogData): void {
  if (!shouldLog(level)) return

  const ts = new Date().toISOString()
  const line = `[${ts}] [${level.toUpperCase().padEnd(5)}] [${category}] ${msg}${formatData(data)}`

  switch (level) {
    case 'debug': console.debug(line); break
    case 'info':  console.log(line);   break
    case 'warn':  console.warn(line);  break
    case 'error':
    case 'fatal': console.error(line); break
  }

  // Forward to DiagnosticLogger file sink (best-effort)
  const diagLogger = tryGetDiagnosticLogger()
  if (diagLogger) {
    const record: Record<string, unknown> = typeof data === 'object' && data !== null && !(data instanceof Error)
      ? data as Record<string, unknown>
      : { raw: data instanceof Error ? data.message : data }
    void diagLogger.log(level, category, msg, record).catch(() => undefined)
  }
}

export interface Logger {
  debug(msg: string, data?: LogData): void
  info(msg: string, data?: LogData): void
  warn(msg: string, data?: LogData): void
  error(msg: string, data?: LogData): void
  fatal(msg: string, data?: LogData): void
  child(subCategory: string): Logger
}

export function logger(category: string): Logger {
  return {
    debug: (msg, data) => emit('debug', category, msg, data),
    info:  (msg, data) => emit('info',  category, msg, data),
    warn:  (msg, data) => emit('warn',  category, msg, data),
    error: (msg, data) => emit('error', category, msg, data),
    fatal: (msg, data) => emit('fatal', category, msg, data),
    child: (sub) => logger(`${category}:${sub}`),
  }
}

// Convenience: main-process root logger
export const log = logger('main')
