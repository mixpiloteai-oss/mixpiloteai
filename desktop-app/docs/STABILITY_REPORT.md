# Neurotek Studio — Desktop Stability Report
*Generated: 2026-05-27 | Version 0.2.0*

---

## Executive Summary

Neurotek Studio implements a **five-layer stability architecture** covering
process isolation, crash detection, auto-recovery, health monitoring, and
safe-mode degradation. After this hardening pass, **130/130 desktop tests pass**
and all known race conditions, memory leaks, and timer hangs are resolved.

---

## Architecture Layers

```
┌────────────────────────────────────────────────────────────────┐
│  Layer 1: Process Isolation                                     │
│  Plugins: forked child processes (crash = plugin only)          │
│  Audio engine: Rust subprocess (crash = restart, not freeze)   │
├────────────────────────────────────────────────────────────────┤
│  Layer 2: Crash Detection                                       │
│  - Session lock file (PID-based, detects unclean shutdown)     │
│  - Startup guard (counts crash-on-starts, offers recovery)     │
│  - Per-plugin crash counter → auto-blacklist at 3 crashes      │
├────────────────────────────────────────────────────────────────┤
│  Layer 3: Logging                                               │
│  - JSONL crash log (5MB rotation, append-only)                 │
│  - Production perf sampler (every 5 min in packaged build)     │
│  - Renderer error reporter (preload API crash.report())        │
├────────────────────────────────────────────────────────────────┤
│  Layer 4: Auto-Recovery                                         │
│  - Audio engine: up to 5 restarts, 1.5× exponential backoff   │
│  - Plugins: up to 2 restarts, 2s delay, state restored        │
│  - Autosave checkpoint: restored on next launch if crash       │
├────────────────────────────────────────────────────────────────┤
│  Layer 5: Safe Mode                                             │
│  - Activated if audio engine crashes ≥3× in one session        │
│  - Activated if audio engine exhausts all restart attempts     │
│  - Renderer notified via 'safe-mode-active' IPC event          │
│  - Startup guard shows recovery dialog after 3 crash-starts    │
└────────────────────────────────────────────────────────────────┘
```

---

## Bugs Fixed in This Pass

### 1. Double Restart Race Condition (CRITICAL)
**File**: `src/main/modules/stability.ts`

`StabilityMonitor` was listening to `proc.on('exit')` and triggering `proc.start()`,
**in addition to** the built-in restart logic already present in `AudioEngineProcess`.
This caused two concurrent restart attempts on every crash.

**Fix**: Removed the restart call from `StabilityMonitor`. The audio engine now
self-manages its own restart lifecycle. The monitor only **observes** and records.

### 2. Broken Renderer Heartbeat (CRITICAL)
**File**: `src/renderer/src/lib/stability.ts`

```typescript
// BEFORE — calls object as function (TypeError, silently fails)
await window.electronAPI?.(['stability-heartbeat', { uptime }] as any)

// AFTER — correct preload method call
await this._api.stabilityHeartbeat(uptime)
```

The renderer's heartbeat was completely non-functional, meaning the main-process
watchdog would eventually flag the renderer as unresponsive even when it was healthy.

**Fix**: Added explicit stability methods to the preload (`stabilityHeartbeat`,
`stabilityTrackOperation`, `stabilityCompleteOperation`, `stabilityGetHealth`,
`stabilityGetSafeMode`) and rewrote the renderer stability module to use them correctly.

### 3. Missing Intentional-Stop Flag (MEDIUM)
**File**: `src/main/audio/AudioEngineProcess.ts`

When `stop()` was called (e.g., on app quit), the `_onExit` handler would check
`code !== 0` to decide whether to restart. But if the engine exited with code 0,
the restart was skipped correctly. However, the SIGKILL fallback after 2s always
exits with `null` code — which was treated as a crash, triggering restart during
shutdown.

**Fix**: Added `_stopping` boolean flag set in `stop()`. The exit handler checks
this flag first and skips restart entirely if it's set.

### 4. Unbounded Command Queue (LOW)
**File**: `src/main/audio/AudioEngineProcess.ts`

Commands sent before the engine was ready accumulated in `_cmdQueue` without
a size limit. A poorly-timed flood of commands (e.g., rapid BPM changes) could
exhaust memory.

**Fix**: Added `_maxQueueSize = 64`. Commands are dropped with a warning when
the queue is full, and the queue is cleared on intentional stop.

### 5. Unref'd Timers (LOW)
**Files**: `updater.ts`, `startupGuard.ts`

Two timers — the 6-hour update recheck and the 30-second stability-mark — kept
the Node.js event loop alive unnecessarily, causing test hangs in the CI suite.

**Fix**: Added `.unref()` to both.

---

## Health Monitoring Coverage

| Component | Method | Timeout | Action on Failure |
|---|---|---|---|
| Main process RAM | `setInterval` 10s | — | Warn → notify renderer |
| Main process RAM (critical) | — | 768MB | Try V8 GC hint + error log |
| Audio engine | `proc.on('exit')` | — | Log → restart (up to 5×) |
| Audio engine heartbeat | Check every 5s | 15s | Log warning |
| Renderer heartbeat | IPC 2s | 15s | Log + send ping |
| Plugin memory | `/proc/<pid>/status` 5s | 1024MB | Warn + blacklist candidate |
| Pending operations | Check every 5s | 45s warn | Log stall |
| Startup crash loop | Counter file | 3 crashes | Recovery dialog |

---

## Safe Mode Triggers

| Trigger | Condition |
|---|---|
| Audio crash loop | ≥3 audio engine crashes in one session |
| Max restarts | Audio engine reaches 5 restart attempts |
| Startup crash | ≥3 crash-on-starts with `startupGuard` |

When safe mode is active:
- Renderer receives `safe-mode-active` IPC event with reason string
- Renderer can show a degraded-mode banner
- Audio engine is not restarted further
- Project autosave still functions

---

## Recovery Flow

```
App starts
    │
    ├─ startupGuard: count crash-starts
    │       ├─ count < 3: continue normally
    │       └─ count ≥ 3: show dialog → reset / reinstall / rollback
    │
    ├─ autosave.init(): detect unclean shutdown via session lock
    │       ├─ clean: write new lock, no recovery needed
    │       └─ dirty: load crash-checkpoint.json → notify renderer
    │
    ├─ initCrashRecovery(): load recovery-state.json
    │
    └─ renderer receives 'crash-recovery-available' → show RecoveryDialog
```

---

## Autosave System

- Autosave file path: `{userData}/autosave/autosave-YYYY-MM-DDTHH-mm-ss-msZ.json`
- Crash checkpoint: `{userData}/autosave/crash-checkpoint.json` (updated every save)
- Max 10 versions kept; oldest pruned on each save
- Session lock: `{userData}/.session-lock` (PID-tagged, cleared on clean quit)

---

## Test Coverage

```
Desktop tests: 130/130 passing (0 failures)
  Unit tests:        covers plugin-blacklist, error-reporter, formatters,
                     wav-encoder, dithering, piano-roll math, normalizer,
                     project schema, music theory
  Integration tests: recovery-flow, blacklist-flow
  Performance tests: audio buffer allocation
```

---

## Recommendations Before Beta

1. **Memory budget**: Current limit is 512MB warn / 768MB critical. Profile a
   large project (32+ tracks, 20+ plugins) to validate these thresholds.

2. **Safe mode UI**: The `safe-mode-active` event reaches the renderer but
   the UI banner is not yet implemented. Add a visible indicator.

3. **Crash report upload**: Crash logs are written locally but not uploaded.
   Integrate Sentry or a custom endpoint for production telemetry.

4. **macOS notarization**: Required for the auto-updater to work on macOS.
   The workflow is wired but the `APPLE_ID` secrets are not yet configured.

5. **Long-session memory test**: Run the app for 4+ hours with a complex project
   to validate the memory-leak detection heuristic (100MB increase over 10 samples).
