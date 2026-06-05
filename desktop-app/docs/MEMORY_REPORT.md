# Neurotek Studio — Memory Usage Report
*Generated: 2026-05-27 | Version 0.2.0*

---

## Process Memory Map

Neurotek Studio runs **three to N+2 processes** depending on loaded plugins:

```
┌─────────────────────────────────────────────────────────────────┐
│ Main Process (Electron / Node.js)                               │
│   - Module registry, IPC routing, autosave, crash reporter      │
│   - Baseline: ~60–80MB RSS                                      │
│   - Monitored: every 10s, warn at 512MB, critical at 768MB     │
├─────────────────────────────────────────────────────────────────┤
│ Renderer Process (Chromium)                                     │
│   - React UI, Zustand stores, Web Audio API, canvas rendering   │
│   - Baseline: ~150–200MB                                        │
│   - Monitored: via performance.memory (heap, non-heap)          │
│   - Large projects (32+ tracks): up to 500MB                   │
├─────────────────────────────────────────────────────────────────┤
│ Native Audio Engine (Rust subprocess)                           │
│   - Real-time audio processing, buffers, mixer                  │
│   - Baseline: ~20–40MB                                          │
│   - Scales: ~2MB per audio track (pre-allocated buffers)        │
├─────────────────────────────────────────────────────────────────┤
│ Plugin Host #1 (per loaded VST/AU plugin)                       │
│ Plugin Host #2                                                  │
│ Plugin Host #N  → each 30–200MB depending on plugin            │
│   - Monitored: via /proc/<pid>/status (Linux) or OS APIs       │
│   - Limit: 1024MB per plugin → warning + blacklist candidate   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Memory Budgets

| Process | Baseline | Typical (8 tracks) | Large (32 tracks) | Limit |
|---|---|---|---|---|
| Main | 60MB | 80MB | 120MB | 512MB warn |
| Renderer | 180MB | 300MB | 500MB | V8 heap limit |
| Audio engine | 25MB | 45MB | 100MB | OS-limited |
| Per plugin | 40MB | 60–150MB | 60–200MB | 1024MB |
| **Total (8 tracks, 4 plugins)** | — | ~700MB | — | — |

---

## Memory Management Systems

### 1. Main Process — Stability Monitor

```typescript
// Thresholds (stability.ts)
MEMORY_MB:         512    // Warn + notify renderer
MEMORY_CRITICAL_MB: 768  // Attempt V8 GC hint + error log

// Leak detection (10-sample sliding window, every 10s)
if (avg(last5) - avg(first5) > 100MB) → suspect leak
```

**Actions on threshold**:
- `> 512MB`: Send `stability-warning { type: 'memory' }` to renderer; log crash entry
- `> 768MB`: Try `global.gc()` (V8 GC hint, non-deterministic); log `memory-critical`
- `+100MB trend` over 10 samples: Log suspected leak

### 2. Renderer — Audio Buffer Cache (`SmartCache.ts`)

- LRU eviction when cache size exceeds configurable limit
- `performance.memory.usedJSHeapSize` checked on each load request
- Idle buffers (not accessed in N minutes) evicted under pressure
- Sample rate change → full cache clear (decoded data becomes invalid)

### 3. Renderer — Memory Manager (`MemoryManager.ts`)

- Monitors `performance.memory.totalJSHeapSize` vs `jsHeapSizeLimit`
- At 80% heap usage: evict LRU audio buffers + clear waveform thumbnails
- At 90%: more aggressive eviction (release all non-pinned buffers)
- Integrates with `WorkerPool` to cancel pending decodes under pressure

### 4. Renderer — Streaming Buffer Manager (`StreamingBufferManager.ts`)

Prevents loading entire large audio files into RAM at once:
- Pre-decodes audio in 10-second segments
- Maintains a rolling window of segments around the playhead
- Evicts segments more than 30s behind the playhead
- Maximum concurrent pre-decode: `WorkerPool.size` (default: 4 workers)

### 5. Plugin Memory — PluginHealthMonitor

Per-plugin monitoring every 5 seconds:
```
Linux: reads /proc/<pid>/status → VmRSS field
Other: best-effort estimation (returns 0 on unsupported platforms)

Thresholds:
  > 1024MB      → emit plugin-resource-warning { type: 'memory' }
  +100MB/1min   → emit plugin-resource-warning { type: 'leak' }
```

After `plugin-resource-warning`, the IPC handler can:
- Show warning in plugin UI
- Trigger hot reload to reclaim memory
- Add to blacklist if repeated

---

## Memory Leak Prevention

### 1. Background Timers (`.unref()`)

All module-level timers that run in background are unreferenced:

| Timer | File | Interval | unref'd? |
|---|---|---|---|
| Memory check | stability.ts | 10s | ✅ |
| Heartbeat check | stability.ts | 5s | ✅ |
| Plugin health | pluginHealth.ts | 5s | ✅ |
| Production monitor | productionMonitor.ts | 5min | ✅ |
| Updater recheck | updater.ts | 6h | ✅ (fixed) |
| Startup guard stable | startupGuard.ts | 30s | ✅ (fixed) |
| Auth throttle cleanup | authThrottle.ts | 5min | ✅ |
| Collab SSE heartbeat | collaboration.ts | 25s | ✅ (fixed) |
| Collab room eviction | collaborationService.ts | 30min | ✅ (fixed) |
| Collab presence debounce | collaborationService.ts | 100ms | ✅ (fixed) |

### 2. Event Listener Cleanup

- `AudioEngineProcess` removes all listeners on process exit
- `StabilityMonitor.stop()` clears both intervals
- `CollaborationClient.disconnect()` closes EventSource + clears both timers
- `BrowserWindow` `closed` event → sets `mainWindow = null`

### 3. Audio Buffer Lifecycle

```
Load request → WaveformLoader.load(url)
              → check SmartCache
              → if miss: fetch + decode in WorkerPool
              → store in SmartCache (LRU, max size)

Eviction:   WaveformLoader.evict(url)
            SmartCache evicts LRU when near capacity
            MemoryManager.clearAll() on extreme pressure

Project close → AudioBridge.dispose()
              → AudioEngine.dispose()
              → Transport.dispose()
              → AudioContext.close() (releases all Web Audio nodes)
```

### 4. Renderer Store Hygiene

Zustand stores reset on:
- New project → `projectStore.reset()`
- Transport stop → clears `transportStore` playing state
- Collaboration disconnect → clears `collaborationStore` presence map

---

## Pending Operations Map

Both the main process and renderer track long-running operations:

```typescript
// Main process
_pendingOperations: Map<string, { start: number }>
// Stall detected at: 45s → log warning + crash entry

// Renderer
_pendingOps: Map<string, number>  // operationId → start timestamp
// Timeout enforced at: configurable, default 30s
```

Operations tracked: project load, autosave, plugin scan, audio cache fetch,
export pipeline, crash checkpoint write.

---

## Known Memory Issues

### 1. Canvas Waveform Thumbnails (MEDIUM)
Waveform thumbnails are painted to `<canvas>` elements and kept in component
state. For projects with 100+ clips, this can accumulate significant GPU texture
memory. **Mitigation needed**: Virtualize the arrangement view so only visible
clip canvases are mounted.

### 2. MIDI Event History (LOW)
`MidiMonitor` keeps a ring buffer of 1000 MIDI events. At 1000 events × ~200
bytes each = 200KB, this is negligible. However, the `MidiAutomation` system
stores full automation lanes in memory — for very long songs, this should be
page-backed.

### 3. Collaboration Op Log (LOW)
`CollabRoom.ops` stores up to 500 committed ops per room. At ~500 bytes per op,
this is ~250KB per room. Acceptable for typical use. The ring-buffer trim at 500
ops is correct.

### 4. Plugin State on Hot Reload (LOW)
`PluginRecovery.saveState()` serializes plugin parameters to a JS object before
reload. These are held in `_savedStates: Map` in memory until the plugin comes
back online. For plugins with thousands of parameters, this could be 1–2MB.
Acceptable, but should have a TTL and be cleared after successful recovery.

---

## Recommendations

1. **Expose memory stats in status bar**: Show renderer heap usage + audio engine
   memory from the production monitor. Users should have visibility into memory use.

2. **Configurable cache limits**: Expose `SmartCache` max size in Settings → 
   Performance. Default 512MB; allow 256MB (laptop) to 2GB (studio workstation).

3. **Heap snapshot on memory-critical**: When `rssMB > 768MB`, take a V8 heap
   snapshot to `userData/diagnostics/heap-{ts}.heapsnapshot` for offline analysis.

4. **macOS/Windows memory**: `/proc/<pid>/status` is Linux-only. Add Windows
   `GetProcessMemoryInfo` via a native Node addon, and macOS `task_info` call,
   for complete plugin memory monitoring across platforms.

5. **GC exposure**: Build with `--expose-gc` in dev mode and add a
   `debugForceGC()` IPC method for memory investigation.
