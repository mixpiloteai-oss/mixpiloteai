// ─── UserIntentTracker.ts ─────────────────────────────────────────────────────
// Tracks user command history and revealed preferences.

export interface IntentRecord {
  command: string
  intent: string
  timestamp: number
  accepted: boolean
}

class UserIntentTracker {
  static readonly MAX_HISTORY = 50

  private history: IntentRecord[] = []

  /**
   * Record a command and its parsed intent.
   */
  recordCommand(cmd: string, intent: string): void {
    const record: IntentRecord = {
      command: cmd,
      intent,
      timestamp: Date.now(),
      accepted: false,
    }
    this.history.push(record)
    // Enforce max history
    if (this.history.length > UserIntentTracker.MAX_HISTORY) {
      this.history = this.history.slice(-UserIntentTracker.MAX_HISTORY)
    }
  }

  /**
   * Mark the most recent command matching cmd as accepted.
   */
  recordAccepted(cmd: string): void {
    // Find last matching command (search from end)
    for (let i = this.history.length - 1; i >= 0; i--) {
      if (this.history[i]!.command === cmd) {
        this.history[i]!.accepted = true
        break
      }
    }
  }

  /**
   * Get the n most recent intent records.
   */
  getRecentIntents(n: number): IntentRecord[] {
    return this.history.slice(-n)
  }

  /**
   * Get a list of the most common accepted intents.
   */
  getPreferredStyles(): string[] {
    const intentCounts = new Map<string, number>()
    for (const record of this.history) {
      if (record.accepted) {
        intentCounts.set(record.intent, (intentCounts.get(record.intent) ?? 0) + 1)
      }
    }

    return Array.from(intentCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([intent]) => intent)
  }

  /**
   * Build a context string summarizing user preferences.
   */
  getContextString(): string {
    const preferred = this.getPreferredStyles()
    const recent = this.getRecentIntents(3).map(r => r.intent)

    const parts: string[] = []
    if (preferred.length > 0) {
      parts.push(`User prefers: ${preferred.slice(0, 3).join(', ')}`)
    }
    if (recent.length > 0) {
      parts.push(`Recently asked for: ${recent.join(', ')}`)
    }

    return parts.length > 0 ? parts.join('. ') + '.' : 'No preferences recorded yet.'
  }
}

export const userIntentTracker = new UserIntentTracker()
