// ── VST Sandbox process manager ────────────────────────────────────────────────
// Manages sandboxed plugin process state using child_process.fork for crash isolation.
// Each plugin instance runs in a separate Node.js process communicating via IPC.

import { fork, type ChildProcess } from 'child_process'
import * as path from 'path'
import { fileURLToPath } from 'url'

export interface SandboxProcess {
  pid: number
  pluginId: string
  instanceId: string
  status: 'loading' | 'ready' | 'crashed' | 'unloaded'
}

export type SandboxMessage =
  | { type: 'load-plugin'; pluginId: string; path: string }
  | { type: 'unload-plugin' }
  | { type: 'set-parameter'; paramIndex: number; value: number }
  | { type: 'get-parameter'; paramIndex: number }
  | { type: 'get-all-parameters' }
  | { type: 'get-state' }
  | { type: 'set-state'; state: number[] }
  | { type: 'send-midi'; event: MidiEventData }
  | { type: 'get-presets' }
  | { type: 'load-preset'; presetId: string }

export interface MidiEventData {
  type: 'noteOn' | 'noteOff' | 'cc' | 'pitchBend'
  channel: number
  note?: number
  velocity?: number
  ccNumber?: number
  ccValue?: number
  pitchBend?: number
}

// ── Worker process handle ─────────────────────────────────────────────────────

export type WorkerStatus = 'spawning' | 'ready' | 'busy' | 'crashed' | 'terminated'

export interface PendingRequest {
  resolve: (v: unknown) => void
  reject: (e: Error) => void
  timer: NodeJS.Timeout
}

export interface WorkerHandle {
  instanceId: string
  pluginId: string
  process: ChildProcess
  pendingRequests: Map<string, PendingRequest>
  status: WorkerStatus
}

// ── Default spawn function ────────────────────────────────────────────────────

/**
 * Resolve the worker script path. In CommonJS (Electron production) __dirname is
 * available. In ES module contexts (tests) we use import.meta.url if available.
 * The caller can always override by passing workerScriptPath to the constructor.
 */
function resolveDefaultWorkerScript(): string {
  try {
    // CommonJS context (Electron main process after vite build)
    if (typeof __dirname !== 'undefined') {
      return path.join(__dirname, 'sandbox', 'PluginWorker.js')
    }
  } catch {
    // __dirname not defined
  }
  // ES module context — use import.meta.url
  // biome-ignore lint: dynamic access is intentional here
  const metaUrl = (import.meta as { url?: string }).url
  if (metaUrl) {
    return path.join(fileURLToPath(metaUrl), '..', 'sandbox', 'PluginWorker.js')
  }
  return path.join(process.cwd(), 'src', 'main', 'vst', 'sandbox', 'PluginWorker.js')
}

const WORKER_SCRIPT = resolveDefaultWorkerScript()

function defaultSpawnFn(workerPath: string): ChildProcess {
  return fork(workerPath, [], {
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    // PRODUCTION: add --max-old-space-size=256 per worker
  })
}

// ── VstSandboxManager ─────────────────────────────────────────────────────────

export class VstSandboxManager {
  static readonly MAX_WORKERS = 16

  private workers: Map<string, WorkerHandle> = new Map()
  // Legacy compatibility: processes map mirrors workers for getProcess/getAllProcesses
  private processes: Map<string, SandboxProcess> = new Map()
  private readonly spawnFn: (workerPath: string) => ChildProcess
  private readonly workerScriptPath: string

  constructor(
    spawnFn: (workerPath: string) => ChildProcess = defaultSpawnFn,
    workerScriptPath: string = WORKER_SCRIPT,
  ) {
    this.spawnFn = spawnFn
    this.workerScriptPath = workerScriptPath
  }

  // ── Worker lifecycle ────────────────────────────────────────────────────────

  spawnWorker(instanceId: string, pluginId: string): WorkerHandle {
    if (this.workers.size >= VstSandboxManager.MAX_WORKERS) {
      throw new Error(
        `Maximum sandbox worker limit (${VstSandboxManager.MAX_WORKERS}) reached. ` +
        `Unload unused plugin instances before loading new ones.`
      )
    }

    const childProcess = this.spawnFn(this.workerScriptPath)

    const handle: WorkerHandle = {
      instanceId,
      pluginId,
      process: childProcess,
      pendingRequests: new Map(),
      status: 'spawning',
    }

    this.workers.set(instanceId, handle)

    // Add legacy SandboxProcess entry
    this.processes.set(instanceId, {
      pid: childProcess.pid ?? 0,
      pluginId,
      instanceId,
      status: 'loading',
    })

    // Handle messages from worker
    childProcess.on('message', (msg: unknown) => {
      this.handleWorkerMessage(instanceId, msg)
    })

    // Handle worker exit (crash or clean termination)
    childProcess.on('exit', (code, signal) => {
      this.handleWorkerExit(instanceId, code, signal)
    })

    // Pipe worker stderr to parent stderr for debugging
    if (childProcess.stderr) {
      childProcess.stderr.on('data', (data: Buffer) => {
        process.stderr.write(`[VstWorker:${instanceId}] ${data.toString()}`)
      })
    }

    return handle
  }

  // ── Legacy createProcess (delegates to spawnWorker) ─────────────────────────

  createProcess(pluginId: string, instanceId: string): SandboxProcess {
    const handle = this.spawnWorker(instanceId, pluginId)
    // Immediately mark ready for legacy callers (spawnWorker sets spawning)
    handle.status = 'ready'
    const proc = this.processes.get(instanceId)
    if (proc) proc.status = 'ready'
    return proc ?? { pid: handle.process.pid ?? 0, pluginId, instanceId, status: 'ready' }
  }

  terminateProcess(instanceId: string): void {
    this.terminateWorker(instanceId)
  }

  getProcess(instanceId: string): SandboxProcess | undefined {
    return this.processes.get(instanceId)
  }

  getAllProcesses(): SandboxProcess[] {
    return Array.from(this.processes.values())
  }

  // ── Request/response protocol ───────────────────────────────────────────────

  async sendRequest(
    instanceId: string,
    type: string,
    payload: unknown,
    timeoutMs = 2000,
  ): Promise<unknown> {
    const handle = this.workers.get(instanceId)
    if (!handle) {
      throw new Error(`No worker for instanceId: ${instanceId}`)
    }
    if (handle.status === 'crashed' || handle.status === 'terminated') {
      throw new Error(`Worker ${instanceId} is ${handle.status}`)
    }

    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2)}`

    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        handle.pendingRequests.delete(requestId)
        this.terminateWorker(instanceId)
        reject(new Error(`VST worker request timed out after ${timeoutMs}ms (type=${type}, instanceId=${instanceId})`))
      }, timeoutMs)

      handle.pendingRequests.set(requestId, { resolve, reject, timer })

      handle.process.send({ requestId, type, payload }, (err) => {
        if (err) {
          clearTimeout(timer)
          handle.pendingRequests.delete(requestId)
          reject(new Error(`Failed to send message to worker: ${err.message}`))
        }
      })
    })
  }

  terminateWorker(instanceId: string): void {
    const handle = this.workers.get(instanceId)
    if (!handle) return

    // Reject all pending requests
    for (const [reqId, pending] of handle.pendingRequests) {
      clearTimeout(pending.timer)
      pending.reject(new Error(`Worker ${instanceId} was terminated`))
      handle.pendingRequests.delete(reqId)
    }

    handle.status = 'terminated'

    // SIGTERM first, then SIGKILL after 500ms
    try {
      handle.process.kill('SIGTERM')
      setTimeout(() => {
        if (!handle.process.killed) {
          try { handle.process.kill('SIGKILL') } catch { /* already dead */ }
        }
      }, 500)
    } catch {
      // Process may already be dead
    }

    this.workers.delete(instanceId)

    // Update legacy process status
    const proc = this.processes.get(instanceId)
    if (proc) {
      proc.status = 'unloaded'
      this.processes.delete(instanceId)
    }
  }

  getWorker(instanceId: string): WorkerHandle | undefined {
    return this.workers.get(instanceId)
  }

  getAllWorkers(): WorkerHandle[] {
    return Array.from(this.workers.values())
  }

  // ── Internal message handling ────────────────────────────────────────────────

  private handleWorkerMessage(instanceId: string, msg: unknown): void {
    if (typeof msg !== 'object' || msg === null) return

    const m = msg as Record<string, unknown>
    const handle = this.workers.get(instanceId)
    if (!handle) return

    if (m['type'] === 'ready') {
      handle.status = 'ready'
      const proc = this.processes.get(instanceId)
      if (proc) proc.status = 'ready'
      return
    }

    if (m['type'] === 'crash') {
      handle.status = 'crashed'
      const proc = this.processes.get(instanceId)
      if (proc) proc.status = 'crashed'
      // Reject all pending requests
      for (const [reqId, pending] of handle.pendingRequests) {
        clearTimeout(pending.timer)
        pending.reject(new Error(`Worker crashed: ${String(m['error'] ?? 'unknown')}`))
        handle.pendingRequests.delete(reqId)
      }
      return
    }

    if (m['type'] === 'response' || m['type'] === 'error') {
      const requestId = m['requestId'] as string
      const pending = handle.pendingRequests.get(requestId)
      if (!pending) return

      clearTimeout(pending.timer)
      handle.pendingRequests.delete(requestId)

      if (m['type'] === 'error') {
        pending.reject(new Error(String(m['error'] ?? 'Worker error')))
      } else {
        pending.resolve(m['payload'])
      }
    }
  }

  private handleWorkerExit(instanceId: string, code: number | null, signal: string | null): void {
    const handle = this.workers.get(instanceId)
    if (!handle) return

    if (handle.status !== 'terminated') {
      handle.status = 'crashed'
      const proc = this.processes.get(instanceId)
      if (proc) proc.status = 'crashed'
    }

    // Reject all pending requests
    const exitMsg = signal
      ? `Worker exited with signal ${signal}`
      : `Worker exited with code ${code ?? 'unknown'}`

    for (const [reqId, pending] of handle.pendingRequests) {
      clearTimeout(pending.timer)
      pending.reject(new Error(exitMsg))
      handle.pendingRequests.delete(reqId)
    }
  }
}
