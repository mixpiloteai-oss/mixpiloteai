// ─── Plugin Host Process ──────────────────────────────────────────────────────
// Runs in an isolated child process spawned by pluginHost.ts.
// Routes plugin commands to the Rust audio engine via JSON IPC.
// If this process crashes, the parent process handles it — the DAW stays alive.

import { spawn, type ChildProcess } from 'child_process'
import { join } from 'path'
import { existsSync } from 'fs'
import * as readline from 'readline'

// ── Message types (mirrored in pluginHost.ts) ─────────────────────────────────

type HostMessage =
  | { type: 'load';              instanceId: string; pluginPath: string; format: string }
  | { type: 'unload';            instanceId: string }
  | { type: 'set-parameter';     instanceId: string; paramId: number; value: number }
  | { type: 'get-parameter';     instanceId: string; paramId: number }
  | { type: 'process-audio';     instanceId: string; inputSamples: number[]; numSamples: number; channels: number }
  | { type: 'send-midi';         instanceId: string; eventType: string; channel: number; note: number; velocity: number; control: number; value: number; pitchBend: number; sampleOffset: number }
  | { type: 'add-to-chain';      instanceId: string; trackId: string }
  | { type: 'remove-from-chain'; instanceId: string; trackId: string }
  | { type: 'add-automation';    instanceId: string; paramId: number; bar: number; beat: number; tick: number; value: number; curve: number }
  | { type: 'get-instances' }
  | { type: 'ping' }

type HostReply =
  | { type: 'loaded';          instanceId: string; name: string; vendor: string; paramCount: number; latencySamples: number }
  | { type: 'unloaded';        instanceId: string }
  | { type: 'audio-output';    instanceId: string; samples: number[]; rms: number; peak: number }
  | { type: 'parameter-value'; instanceId: string; paramId: number; value: number }
  | { type: 'instances';       instances: unknown[] }
  | { type: 'pong' }
  | { type: 'error';           instanceId?: string; message: string }
  | { type: 'engine-event';    event: unknown }

// ── Audio engine process ──────────────────────────────────────────────────────

let engineProc: ChildProcess | null = null
let engineReady = false
const messageQueue: Record<string, unknown>[] = []

function reply(msg: HostReply): void {
  process.send?.(msg)
}

function findEngineBinary(): string | null {
  const candidates = [
    // Production (packaged)
    join(__dirname, '..', '..', '..', '..', '..', 'resources', 'audio-engine', 'audio-engine'),
    join(__dirname, '..', '..', '..', '..', '..', 'resources', 'audio-engine', 'audio-engine.exe'),
    // Development (Rust build — release)
    join(__dirname, '..', '..', '..', '..', '..', '..', 'native', 'audio-engine', 'target', 'release', 'audio-engine'),
    join(__dirname, '..', '..', '..', '..', '..', '..', 'native', 'audio-engine', 'target', 'release', 'audio-engine.exe'),
    // Development (Rust build — debug)
    join(__dirname, '..', '..', '..', '..', '..', '..', 'native', 'audio-engine', 'target', 'debug', 'audio-engine'),
  ]
  return candidates.find(p => existsSync(p)) ?? null
}

function sendToEngine(cmd: Record<string, unknown>): void {
  if (!engineProc || !engineReady) {
    messageQueue.push(cmd)
    return
  }
  const line = JSON.stringify(cmd) + '\n'
  engineProc.stdin?.write(line)
}

function flushQueue(): void {
  while (messageQueue.length > 0) {
    const cmd = messageQueue.shift()!
    const line = JSON.stringify(cmd) + '\n'
    engineProc?.stdin?.write(line)
  }
}

function handleEngineEventImpl(event: Record<string, unknown>): void {
  const evType = event.event as string

  switch (evType) {
    case 'plugin_loaded': {
      const instanceId = event.instance_id as string
      reply({
        type: 'loaded',
        instanceId,
        name: event.name as string,
        vendor: event.vendor as string,
        paramCount: event.param_count as number,
        latencySamples: (event.latency_samples as number) ?? 0,
      })
      break
    }
    case 'plugin_load_error': {
      reply({
        type: 'error',
        instanceId: event.instance_id as string,
        message: event.error as string,
      })
      break
    }
    case 'plugin_unloaded': {
      reply({ type: 'unloaded', instanceId: event.instance_id as string })
      break
    }
    case 'plugin_audio_output': {
      reply({
        type: 'audio-output',
        instanceId: event.instance_id as string,
        samples: event.samples as number[],
        rms: event.rms as number,
        peak: event.peak as number,
      })
      break
    }
    case 'plugin_parameter_value': {
      reply({
        type: 'parameter-value',
        instanceId: event.instance_id as string,
        paramId: event.param_id as number,
        value: event.value as number,
      })
      break
    }
    case 'plugin_instances': {
      reply({ type: 'instances', instances: event.instances as unknown[] })
      break
    }
    case 'plugin_crashed': {
      reply({
        type: 'error',
        instanceId: event.instance_id as string,
        message: `Plugin crashed in audio engine: ${String(event.error)}`,
      })
      break
    }
    default:
      // Forward other events to parent
      reply({ type: 'engine-event', event })
  }
}

let handleEngineEvent: (event: Record<string, unknown>) => void = handleEngineEventImpl

function startEngine(): Promise<void> {
  return new Promise((resolve, reject) => {
    const binaryPath = findEngineBinary()
    if (!binaryPath) {
      reject(new Error('Audio engine binary not found'))
      return
    }

    engineProc = spawn(binaryPath, [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, RUST_LOG: 'warn' },
    })

    const rl = readline.createInterface({ input: engineProc.stdout! })

    rl.on('line', (line: string) => {
      if (!line.trim()) return
      try {
        const event = JSON.parse(line) as Record<string, unknown>
        handleEngineEvent(event)
      } catch {
        /* non-JSON line, ignore */
      }
    })

    engineProc.on('error', (err) => {
      reject(err)
    })

    engineProc.on('exit', (code, signal) => {
      engineReady = false
      engineProc = null
      if (code !== 0) {
        reply({ type: 'error', message: `Engine exited: code=${String(code)} signal=${String(signal)}` })
      }
    })

    // Wait for 'ready' event from engine
    const readyTimeout = setTimeout(() => {
      reject(new Error('Audio engine ready timeout'))
    }, 15_000)

    const savedHandle = handleEngineEventImpl
    handleEngineEvent = (event: Record<string, unknown>) => {
      if (event.event === 'ready') {
        clearTimeout(readyTimeout)
        engineReady = true
        handleEngineEvent = savedHandle
        flushQueue()
        resolve()
        return
      }
      savedHandle(event)
    }
  })
}

// ── Message handler ───────────────────────────────────────────────────────────

process.on('message', (msg: HostMessage) => {
  try {
    switch (msg.type) {
      case 'ping':
        reply({ type: 'pong' })
        break

      case 'load':
        sendToEngine({
          cmd: 'load_plugin',
          instance_id: msg.instanceId,
          plugin_path: msg.pluginPath,
          format: msg.format,
        })
        break

      case 'unload':
        sendToEngine({ cmd: 'unload_plugin', instance_id: msg.instanceId })
        break

      case 'set-parameter':
        sendToEngine({
          cmd: 'set_plugin_parameter',
          instance_id: msg.instanceId,
          param_id: msg.paramId,
          value: msg.value,
        })
        break

      case 'get-parameter':
        sendToEngine({
          cmd: 'get_plugin_parameter',
          instance_id: msg.instanceId,
          param_id: msg.paramId,
        })
        break

      case 'process-audio':
        sendToEngine({
          cmd: 'process_plugin',
          instance_id: msg.instanceId,
          input_samples: msg.inputSamples,
          num_samples: msg.numSamples,
          channels: msg.channels,
        })
        break

      case 'send-midi':
        sendToEngine({
          cmd: 'send_midi_to_plugin',
          instance_id: msg.instanceId,
          event_type: msg.eventType,
          channel: msg.channel,
          note: msg.note,
          velocity: msg.velocity,
          control: msg.control,
          value: msg.value,
          pitch_bend: msg.pitchBend,
          sample_offset: msg.sampleOffset,
        })
        break

      case 'add-to-chain':
        sendToEngine({
          cmd: 'add_plugin_to_chain',
          track_id: msg.trackId,
          instance_id: msg.instanceId,
        })
        break

      case 'remove-from-chain':
        sendToEngine({
          cmd: 'remove_plugin_from_chain',
          track_id: msg.trackId,
          instance_id: msg.instanceId,
        })
        break

      case 'add-automation':
        sendToEngine({
          cmd: 'add_automation_point',
          instance_id: msg.instanceId,
          param_id: msg.paramId,
          bar: msg.bar,
          beat: msg.beat,
          tick: msg.tick,
          value: msg.value,
          curve: msg.curve,
        })
        break

      case 'get-instances':
        sendToEngine({ cmd: 'get_plugin_instances' })
        break
    }
  } catch (err) {
    reply({
      type: 'error',
      instanceId: (msg as { instanceId?: string }).instanceId,
      message: String(err),
    })
  }
})

process.on('uncaughtException', (err) => {
  reply({ type: 'error', message: `Uncaught in plugin host: ${err.message}` })
})

// ── Boot ──────────────────────────────────────────────────────────────────────

startEngine()
  .then(() => {
    process.send?.({ type: 'ready' })
  })
  .catch((err: Error) => {
    // Signal ready anyway so parent doesn't hang; it will see errors when
    // actual plugin commands are sent.
    process.send?.({ type: 'ready' })
    process.send?.({ type: 'error', message: `Engine start failed: ${err.message}` })
  })
