type Level = 'debug' | 'info' | 'warn' | 'error'

const IS_PROD = process.env.NODE_ENV === 'production'
const IS_TEST = process.env.NODE_ENV === 'test'

function log(level: Level, message: string, meta?: Record<string, unknown>): void {
  if (IS_TEST) return

  const entry = {
    ts:  new Date().toISOString(),
    level,
    msg: message,
    ...(meta ?? {}),
  }

  if (IS_PROD) {
    // Structured JSON in production (for log aggregators)
    const output = JSON.stringify(entry)
    if (level === 'error' || level === 'warn') {
      process.stderr.write(output + '\n')
    } else {
      process.stdout.write(output + '\n')
    }
  } else {
    // Human-readable in development
    const prefix = { debug: '🔍', info: 'ℹ️ ', warn: '⚠️ ', error: '❌' }[level]
    const metaStr = meta ? ' ' + JSON.stringify(meta) : ''
    console[level === 'debug' ? 'log' : level](`[${entry.ts}] ${prefix} ${message}${metaStr}`)
  }
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => { if (!IS_PROD) log('debug', msg, meta) },
  info:  (msg: string, meta?: Record<string, unknown>) => log('info',  msg, meta),
  warn:  (msg: string, meta?: Record<string, unknown>) => log('warn',  msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log('error', msg, meta),
}
