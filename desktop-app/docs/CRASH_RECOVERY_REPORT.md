# Neurotek Studio — Crash Recovery Report
*Generated: 2026-05-27 | Version 0.2.0*

---

## Recovery Paths

### Path A: Unclean Main Process Shutdown

```
User opens app
    │
    ├─ autosave.init() reads .session-lock
    │       └─ Lock PID ≠ current PID → hadCrash = true
    │
    ├─ Load crash-checkpoint.json from {userData}/autosave/
    │
    ├─ Window ready → main sends 'crash-recovery-available' to renderer
    │
    └─ Renderer RecoveryDialog:
           ├─ "Restore autosave" → load crash-checkpoint.json
           └─ "Start fresh" → clear checkpoint, new project
```

### Path B: Crash-on-Startup Loop

```
App starts for 3rd time within STABLE_AFTER_MS (30s)
    │
    ├─ startupGuard reads startup-guard.json { count: 3 }
    │
    └─ Show recovery dialog (before main window):
           ├─ "Reset Settings"    → delete config.json, plugin-blacklist.json
           ├─ "Reinstall"         → open download page + quit
           ├─ "Continue Anyway"   → reset counter, continue
           └─ "Rollback Update"   → versionManager.performRollback() [if after-update]
```

### Path C: Audio Engine Crash

```
Rust audio engine exits (code ≠ 0)
    │
    ├─ AudioEngineProcess._onExit() → emit 'exit' event
    │
    ├─ StabilityMonitor receives → log + increment crashCount
    │
    ├─ AudioEngineProcess auto-restart:
    │       ├─ Attempt 1: delay 1.0s
    │       ├─ Attempt 2: delay 1.5s
    │       ├─ Attempt 3: delay 2.25s
    │       ├─ Attempt 4: delay 3.4s
    │       └─ Attempt 5: delay 5.1s → emit 'max-restarts-exceeded'
    │
    ├─ If crashCount ≥ 3 in session → activate SAFE MODE
    │       └─ Renderer receives 'safe-mode-active' → show degraded mode banner
    │
    └─ If max restarts exceeded → SAFE MODE
```

### Path D: Plugin Crash

```
Plugin child process exits unexpectedly
    │
    ├─ pluginHostManager detects exit → emit 'plugin-crashed'
    │
    ├─ pluginBlacklist.recordCrash(path, name)
    │       └─ crashCount < 3: recorded, not blacklisted
    │       └─ crashCount ≥ 3: blacklisted → no more auto-load
    │
    ├─ pluginRecovery.handleCrash():
    │       ├─ Is blacklisted? → abandon, notify renderer
    │       ├─ restartCount ≥ 2? → abandon, add to blacklist
    │       └─ Otherwise: wait 2s, reload plugin, restore parameters
    │
    └─ Renderer:
           ├─ onPluginRecovered → update plugin slot with new instanceId
           ├─ onPluginRecoveryFailed → show error toast
           └─ onPluginRecoveryAbandoned → gray out plugin slot
```

### Path E: Update Rollback

```
App installed update → crash-on-start (afterUpdate flag set)
    │
    ├─ startupGuard shows dialog with "Rollback Update" option
    │
    └─ versionManager.performRollback():
           ├─ Reads version-history.json from userData
           ├─ Finds previous stable version
           ├─ Restores backup from {userData}/backups/
           └─ Relaunches app
```

---

## State Preservation

### What Is Saved

| Data | Where | Frequency |
|---|---|---|
| Full project state | autosave-*.json | Every autosave trigger |
| Crash checkpoint | crash-checkpoint.json | Every autosave trigger |
| Plugin parameters | pluginRecovery savedStates | On plugin crash |
| Plugin blacklist | plugin-blacklist.json | On every crash |
| App settings | config.json (electron-store) | On every change |
| Audio settings | config.json | On every change |

### What Is Lost on Unclean Shutdown

- MIDI recorded during current bar (not yet committed)
- Undo history beyond the last autosave point
- Collaboration ops submitted after last server ACK (held in pendingOps)
- Audio recording buffer not yet written to disk

### Collaboration Persistence

`CollaborationClient` now persists pending (un-ACKed) ops to `sessionStorage`:

```typescript
// On op submit (before server ACK)
sessionStorage.setItem('collab-pending-ops', JSON.stringify(pendingOps))

// On reconnect / page refresh
const persisted = JSON.parse(sessionStorage.getItem('collab-pending-ops') ?? '[]')
// → reloaded into Zustand store
// → retried on next successful SSE connection
```

This ensures ops submitted while offline are not silently lost.

---

## Crash Log Format

Crash log: `{userData}/logs/crash.log` (JSONL, 5MB rotation)

```jsonc
{
  "timestamp": "2026-05-27T10:30:00.000Z",
  "appVersion": "0.2.0",
  "platform": "darwin",
  "source": "stability",
  "message": "audio: exited with code 1 signal null",
  "stack": undefined,
  "meta": {
    "kind": "stability-alert",
    "source": "audio"
  }
}
```

Sources: `"main"` | `"renderer"` | `"plugin"` | `"audio"` | `"stability"`

---

## Recovery Attempt Tracking

```typescript
// recovery-state.json
{
  "projectId": "my-track",
  "lastCheckpoint": 1748340600000,
  "attemptCount": 1,
  "recoveryLog": [
    {
      "timestamp": "2026-05-27T10:30:00.000Z",
      "action": "restore-from-checkpoint",
      "success": true
    }
  ]
}
```

- Max 3 recovery attempts per project
- After 3 failures: abandon recovery, start fresh (with notification)
- Old crash markers (> 7 days) cleaned up on each startup

---

## Safe Mode Details

Safe mode is a **degraded-but-stable** operating state:
- Audio engine does **not** restart further
- Web Audio (renderer) continues to work for preview/editing
- Autosave continues (project is never lost)
- Collaboration continues
- User can manually restart audio from Settings

Safe mode does **not**:
- Kill the app
- Clear the project
- Prevent new project creation

To exit safe mode: restart the application.

---

## Autosave Triggering

Autosave is triggered by the renderer calling `autosaveSaveNow(data)` via preload.

**Suggested trigger points** (currently renderer-controlled):
- Every 60 seconds (configurable)
- Before any destructive operation (delete track, delete clips)
- On `power-event: suspend` (system sleep)
- On `trigger-save` (Cmd/Ctrl+S)
- Before plugin hot-reload

**Current checkpoint timing**: Checkpoint is updated on every `autosave-save-now`
call — so the worst-case data loss is one autosave interval.

---

## Test Coverage

```
Integration tests:
  recovery-flow:   ✅ Session lock crash detection, checkpoint load
  blacklist-flow:  ✅ Plugin crash counting, auto-blacklist, removal

Unit tests:
  error-reporter:  ✅ Append, read, rotate (5MB), concurrent writes
  plugin-blacklist: ✅ Record, threshold, remove, persistence

Pending (manual testing required):
  - Crash-on-startup loop (3 rapid crashes → dialog)
  - Update rollback (after update → crash → rollback)
  - Plugin state preservation after hot reload
  - Collaboration pending ops retry after reconnect
```

---

## Recommendations

1. **Sentry integration**: Wire `logCrash()` to also upload to Sentry with
   `beforeSend` to strip PII from stack traces. Allows remote crash monitoring.

2. **Recovery dialog polish**: The `RecoveryDialog` component exists in
   `src/renderer/src/components/save/RecoveryDialog.tsx` but the visual design
   should clearly show: what was saved, when, and the project state summary.

3. **Autosave interval configurability**: Expose in Settings → General.
   Default: 60s. Range: 10s – 300s. Short intervals increase disk I/O;
   long intervals increase potential data loss.

4. **Test platform-specific crashes**: Audio engine crashes differ between
   platforms (WASAPI/ASIO vs CoreAudio vs JACK). Ensure all recovery paths
   are exercised on all target platforms.

5. **Crash-free session streak**: Track consecutive crash-free sessions in
   the startup guard file. Show a "stability badge" in the status bar after
   10 clean sessions — gives users confidence and helps with support triage.
