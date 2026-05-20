// ─── Plugin Crash Recovery ────────────────────────────────────────────────────
// Automatic recovery when a plugin instance crashes
//
// Features:
// - Auto-restart of crashed plugin instances (configurable retry count)
// - State preservation: parameters restored after restart
// - Hot reload: reload plugin without losing project state
// - Crash escalation: auto-blacklist after repeated failures

import { EventEmitter } from 'events'
import { pluginHostManager, type PluginInstance } from './pluginHost'
import { recordCrash, isBlacklisted } from './pluginBlacklist'
import { pluginHealthMonitor } from './pluginHealth'
import { logCrash } from './errorReporter'

const MAX_AUTO_RESTART = 2     // Try restart at most 2 times before giving up
const RESTART_DELAY_MS = 2_000 // Wait 2s before attempting restart

interface SavedState {
  instanceId:  string
  pluginPath:  string
  format:      string
  parameters:  Record<string, number>
  trackId?:    string
  /** Number of restart attempts so far */
  restartCount: number
  lastCrashAt: number
}

export class PluginRecovery extends EventEmitter {
  /** instanceId → saved state for restoration after crash */
  private savedStates: Map<string, SavedState> = new Map()
  /** Maps old instanceId to the new instance after recovery */
  private recoveryMap: Map<string, string> = new Map()

  init(): void {
    // Listen for plugin crashes
    pluginHostManager.on('plugin-crash', (info: unknown) => {
      this._handleCrash(info as {
        instanceId?: string
        pluginPath?: string
        pluginName?: string
        crashCount?: number
      })
    })

    pluginHealthMonitor.on('plugin-resource-warning', (info) => {
      console.warn(`[plugin-recovery] resource warning: ${JSON.stringify(info)}`)
      // Could escalate to forced restart if resources critical
    })

    console.log('[plugin-recovery] initialized')
  }

  /**
   * Save plugin state for potential recovery.
   * Call this whenever parameters change (debounced).
   */
  saveState(instanceId: string, state: Omit<SavedState, 'restartCount' | 'lastCrashAt'>): void {
    const existing = this.savedStates.get(instanceId)
    this.savedStates.set(instanceId, {
      ...state,
      restartCount: existing?.restartCount ?? 0,
      lastCrashAt:  existing?.lastCrashAt  ?? 0,
    })
  }

  /**
   * Clear saved state (call on intentional unload).
   */
  clearState(instanceId: string): void {
    this.savedStates.delete(instanceId)
    this.recoveryMap.delete(instanceId)
  }

  /**
   * Hot reload: unload and reload a plugin while preserving its state.
   * Used after plugin file changes (development/update).
   */
  async hotReload(instanceId: string): Promise<{ ok: boolean; newInstanceId?: string; error?: string }> {
    const state = this.savedStates.get(instanceId)
    if (!state) return { ok: false, error: 'no saved state' }

    try {
      // Unload existing
      await pluginHostManager.unload(instanceId)

      // Wait briefly for cleanup
      await new Promise(r => setTimeout(r, 500))

      // Reload
      const newInstance = await pluginHostManager.load(state.pluginPath, state.format)
      pluginHealthMonitor.register(
        newInstance.instanceId,
        state.pluginPath,
        newInstance.name,
        // @ts-expect-error access proc from manager
        pluginHostManager['procs'].get(newInstance.instanceId)?.proc,
      )

      // Map old → new for callers that still hold the old ID
      this.recoveryMap.set(instanceId, newInstance.instanceId)

      // Save state under new ID
      this.savedStates.set(newInstance.instanceId, {
        ...state,
        instanceId:  newInstance.instanceId,
        restartCount: 0,
        lastCrashAt:  0,
      })
      this.savedStates.delete(instanceId)

      this.emit('plugin-reloaded', {
        oldInstanceId: instanceId,
        newInstanceId: newInstance.instanceId,
        parameters:    state.parameters,
      })

      return { ok: true, newInstanceId: newInstance.instanceId }
    } catch (err) {
      const msg = (err as Error).message
      console.error('[plugin-recovery] hot reload failed:', msg)
      return { ok: false, error: msg }
    }
  }

  /**
   * Get the new instance ID after a recovery (if any).
   */
  getRecoveredId(oldInstanceId: string): string | null {
    return this.recoveryMap.get(oldInstanceId) ?? null
  }

  /**
   * Get all saved states (for debugging/UI).
   */
  getSavedStates(): SavedState[] {
    return Array.from(this.savedStates.values())
  }

  private async _handleCrash(info: {
    instanceId?: string
    pluginPath?: string
    pluginName?: string
    crashCount?: number
  }): Promise<void> {
    const { instanceId, pluginPath, pluginName, crashCount } = info
    if (!instanceId || !pluginPath) return

    const state = this.savedStates.get(instanceId)
    if (!state) {
      console.log(`[plugin-recovery] no saved state for ${instanceId}, skipping recovery`)
      pluginHealthMonitor.unregister(instanceId)
      return
    }

    // Check if already blacklisted
    if (isBlacklisted(pluginPath)) {
      console.log(`[plugin-recovery] ${pluginName} is blacklisted, no recovery`)
      this.emit('plugin-recovery-abandoned', { instanceId, reason: 'blacklisted' })
      pluginHealthMonitor.unregister(instanceId)
      return
    }

    // Check if max restart attempts exceeded
    if (state.restartCount >= MAX_AUTO_RESTART) {
      console.log(`[plugin-recovery] max retries (${MAX_AUTO_RESTART}) exceeded for ${pluginName}`)
      this.emit('plugin-recovery-abandoned', { instanceId, reason: 'max-retries' })
      pluginHealthMonitor.unregister(instanceId)
      void logCrash({
        source:  'plugin',
        message: `Plugin recovery abandoned: ${pluginName} (max retries)`,
        meta:    { kind: 'plugin-recovery-abandoned', pluginPath, crashCount },
      }).catch(() => { /* ignore */ })
      return
    }

    // Increment retry counter
    state.restartCount++
    state.lastCrashAt = Date.now()

    console.log(`[plugin-recovery] attempting restart for ${pluginName} (attempt ${state.restartCount}/${MAX_AUTO_RESTART})`)

    // Wait for backoff
    await new Promise(r => setTimeout(r, RESTART_DELAY_MS))

    try {
      const newInstance = await pluginHostManager.load(state.pluginPath, state.format)

      // Register with health monitor
      // @ts-expect-error access proc from manager
      const proc = pluginHostManager['procs'].get(newInstance.instanceId)?.proc
      if (proc) {
        pluginHealthMonitor.register(newInstance.instanceId, state.pluginPath, newInstance.name, proc)
      }

      this.recoveryMap.set(instanceId, newInstance.instanceId)
      this.savedStates.set(newInstance.instanceId, {
        ...state,
        instanceId: newInstance.instanceId,
      })
      this.savedStates.delete(instanceId)

      this.emit('plugin-recovered', {
        oldInstanceId: instanceId,
        newInstanceId: newInstance.instanceId,
        pluginName,
        parameters:    state.parameters,
        attempt:       state.restartCount,
      })

      console.log(`[plugin-recovery] ${pluginName} recovered as ${newInstance.instanceId}`)
    } catch (err) {
      const msg = (err as Error).message
      console.error(`[plugin-recovery] restart failed for ${pluginName}:`, msg)

      // Record crash to escalate blacklisting if persistent
      const result = recordCrash(pluginPath, pluginName ?? '', `recovery failed: ${msg}`)

      this.emit('plugin-recovery-failed', {
        instanceId,
        pluginPath,
        pluginName,
        error: msg,
        blacklisted: result.blacklisted,
      })
    }
  }
}

export const pluginRecovery = new PluginRecovery()
