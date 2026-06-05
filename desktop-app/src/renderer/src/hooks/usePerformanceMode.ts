// ─── usePerformanceMode ───────────────────────────────────────────────────────
// Applies performance-mode settings to the audio subsystems whenever the mode
// changes and polls CPU/RAM stats every 2 seconds.

import { useEffect, useRef } from 'react'
import { usePerformanceStore, MODE_CONFIGS } from '../store/performanceStore'
import { memoryManager }  from '../audio/MemoryManager'
import { streamingEngine } from '../audio/StreamingEngine'
import { getWorkerPool }   from '../audio/WorkerPool'
import { pruneCache }      from '../audio/SmartCache'
import { freezeEngine }    from '../audio/FreezeEngine'

const POLL_MS = 2_000

export function usePerformanceMode(): void {
  const { config, setStats } = usePerformanceStore()
  const autoFreezeRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Apply config whenever mode changes
  useEffect(() => {
    memoryManager.setBudgetMB(config.maxRamMB)
    streamingEngine.setChunkSec(config.streamChunkSec)
    getWorkerPool().resize(config.workerCount)
    pruneCache()
  }, [config])

  // Auto-freeze logic (polls project store externally via Zustand outside hook)
  useEffect(() => {
    if (autoFreezeRef.current) clearInterval(autoFreezeRef.current)
    if (!config.autoFreeze) return
    autoFreezeRef.current = setInterval(() => {
      // Auto-freeze is signalled via performanceStore stats — actual freeze
      // is triggered by components that have access to track state.
      const stats = memoryManager.stats()
      usePerformanceStore.getState().setStats({
        ramMB:         stats.usedMB,
        cachedBuffers: stats.entries,
        cacheUsedMB:   stats.usedMB,
        frozenTracks:  freezeEngine.getFrozenList().length,
      })
    }, config.autoFreezeAfterSec * 1000)
    return () => { if (autoFreezeRef.current) clearInterval(autoFreezeRef.current) }
  }, [config.autoFreeze, config.autoFreezeAfterSec])

  // Fast stats poll
  useEffect(() => {
    const id = setInterval(() => {
      const mem = memoryManager.stats()
      setStats({
        ramMB:         mem.usedMB,
        cachedBuffers: mem.entries,
        cacheUsedMB:   mem.usedMB,
        frozenTracks:  freezeEngine.getFrozenList().length,
      })
    }, POLL_MS)
    return () => clearInterval(id)
  }, [setStats])
}

// ── One-shot helper: apply saved mode on app boot ─────────────────────────────
export function applyBootMode(): void {
  const saved = usePerformanceStore.getState().mode
  const config = MODE_CONFIGS[saved]
  memoryManager.setBudgetMB(config.maxRamMB)
  streamingEngine.setChunkSec(config.streamChunkSec)
  getWorkerPool(config.workerCount)
}
