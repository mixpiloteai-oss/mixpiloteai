# Plugin Crash Recovery Report

## Architecture

### Isolation Strategy
Each plugin runs in an isolated child process (`fork()` of `plugin-host/index.ts`). A plugin crash kills only that child process — the main Electron process and all other plugins continue running.

### Recovery Flow
```
Plugin crash (child exits with non-zero code)
       │
       ▼
recordCrash(path, name) ← increments crashCount, blacklists at MAX_CRASHES=3
       │
       ▼
PluginRecovery._handleCrash()
       │
       ├── isBlacklisted? → emit plugin-recovery-abandoned (reason: blacklisted)
       │
       ├── restartCount >= MAX_AUTO_RESTART(2)? → emit plugin-recovery-abandoned (reason: max-retries)
       │
       └── wait RESTART_DELAY_MS(2000ms) → load() → restore parameters
                 │
                 ├── success → emit plugin-recovered + update recoveryMap
                 └── failure → recordCrash() → emit plugin-recovery-failed
```

### Blacklist Escalation
| Crash Count | Action                        |
|-------------|-------------------------------|
| 1           | Log, attempt recovery          |
| 2           | Log, attempt recovery (last)   |
| 3           | Auto-blacklist, no more loads  |

### State Preservation
- `pluginRecovery.saveState()` called on every parameter change
- After successful recovery, old instanceId maps to new instanceId via `recoveryMap`
- Renderer gets `plugin-recovered` event with `{ oldInstanceId, newInstanceId, parameters }`

### Hot Reload
Available via `plugin-hot-reload` IPC command:
1. Unloads existing instance
2. Waits 500ms
3. Reloads from same path
4. Maps old ID to new ID

### Process Watchdog (pluginHealth.ts)
- Polls resource usage of each plugin child process
- Emits `plugin-resource-warning` on high memory/CPU
- Resource warnings logged but don't trigger forced restart (configurable)

## Test Coverage
See `desktop-app/tests/unit/plugin-host.test.ts` for:
- Crash event dispatch verification
- Blacklisted plugin skips recovery
- Max retries prevents infinite restart loop
- 100 MIDI events dispatched without error
- 1000 automation points stress test
- 10 concurrent load/unload cycles
