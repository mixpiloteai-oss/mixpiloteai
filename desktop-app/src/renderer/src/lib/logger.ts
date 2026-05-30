const IS_DEV = import.meta.env.DEV === true

type Level = 'debug' | 'info' | 'warn' | 'error'

function log(level: Level, ...args: unknown[]): void {
  if (!IS_DEV && (level === 'debug' || level === 'info')) return
  // eslint-disable-next-line no-console
  console[level](`[NeuroTek:${level.toUpperCase()}]`, ...args)
}

export const logger = {
  debug: (...args: unknown[]) => log('debug', ...args),
  info:  (...args: unknown[]) => log('info',  ...args),
  warn:  (...args: unknown[]) => log('warn',  ...args),
  error: (...args: unknown[]) => log('error', ...args),
}
