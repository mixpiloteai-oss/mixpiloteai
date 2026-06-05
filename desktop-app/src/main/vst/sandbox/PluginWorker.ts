// ── VST3 Plugin Worker ─────────────────────────────────────────────────────────
// Runs in a separate Node.js process (via child_process.fork) for crash isolation.
// Spawned with --max-old-space-size=256 per worker (production config).
//
// Each worker manages ONE plugin instance using the native VST3 adapter.
// Communication happens via process.send / process.on('message').

import { vst3Adapter } from '../native/IVst3Adapter'
import type { Vst3MidiEvent, Vst3ProcessSetup } from '../native/IVst3Adapter'

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
  if (process.send) process.send(msg)
}

function respond(requestId: string, payload: unknown): void {
  send({ type: 'response', requestId, payload })
}

function respondError(requestId: string, error: string): void {
  send({ type: 'error', requestId, error })
}

// Per-worker state: one active instance
let activeInstanceId: string | null = null

// ── Request handlers ──────────────────────────────────────────────────────────

async function handleRequest(req: WorkerRequest): Promise<void> {
  const { requestId, type, payload } = req
  const p = payload as Record<string, unknown>

  try {
    switch (type) {

      case 'LoadPlugin': {
        const pluginPath  = p['pluginPath'] as string
        const componentId = p['componentId'] as string
        if (!pluginPath) { respondError(requestId, 'Missing pluginPath'); break }

        // Scan first to validate bundle
        const info = await vst3Adapter.scanPlugin(pluginPath)
        if (!info) { respondError(requestId, `scanPlugin returned null for: ${pluginPath}`); break }

        const effectiveComponentId = componentId || info.cid
        const instanceId = await vst3Adapter.createInstance(pluginPath, effectiveComponentId)
        activeInstanceId = instanceId

        respond(requestId, {
          ok: true,
          instanceId,
          pluginInfo: info,
        })
        break
      }

      case 'UnloadPlugin': {
        const instanceId = (p['instanceId'] as string | null) ?? activeInstanceId
        if (!instanceId) { respondError(requestId, 'No active instance'); break }
        await vst3Adapter.destroyInstance(instanceId)
        if (activeInstanceId === instanceId) activeInstanceId = null
        respond(requestId, { ok: true })
        break
      }

      case 'SetupProcessing': {
        const instanceId = (p['instanceId'] as string | null) ?? activeInstanceId
        if (!instanceId) { respondError(requestId, 'No active instance'); break }
        const setup = p['setup'] as Vst3ProcessSetup
        const ok = await vst3Adapter.setupProcessing(instanceId, setup)
        respond(requestId, { ok })
        break
      }

      case 'ActivateInstance': {
        const instanceId = (p['instanceId'] as string | null) ?? activeInstanceId
        if (!instanceId) { respondError(requestId, 'No active instance'); break }
        const active = Boolean(p['active'])
        await vst3Adapter.activateInstance(instanceId, active)
        respond(requestId, { ok: true, active })
        break
      }

      case 'SetParameter': {
        const instanceId = (p['instanceId'] as string | null) ?? activeInstanceId
        const paramId    = p['paramId']  as number
        const value      = p['value']    as number
        if (!instanceId) { respondError(requestId, 'No active instance'); break }
        await vst3Adapter.setParameterValue(instanceId, paramId, value)
        respond(requestId, { ok: true, instanceId, paramId, value })
        break
      }

      case 'GetParameter': {
        const instanceId = (p['instanceId'] as string | null) ?? activeInstanceId
        const paramId    = p['paramId'] as number
        if (!instanceId) { respondError(requestId, 'No active instance'); break }
        const value = await vst3Adapter.getParameterValue(instanceId, paramId)
        const display = await vst3Adapter.getParameterStringByValue(instanceId, paramId, value)
        respond(requestId, { value, normalized: value, display, instanceId, paramId })
        break
      }

      case 'GetAllParameters': {
        const instanceId = (p['instanceId'] as string | null) ?? activeInstanceId
        if (!instanceId) { respondError(requestId, 'No active instance'); break }
        const params = await vst3Adapter.getAllParameterValues(instanceId)
        respond(requestId, params)
        break
      }

      case 'GetParameterInfo': {
        const instanceId = (p['instanceId'] as string | null) ?? activeInstanceId
        const index      = p['index'] as number
        if (!instanceId) { respondError(requestId, 'No active instance'); break }
        const info = await vst3Adapter.getParameterInfo(instanceId, index)
        respond(requestId, info)
        break
      }

      case 'GetParameterCount': {
        const instanceId = (p['instanceId'] as string | null) ?? activeInstanceId
        if (!instanceId) { respondError(requestId, 'No active instance'); break }
        const count = await vst3Adapter.getParameterCount(instanceId)
        respond(requestId, { count })
        break
      }

      case 'GetState': {
        const instanceId = (p['instanceId'] as string | null) ?? activeInstanceId
        if (!instanceId) { respondError(requestId, 'No active instance'); break }
        const stateBuffer = await vst3Adapter.getState(instanceId)
        // Encode as base64 for IPC transport
        const stateBase64 = stateBuffer.toString('base64')
        respond(requestId, { stateBase64, instanceId })
        break
      }

      case 'SetState': {
        const instanceId  = (p['instanceId'] as string | null) ?? activeInstanceId
        const stateBase64 = p['stateBase64'] as string
        if (!instanceId) { respondError(requestId, 'No active instance'); break }
        const buf = Buffer.from(stateBase64, 'base64')
        await vst3Adapter.setState(instanceId, buf)
        respond(requestId, { ok: true })
        break
      }

      case 'AttachEditor': {
        const instanceId     = (p['instanceId'] as string | null) ?? activeInstanceId
        const handleBase64   = p['parentWindowHandle'] as string
        if (!instanceId) { respondError(requestId, 'No active instance'); break }
        const handle = Buffer.from(handleBase64 ?? '', 'base64')
        const size = await vst3Adapter.attachEditor(instanceId, handle)
        respond(requestId, { ok: true, ...size })
        break
      }

      case 'DetachEditor': {
        const instanceId = (p['instanceId'] as string | null) ?? activeInstanceId
        if (!instanceId) { respondError(requestId, 'No active instance'); break }
        await vst3Adapter.detachEditor(instanceId)
        respond(requestId, { ok: true })
        break
      }

      case 'ResizeEditor': {
        const instanceId = (p['instanceId'] as string | null) ?? activeInstanceId
        const width  = p['width']  as number
        const height = p['height'] as number
        if (!instanceId) { respondError(requestId, 'No active instance'); break }
        await vst3Adapter.resizeEditor(instanceId, width, height)
        respond(requestId, { ok: true })
        break
      }

      case 'SendMidi': {
        const instanceId = (p['instanceId'] as string | null) ?? activeInstanceId
        const event      = p['event'] as Vst3MidiEvent
        if (!instanceId) { respondError(requestId, 'No active instance'); break }
        await vst3Adapter.sendMidiEvent(instanceId, event)
        respond(requestId, { ok: true })
        break
      }

      case 'GetPresets': {
        const instanceId = (p['instanceId'] as string | null) ?? activeInstanceId
        if (!instanceId) { respondError(requestId, 'No active instance'); break }
        const count = await vst3Adapter.getPresetCount(instanceId)
        const presets: Array<{ index: number; name: string }> = []
        for (let i = 0; i < count; i++) {
          const name = await vst3Adapter.getPresetName(instanceId, i)
          presets.push({ index: i, name })
        }
        respond(requestId, { presets, instanceId })
        break
      }

      case 'LoadPreset': {
        const instanceId  = (p['instanceId'] as string | null) ?? activeInstanceId
        const presetPath  = p['presetPath'] as string
        if (!instanceId) { respondError(requestId, 'No active instance'); break }
        await vst3Adapter.loadPreset(instanceId, presetPath)
        respond(requestId, { ok: true })
        break
      }

      case 'SavePreset': {
        const instanceId  = (p['instanceId'] as string | null) ?? activeInstanceId
        const presetPath  = p['presetPath'] as string
        if (!instanceId) { respondError(requestId, 'No active instance'); break }
        await vst3Adapter.savePreset(instanceId, presetPath)
        respond(requestId, { ok: true })
        break
      }

      case 'Ping': {
        respond(requestId, { pong: true, pid: process.pid, adapterReady: true })
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
  // Clean up active instance before dying
  if (activeInstanceId) {
    try { void vst3Adapter.destroyInstance(activeInstanceId) } catch { /* ignore */ }
  }
  process.exit(1)
})

process.on('unhandledRejection', (reason: unknown) => {
  const msg = reason instanceof Error ? reason.message : String(reason)
  send({ type: 'crash', error: `UnhandledRejection: ${msg}` })
  process.exit(1)
})

// Signal parent that worker is ready
if (process.send) {
  process.send({ type: 'ready', pid: process.pid })
}
