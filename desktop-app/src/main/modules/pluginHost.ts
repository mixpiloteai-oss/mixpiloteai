// ─── Plugin Host Manager ──────────────────────────────────────────────────────
// Each loaded plugin runs in its own isolated child process.
// A plugin crash kills only that child — the main process and DAW keep running.
//
// Architecture:
//   [Main Process]
//     ├─ PluginHostProcess #1  (e.g. Serum → isolated crash domain)
//     ├─ PluginHostProcess #2  (e.g. Pro-Q 3)
//     └─ PluginHostProcess #n

import { fork, type ChildProcess } from 'child_process'
import { join } from 'path'
import { EventEmitter } from 'events'
import { recordCrash, isBlacklisted } from './pluginBlacklist'

const LOAD_TIMEOUT_MS  = 10_000   // 10s to load a plugin
const UNLOAD_GRACE_MS  = 3_000    // 3s graceful unload before SIGKILL

export interface PluginInstance {
  instanceId:     string
  pluginPath:     string
  format:         string
  name:           string
  vendor:         string
  paramCount:     number
  latencySamples: number
  pid:            number | undefined
}

type HostReply =
  | { type: 'loaded';          instanceId: string; name: string; vendor: string; paramCount: number; latencySamples: number }
  | { type: 'unloaded';        instanceId: string }
  | { type: 'audio-output';    instanceId: string; samples: number[]; rms: number; peak: number }
  | { type: 'parameter-value'; instanceId: string; paramId: number; value: number }
  | { type: 'instances';       instances: unknown[] }
  | { type: 'pong' }
  | { type: 'ready' }
  | { type: 'error';           instanceId?: string; message: string }
  | { type: 'engine-event';    event: unknown }

class PluginHostManager extends EventEmitter {
  /** instanceId → { process, metadata } */
  private procs = new Map<string, { proc: ChildProcess; meta: PluginInstance }>()
  /** pending load resolvers keyed by instanceId */
  private pending = new Map<string, { resolve: (m: PluginInstance) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }>()

  // ── Load ─────────────────────────────────────────────────────────────────

  async load(pluginPath: string, format: string): Promise<PluginInstance> {
    if (isBlacklisted(pluginPath)) {
      throw new Error(`Plugin is blacklisted: ${pluginPath}`)
    }

    const instanceId = `plug-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

    // Spawn isolated child
    const hostScript = join(__dirname, 'plugin-host', 'index.js')
    const proc = fork(hostScript, [], {
      silent: false,
      // Kill-on-parent-exit: child is in a job object on Windows,
      // on POSIX we use detached:false (default) so SIGHUP kills it.
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      env: {
        ...process.env,
        PLUGIN_HOST: '1',
        // Restrict capabilities on Linux via env hints (native sandbox reads these)
        NEUROTEK_SANDBOX: '1',
      },
    })

    return new Promise<PluginInstance>((resolve, reject) => {
      // Timeout guard
      const timer = setTimeout(() => {
        this.pending.delete(instanceId)
        proc.kill('SIGKILL')
        const res = recordCrash(pluginPath, pluginPath.split(/[\\/]/).pop() ?? '', 'load timeout')
        this.emit('plugin-crash', { instanceId, pluginPath, ...res })
        reject(new Error(`Plugin load timeout: ${pluginPath}`))
      }, LOAD_TIMEOUT_MS)

      this.pending.set(instanceId, { resolve, reject, timer })

      proc.on('message', (msg: HostReply) => {
        if (msg.type === 'ready') {
          // Process started; now send load command
          proc.send({ type: 'load', instanceId, pluginPath, format })
          return
        }
        if (msg.type === 'loaded' && msg.instanceId === instanceId) {
          const p = this.pending.get(instanceId)
          if (!p) return
          clearTimeout(p.timer)
          this.pending.delete(instanceId)
          const meta: PluginInstance = {
            instanceId, pluginPath, format,
            name: msg.name, vendor: msg.vendor, paramCount: msg.paramCount,
            latencySamples: msg.latencySamples ?? 0,
            pid: proc.pid,
          }
          this.procs.set(instanceId, { proc, meta })
          p.resolve(meta)
          return
        }
        if (msg.type === 'error') {
          const p = this.pending.get(instanceId)
          if (p) { clearTimeout(p.timer); this.pending.delete(instanceId); p.reject(new Error(msg.message)) }
        }
      })

      proc.on('exit', (code, signal) => {
        this.procs.delete(instanceId)
        const p = this.pending.get(instanceId)
        if (p) {
          clearTimeout(p.timer)
          this.pending.delete(instanceId)
          p.reject(new Error(`Plugin process exited (code ${code} signal ${signal})`))
        }
        if (code !== 0 && code !== null) {
          const pluginName = pluginPath.split(/[\\/]/).pop() ?? ''
          const res = recordCrash(pluginPath, pluginName, `exit code ${code}`)
          this.emit('plugin-crash', { instanceId, pluginPath, pluginName, ...res })
        }
      })

      proc.on('error', (err) => {
        const p = this.pending.get(instanceId)
        if (p) { clearTimeout(p.timer); this.pending.delete(instanceId); p.reject(err) }
      })
    })
  }

  // ── Unload ────────────────────────────────────────────────────────────────

  async unload(instanceId: string): Promise<void> {
    const entry = this.procs.get(instanceId)
    if (!entry) return

    entry.proc.send({ type: 'unload', instanceId })

    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => { entry.proc.kill('SIGKILL'); resolve() }, UNLOAD_GRACE_MS)
      entry.proc.once('exit', () => { clearTimeout(timer); resolve() })
      entry.proc.once('message', (msg: HostReply) => {
        if (msg.type === 'unloaded' && msg.instanceId === instanceId) {
          clearTimeout(timer)
          entry.proc.kill('SIGTERM')
          resolve()
        }
      })
    })
    this.procs.delete(instanceId)
  }

  // ── Parameter control ─────────────────────────────────────────────────────

  setParameter(instanceId: string, paramId: number, value: number): Promise<void> {
    return this._sendToInstance(instanceId, { type: 'set-parameter', instanceId, paramId, value })
  }

  getParameter(instanceId: string, paramId: number): Promise<number> {
    const entry = this.procs.get(instanceId)
    if (!entry) return Promise.reject(new Error(`Instance not found: ${instanceId}`))
    return new Promise<number>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('get-parameter timeout')), 5_000)
      const listener = (msg: HostReply) => {
        if (msg.type === 'parameter-value' && msg.instanceId === instanceId && msg.paramId === paramId) {
          clearTimeout(timer)
          entry.proc.removeListener('message', listener)
          resolve(msg.value)
        }
      }
      entry.proc.on('message', listener)
      entry.proc.send({ type: 'get-parameter', instanceId, paramId })
    })
  }

  processAudio(
    instanceId: string,
    inputSamples: number[],
    numSamples: number,
    channels: number,
  ): Promise<number[]> {
    const entry = this.procs.get(instanceId)
    if (!entry) return Promise.reject(new Error(`Instance not found: ${instanceId}`))
    return new Promise<number[]>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('process-audio timeout')), 5_000)
      const listener = (msg: HostReply) => {
        if (msg.type === 'audio-output' && msg.instanceId === instanceId) {
          clearTimeout(timer)
          entry.proc.removeListener('message', listener)
          resolve(msg.samples)
        }
      }
      entry.proc.on('message', listener)
      entry.proc.send({ type: 'process-audio', instanceId, inputSamples, numSamples, channels })
    })
  }

  sendMidi(
    instanceId: string,
    eventType: string,
    channel: number,
    note: number,
    velocity: number,
    control: number,
    value: number,
    pitchBend: number,
    sampleOffset: number,
  ): Promise<void> {
    return this._sendToInstance(instanceId, {
      type: 'send-midi',
      instanceId, eventType, channel, note, velocity, control, value, pitchBend, sampleOffset,
    })
  }

  addToChain(instanceId: string, trackId: string): Promise<void> {
    return this._sendToInstance(instanceId, { type: 'add-to-chain', instanceId, trackId })
  }

  removeFromChain(instanceId: string, trackId: string): Promise<void> {
    return this._sendToInstance(instanceId, { type: 'remove-from-chain', instanceId, trackId })
  }

  addAutomationPoint(
    instanceId: string,
    paramId: number,
    bar: number,
    beat: number,
    tick: number,
    value: number,
    curve: number,
  ): Promise<void> {
    return this._sendToInstance(instanceId, {
      type: 'add-automation',
      instanceId, paramId, bar, beat, tick, value, curve,
    })
  }

  private _sendToInstance(instanceId: string, msg: object): Promise<void> {
    const entry = this.procs.get(instanceId)
    if (!entry) return Promise.reject(new Error(`Instance not found: ${instanceId}`))
    entry.proc.send(msg)
    return Promise.resolve()
  }

  // ── Accessors ─────────────────────────────────────────────────────────────

  getInstance(instanceId: string): PluginInstance | null {
    return this.procs.get(instanceId)?.meta ?? null
  }

  getAllInstances(): PluginInstance[] {
    return [...this.procs.values()].map(e => e.meta)
  }

  killAll(): void {
    for (const { proc } of this.procs.values()) {
      try { proc.kill('SIGKILL') } catch { /* already dead */ }
    }
    this.procs.clear()
  }
}

export const pluginHostManager = new PluginHostManager()

// Ensure all plugin children are killed when the main process exits
process.on('exit', () => pluginHostManager.killAll())
process.on('SIGTERM', () => pluginHostManager.killAll())
