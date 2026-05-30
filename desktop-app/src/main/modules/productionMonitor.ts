// Periodic resource monitoring for the main Electron process.
// Logs to console (which is captured by the OS in packaged builds).
// Only runs when the app is packaged (production).

import { app } from 'electron'

const INTERVAL_MS = 5 * 60 * 1000   // every 5 minutes

let _interval: ReturnType<typeof setInterval> | null = null

export function startProductionMonitor(): void {
  if (!app.isPackaged) return   // dev only needs console, not periodic logs

  _interval = setInterval(() => {
    const mem  = process.memoryUsage()
    const cpu  = process.cpuUsage()
    console.info(JSON.stringify({
      ts:        new Date().toISOString(),
      kind:      'perf-sample',
      heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
      rssMB:      Math.round(mem.rss      / 1024 / 1024),
      cpuUser:   cpu.user,
      cpuSys:    cpu.system,
    }))
  }, INTERVAL_MS)

  // Allow Node.js to exit even if interval is pending
  if (_interval.unref) _interval.unref()
}

export function stopProductionMonitor(): void {
  if (_interval !== null) {
    clearInterval(_interval)
    _interval = null
  }
}
