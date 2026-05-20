// Detects repeated crash-on-startup and offers recovery options.
// Uses a simple counter file in userData. If the app starts 3+ times
// without staying open for at least 30 seconds, it considers the previous
// launch a crash-on-startup and increments the counter.
import { app, dialog, shell } from 'electron'
import path from 'node:path'
import fs from 'node:fs'

const GUARD_FILE = () => path.join(app.getPath('userData'), 'startup-guard.json')
const STABLE_AFTER_MS = 30_000
const MAX_CRASH_STARTS = 3

interface GuardData { count: number; lastAt: number; afterUpdate?: boolean }

export function markUpdatePending(): void {
  const file = GUARD_FILE()
  try {
    let data: GuardData = { count: 0, lastAt: 0 }
    if (fs.existsSync(file)) {
      data = JSON.parse(fs.readFileSync(file, 'utf8')) as GuardData
    }
    data.afterUpdate = true
    fs.writeFileSync(file, JSON.stringify(data), 'utf8')
  } catch { /* ignore */ }
}

export function initStartupGuard(onRollback?: () => void): void {
  const file = GUARD_FILE()
  let data: GuardData = { count: 0, lastAt: 0 }

  try {
    if (fs.existsSync(file)) {
      data = JSON.parse(fs.readFileSync(file, 'utf8')) as GuardData
    }
  } catch { data = { count: 0, lastAt: 0 } }

  data.count += 1
  data.lastAt = Date.now()
  fs.writeFileSync(file, JSON.stringify(data), 'utf8')

  if (data.count >= MAX_CRASH_STARTS) {
    // Show recovery dialog before the main window appears
    const isAfterUpdate = data.afterUpdate === true
    const baseButtons = ['Reset Settings', 'Reinstall', 'Continue Anyway']
    const buttons = isAfterUpdate ? [...baseButtons, 'Rollback Update'] : baseButtons
    const choice = dialog.showMessageBoxSync({
      type: 'warning',
      title: 'Neurotek Studio -- Recovery',
      message: isAfterUpdate
        ? `Neurotek Studio crashed ${data.count} times during startup after a recent update.`
        : `Neurotek Studio crashed ${data.count} times during startup.`,
      detail: 'Would you like to reset settings to defaults, or open the downloads page to reinstall?',
      buttons,
      defaultId: 0,
      cancelId: 2,
    })
    if (choice === 0) {
      try {
        const userData = app.getPath('userData')
        // Remove config files but keep projects
        ;['config.json', 'startup-guard.json', 'plugin-blacklist.json'].forEach(f => {
          const p = path.join(userData, f)
          if (fs.existsSync(p)) fs.unlinkSync(p)
        })
      } catch { /* ignore */ }
    } else if (choice === 1) {
      shell.openExternal('https://mixpiloteai.com/download')
      app.quit()
      return
    } else if (choice === 3 && isAfterUpdate && onRollback) {
      onRollback()
      return
    }
    // Reset counter after showing dialog
    fs.writeFileSync(file, JSON.stringify({ count: 0, lastAt: Date.now() }), 'utf8')
  }

  // Mark as stable after STABLE_AFTER_MS
  setTimeout(() => {
    try { fs.writeFileSync(file, JSON.stringify({ count: 0, lastAt: Date.now() }), 'utf8') } catch { /* ignore */ }
  }, STABLE_AFTER_MS)
}
