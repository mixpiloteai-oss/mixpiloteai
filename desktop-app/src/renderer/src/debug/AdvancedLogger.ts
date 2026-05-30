export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  level:     LogLevel
  message:   string
  context?:  Record<string, unknown>
  timestamp: number
}

export class AdvancedLogger {
  private entries:    LogEntry[]
  private maxEntries: number
  onEntry?:   (e: LogEntry) => void

  constructor(opts?: { maxEntries?: number; onEntry?: (e: LogEntry) => void }) {
    this.maxEntries = opts?.maxEntries ?? 500
    this.onEntry    = opts?.onEntry
    this.entries    = []
  }

  log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    const entry: LogEntry = { level, message, context, timestamp: Date.now() }
    if (this.entries.length >= this.maxEntries) this.entries.shift()
    this.entries.push(entry)
    this.onEntry?.(entry)

    if (level === 'error' && typeof window !== 'undefined' && window.electronAPI) {
      // Report crash info to main process if available
      const api = window.electronAPI as Record<string, unknown>
      if (typeof api['crash'] === 'object' && api['crash'] !== null) {
        const crash = api['crash'] as Record<string, unknown>
        if (typeof crash['report'] === 'function') {
          (crash['report'] as (m: string) => void)(message)
        }
      }
    }
  }

  debug(message: string, context?: Record<string, unknown>): void { this.log('debug', message, context) }
  info (message: string, context?: Record<string, unknown>): void { this.log('info',  message, context) }
  warn (message: string, context?: Record<string, unknown>): void { this.log('warn',  message, context) }
  error(message: string, context?: Record<string, unknown>): void { this.log('error', message, context) }

  getEntries(opts?: { level?: LogLevel; limit?: number }): LogEntry[] {
    let result = opts?.level ? this.entries.filter(e => e.level === opts.level) : [...this.entries]
    if (opts?.limit !== undefined) result = result.slice(-opts.limit)
    return result
  }

  clear(): void { this.entries = [] }

  export(): string {
    return this.entries.map(e => JSON.stringify(e)).join('\n')
  }
}

export const logger = new AdvancedLogger()
