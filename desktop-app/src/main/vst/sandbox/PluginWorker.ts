// ── VST3 Plugin Worker ─────────────────────────────────────────────────────────
// Runs in a separate Node.js process (via child_process.fork) for crash isolation.
// PRODUCTION: spawn with --max-old-space-size=256 per worker
//
// Each worker manages one plugin instance using the native VST3 adapter.
// Communication happens via process.send / process.on('message').

import { vst3Adapter } from '../native/IVst3Adapter'
import type { Vst3MidiEvent } from '../native/IVst3Adapter'

// ── Message protocol ──────────────────────────────────────────────────────────

interface WorkerRequest {
  requestId: string
  type: string
  payload: unknown
}

interface WorkerResponse {
  type: 'response'
  requestId: string
  payload: unknown
}

interface WorkerError {
  type: 'error'
  requestId: string
  error: string
}

interface WorkerCrash {
  type: 'crash'
  error: string
}

type WorkerOutbound = WorkerResponse | WorkerError | WorkerCrash

function send(msg: WorkerOutbound): void {
  if (process.send) {
    process.send(msg)
  }
}

function respond(requestId: string, payload: unknown): void {
  send({ type: 'response', requestId, payload })
}

function respondError(requestId: string, error: string): void {
  send({ type: 'error', requestId, error })
}

// ── Request handlers ──────────────────────────────────────────────────────────

async function handleRequest(req: WorkerRequest): Promise<void> {
  const { requestId, type, payload } = req
  const p = payload as Record<string, unknown>

  try {
    switch (type) {
      case 'LoadPlugin': {
        // NATIVE-ADDON: plug in vst3-node addon here — interface defined in src/main/vst/native/IVst3Adapter.ts
        // When native addon is available: vst3Adapter.createInstance(p.pluginPath as string, p.componentId as string)
        void vst3Adapter // referenced to satisfy linter
        respond(requestId, { ok: true, message: 'Plugin loading requires native addon (NATIVE-ADDON)' })
        break
      }

      case 'UnloadPlugin': {
        const instanceId = p['instanceId'] as string
        if (!instanceId) { respondError(requestId, 'Missing instanceId'); break }
        // NATIVE-ADDON: plug in vst3-node addon here — interface defined in src/main/vst/native/IVst3Adapter.ts
        respond(requestId, { ok: true })
        break
      }

      case 'SetParameter': {
        const instanceId = p['instanceId'] as string
        const paramId = p['paramId'] as number
        const value = p['value'] as number
        if (!instanceId) { respondError(requestId, 'Missing instanceId'); break }
        // NATIVE-ADDON: plug in vst3-node addon here — interface defined in src/main/vst/native/IVst3Adapter.ts
        respond(requestId, { ok: true, instanceId, paramId, value })
        break
      }

      case 'GetParameter': {
        const instanceId = p['instanceId'] as string
        const paramId = p['paramId'] as number
        if (!instanceId) { respondError(requestId, 'Missing instanceId'); break }
        // NATIVE-ADDON: plug in vst3-node addon here — interface defined in src/main/vst/native/IVst3Adapter.ts
        respond(requestId, { value: 0.5, normalized: 0.5, display: '0.5', instanceId, paramId })
        break
      }

      case 'GetAllParameters': {
        const instanceId = p['instanceId'] as string
        if (!instanceId) { respondError(requestId, 'Missing instanceId'); break }
        // NATIVE-ADDON: plug in vst3-node addon here — interface defined in src/main/vst/native/IVst3Adapter.ts
        respond(requestId, [])
        break
      }

      case 'GetState': {
        const instanceId = p['instanceId'] as string
        if (!instanceId) { respondError(requestId, 'Missing instanceId'); break }
        // NATIVE-ADDON: plug in vst3-node addon here — interface defined in src/main/vst/native/IVst3Adapter.ts
        // Real implementation: Buffer → base64 → JSON for IPC transport
        respond(requestId, { stateBase64: '', instanceId })
        break
      }

      case 'SetState': {
        const instanceId = p['instanceId'] as string
        const stateBase64 = p['stateBase64'] as string
        if (!instanceId) { respondError(requestId, 'Missing instanceId'); break }
        // NATIVE-ADDON: plug in vst3-node addon here — interface defined in src/main/vst/native/IVst3Adapter.ts
        // Real implementation: base64 → Buffer → vst3Adapter.setState(instanceId, buf)
        void stateBase64
        respond(requestId, { ok: true })
        break
      }

      case 'SendMidi': {
        const instanceId = p['instanceId'] as string
        const event = p['event'] as Vst3MidiEvent
        if (!instanceId) { respondError(requestId, 'Missing instanceId'); break }
        // NATIVE-ADDON: plug in vst3-node addon here — interface defined in src/main/vst/native/IVst3Adapter.ts
        void event
        respond(requestId, { ok: true })
        break
      }

      case 'GetPresets': {
        const instanceId = p['instanceId'] as string
        if (!instanceId) { respondError(requestId, 'Missing instanceId'); break }
        // NATIVE-ADDON: plug in vst3-node addon here — interface defined in src/main/vst/native/IVst3Adapter.ts
        respond(requestId, { presets: [], instanceId })
        break
      }

      case 'LoadPreset': {
        const instanceId = p['instanceId'] as string
        const presetPath = p['presetPath'] as string
        if (!instanceId) { respondError(requestId, 'Missing instanceId'); break }
        // NATIVE-ADDON: plug in vst3-node addon here — interface defined in src/main/vst/native/IVst3Adapter.ts
        void presetPath
        respond(requestId, { ok: true })
        break
      }

      case 'Ping': {
        respond(requestId, { pong: true, pid: process.pid })
        break
      }

      default:
        respondError(requestId, `Unknown message type: ${type}`)
    }
  } catch (err) {
    respondError(requestId, err instanceof Error ? err.message : String(err))
  }
}

// ── Process lifecycle ─────────────────────────────────────────────────────────

process.on('message', (msg: unknown) => {
  if (typeof msg !== 'object' || msg === null) return
  const req = msg as WorkerRequest
  if (typeof req.requestId !== 'string' || typeof req.type !== 'string') return

  void handleRequest(req)
})

process.on('uncaughtException', (err: Error) => {
  send({ type: 'crash', error: `UncaughtException: ${err.message}\n${err.stack ?? ''}` })
  process.exit(1)
})

process.on('unhandledRejection', (reason: unknown) => {
  const msg = reason instanceof Error ? reason.message : String(reason)
  send({ type: 'crash', error: `UnhandledRejection: ${msg}` })
  process.exit(1)
})

// Signal to parent that worker is ready
if (process.send) {
  process.send({ type: 'ready', pid: process.pid })
}
