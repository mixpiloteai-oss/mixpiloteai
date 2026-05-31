// ── VST Sandbox process manager ────────────────────────────────────────────────
// Manages sandboxed plugin process state. In production this would use
// child_process to fork isolated processes per plugin instance for crash safety.

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

export class VstSandboxManager {
  static readonly MAX_PROCESSES = 16

  private processes: Map<string, SandboxProcess> = new Map()
  private nextPid = 10000

  createProcess(pluginId: string, instanceId: string): SandboxProcess {
    if (this.processes.size >= VstSandboxManager.MAX_PROCESSES) {
      throw new Error(`Maximum sandbox process limit (${VstSandboxManager.MAX_PROCESSES}) reached`)
    }

    const proc: SandboxProcess = {
      pid: this.nextPid++,
      pluginId,
      instanceId,
      status: 'loading',
    }

    this.processes.set(instanceId, proc)

    // In production this would fork a child process and communicate via IPC.
    // The process would load the native VST3 addon and enter a message loop.
    // For now we immediately transition to 'ready' to represent the contract.
    proc.status = 'ready'

    return proc
  }

  terminateProcess(instanceId: string): void {
    const proc = this.processes.get(instanceId)
    if (proc) {
      proc.status = 'unloaded'
      // In production: send SIGTERM to child process
      this.processes.delete(instanceId)
    }
  }

  getProcess(instanceId: string): SandboxProcess | undefined {
    return this.processes.get(instanceId)
  }

  getAllProcesses(): SandboxProcess[] {
    return Array.from(this.processes.values())
  }
}
