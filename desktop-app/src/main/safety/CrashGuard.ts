/**
 * CrashGuard — detects whether the app crashed on previous launch.
 *
 * Uses a "dirty" sentinel file in userData dir: 'crash-guard.lock'.
 * If the file exists at startup, the previous session ended abnormally.
 */

import { promises as fs } from 'fs'
import { join } from 'path'

export class CrashGuard {
  private readonly lockPath: string
  private _hasCrashed = false

  constructor(userDataPath: string) {
    this.lockPath = join(userDataPath, 'crash-guard.lock')
  }

  /**
   * Checks for the lock file and writes a new one.
   * Must be called early in app startup.
   */
  async initialize(): Promise<void> {
    try {
      await fs.access(this.lockPath)
      // File exists → previous session was dirty
      this._hasCrashed = true
    } catch {
      // File does not exist → clean start
      this._hasCrashed = false
    }

    // Write the lock file so the current session is marked dirty
    await fs.writeFile(this.lockPath, String(Date.now()), 'utf8')
  }

  /**
   * Deletes the lock file, signalling a clean shutdown.
   */
  async markClean(): Promise<void> {
    try {
      await fs.unlink(this.lockPath)
    } catch {
      // Ignore — file may already be gone
    }
  }

  get hasCrashed(): boolean {
    return this._hasCrashed
  }
}
