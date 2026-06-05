// ── VST Crash Guard ────────────────────────────────────────────────────────────
// Tracks plugin crashes and decides whether to restart, disable, or blacklist.

export interface CrashRecord {
  pluginId: string
  crashCount: number
  lastCrashTime: number
  blacklisted: boolean
}

export type CrashAction = 'restart' | 'blacklist' | 'disable'

const BLACKLIST_THRESHOLD = 3
const BLACKLIST_WINDOW_MS = 60_000

export class VstCrashGuard {
  private records: Map<string, CrashRecord> = new Map()

  recordCrash(pluginId: string): CrashAction {
    const now = Date.now()
    let record = this.records.get(pluginId)

    if (!record) {
      record = { pluginId, crashCount: 0, lastCrashTime: now, blacklisted: false }
      this.records.set(pluginId, record)
    }

    // Reset crash count if outside the window
    if (now - record.lastCrashTime > BLACKLIST_WINDOW_MS) {
      record.crashCount = 0
    }

    record.crashCount++
    record.lastCrashTime = now

    if (record.crashCount >= BLACKLIST_THRESHOLD) {
      record.blacklisted = true
      return 'blacklist'
    } else if (record.crashCount >= 2) {
      return 'disable'
    } else {
      return 'restart'
    }
  }

  isBlacklisted(pluginId: string): boolean {
    return this.records.get(pluginId)?.blacklisted ?? false
  }

  resetCrashCount(pluginId: string): void {
    const record = this.records.get(pluginId)
    if (record) {
      record.crashCount = 0
      record.blacklisted = false
    }
  }

  getReport(): CrashRecord[] {
    return Array.from(this.records.values())
  }
}
