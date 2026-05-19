// ─── Plugin Host Process ──────────────────────────────────────────────────────
// Runs in an isolated child process spawned by pluginHost.ts.
// Loads VST3/AU plugins via native bindings (placeholder hook).
// If this process crashes, the parent process handles it — the DAW stays alive.

// ── Message types (mirrored in pluginHost.ts) ─────────────────────────────────

type HostMessage =
  | { type: 'load';   instanceId: string; pluginPath: string; format: string }
  | { type: 'unload'; instanceId: string }
  | { type: 'ping' }

type HostReply =
  | { type: 'loaded';   instanceId: string; name: string; vendor: string; paramCount: number }
  | { type: 'unloaded'; instanceId: string }
  | { type: 'pong' }
  | { type: 'error';    instanceId?: string; message: string }

// ── Loaded instances (in-process) ────────────────────────────────────────────

const instances = new Map<string, { path: string; format: string }>()

function reply(msg: HostReply): void {
  process.send?.(msg)
}

// ── Native plugin loading (platform bridge) ───────────────────────────────────
// In production: replace with native N-API addon calls.
// e.g.:  const vst3 = _require('./vst3_native.node')
//        const info  = vst3.load(pluginPath)

function loadNative(pluginPath: string, format: string): {
  name: string; vendor: string; paramCount: number
} {
  // ── STUB: real implementation loads native plugin library ──
  // This is where `dlopen` / `LoadLibrary` / Audio Unit API calls happen.
  // The stub returns plausible metadata from the filename so the UI works.
  const base = pluginPath.replace(/\\/g, '/').split('/').pop()?.replace(/\.(vst3|dll|so|component)$/i, '') ?? 'Unknown'
  void format
  return { name: base, vendor: 'Native Plugin', paramCount: 64 }
}

function unloadNative(_instanceId: string): void {
  // ── STUB: real implementation calls plugin.terminate() + FreeLibrary ──
}

// ── Message handler ───────────────────────────────────────────────────────────

process.on('message', (msg: HostMessage) => {
  try {
    switch (msg.type) {
      case 'ping':
        reply({ type: 'pong' })
        break

      case 'load': {
        const info = loadNative(msg.pluginPath, msg.format)
        instances.set(msg.instanceId, { path: msg.pluginPath, format: msg.format })
        reply({ type: 'loaded', instanceId: msg.instanceId, ...info })
        break
      }

      case 'unload': {
        unloadNative(msg.instanceId)
        instances.delete(msg.instanceId)
        reply({ type: 'unloaded', instanceId: msg.instanceId })
        break
      }
    }
  } catch (err) {
    reply({ type: 'error', instanceId: (msg as { instanceId?: string }).instanceId, message: String(err) })
  }
})

process.on('uncaughtException', (err) => {
  reply({ type: 'error', message: `Uncaught: ${err.message}` })
  // Don't exit — the host may want to unload gracefully.
})

// Signal ready
process.send?.({ type: 'ready' })
