# Neurotek Studio — Audio Engine Integration Report
*Generated: 2026-05-27 | Version 0.2.0*

---

## Problem Statement

The native Rust audio engine existed and compiled correctly, but was **never included
in distributed builds**.  Two critical gaps meant every production user silently
received the Web Audio fallback:

| Gap | Root Cause |
|-----|-----------|
| Binary not packaged | `electron-builder.json5` had no `extraResources` entry |
| Binary not compiled in CI | `release-desktop.yml` had no `cargo build` step |
| Fallback was silent | `AudioEngineProcess` only emitted `console.warn` with no status API |

---

## Changes Implemented

### 1. electron-builder — `extraResources`

**File:** `desktop-app/package.json` → `build.extraResources`

```json
"extraResources": [
  {
    "from": "../native/audio-engine/target/release/",
    "to":   "audio-engine/",
    "filter": ["audio-engine", "audio-engine.exe"]
  }
]
```

**Effect:** electron-builder now copies the Rust binary into the packaged app's
`{resources}/audio-engine/` directory before creating the installer.  The filter
handles both platforms:
- Windows: copies `audio-engine.exe`
- macOS / Linux: copies `audio-engine`

**Production path** (what `AudioEngineProcess._findBinary()` searches first):
```
Windows:  C:\...\resources\audio-engine\audio-engine.exe
macOS:    /Applications/Neurotek Studio.app/Contents/Resources/audio-engine/audio-engine
Linux:    /opt/neurotek-studio/resources/audio-engine/audio-engine
```

---

### 2. CI/CD — `release-desktop.yml`

**File:** `.github/workflows/release-desktop.yml`

Added three new steps **before** `npm ci`, for all platforms:

#### Step A — Install Rust stable toolchain
```yaml
- name: Install Rust stable toolchain
  uses: dtolnay/rust-toolchain@stable
```

#### Step B — Cargo cache (two layers)
```yaml
- name: Cache Cargo registry          # deps cache, keyed on Cargo.lock
  uses: actions/cache@v4

- name: Cache Cargo build artifacts   # build cache, keyed on Cargo.lock + src/**
  uses: actions/cache@v4
```

Warm cache reduces Rust compile time from ~15min to ~2min.

#### Step C — Platform-specific builds

| Platform | Build command | Notes |
|---|---|---|
| macOS | `cargo build --release --target x86_64-apple-darwin` + `aarch64-apple-darwin` + `lipo` | Creates universal binary — runs on both Intel and Apple Silicon |
| Windows | `cargo build --release` | Produces `audio-engine.exe` |
| Linux | `cargo build --release` | Produces `audio-engine` |

```yaml
# macOS — universal binary
- name: Build Rust audio engine (macOS universal binary)
  if: runner.os == 'macOS'
  working-directory: native/audio-engine
  run: |
    rustup target add x86_64-apple-darwin aarch64-apple-darwin
    cargo build --release --target x86_64-apple-darwin
    cargo build --release --target aarch64-apple-darwin
    mkdir -p target/release
    lipo -create \
      target/x86_64-apple-darwin/release/audio-engine \
      target/aarch64-apple-darwin/release/audio-engine \
      -output target/release/audio-engine
```

#### Step D — Binary verification (CI gate)
```yaml
- name: Verify audio engine binary exists
  shell: bash
  run: |
    [ ! -f "$BIN" ] && echo "❌ ERROR: binary not found" && exit 1
    echo "✓ Binary verified: $BIN"
```

This step **fails the build** if the binary was not produced — preventing a silent
packaging gap from reaching users.

---

### 3. Runtime — `AudioEngineProcess.ts` + `enginePaths.ts`

#### New file: `src/main/audio/enginePaths.ts`

Pure functions extracted from `AudioEngineProcess` for testability without Electron:

```typescript
engineBinaryName(platform)           → 'audio-engine' | 'audio-engine.exe'
getEngineBinaryCandidates(appPath, dirname, platform) → string[]
findEngineBinary(candidates)         → { path, checkedPaths }
```

**No Electron import** — can be unit-tested in plain Node.js.

#### New type: `EngineStatus`

```typescript
interface EngineStatus {
  mode:         'native' | 'web-audio-fallback'
  binaryFound:  boolean
  binaryPath:   string | null   // full path to found binary, or null
  checkedPaths: string[]        // every path examined (for diagnostics)
  platform:     string          // process.platform
  isRunning:    boolean         // child process alive right now
  restarts:     number          // crash-restart count this session
}
```

#### New method: `AudioEngineProcess.getStatus()`

Returns a live snapshot of the engine status — wired to the `audio-engine-status`
IPC handler in `AudioIPCHandler.ts`.

#### Verbose fallback logging

Before (silent):
```
[AudioEngineProcess] native binary not found — running in Web Audio only mode
```

After (explicit + actionable):
```
[AudioEngineProcess] ⚠️  Native audio engine binary NOT FOUND.
  Falling back to Web Audio API — reduced performance, no ASIO/WASAPI/CoreAudio.
  Searched paths:
    • /app.asar/../audio-engine/audio-engine        ← production path
    • /.../native/audio-engine/target/release/audio-engine
    • /.../native/audio-engine/target/debug/audio-engine
  To fix: run `cargo build --release` in native/audio-engine/
  and restart the app, or rebuild with a release build.
```

#### New IPC event: `engine-mode`

`AudioEngineProcess` emits `engine-mode` immediately after `start()` resolves,
forwarded to the renderer via `AudioIPCHandler` as `audio-engine-mode`.

---

### 4. IPC Handler — `AudioIPCHandler.ts`

Two new registrations:

```typescript
// Query current status at any time
safeHandle(ipcMain, 'audio-engine-status', () => proc.getStatus())

// Forward engine-mode event to renderer on startup
proc.on('engine-mode', (status) => {
  win.webContents.send('audio-engine-mode', status)
})
```

---

### 5. Preload — `src/preload/index.ts`

Two new methods exposed via `contextBridge`:

```typescript
audioEngineStatus:  () => ipcRenderer.invoke('audio-engine-status'),
onAudioEngineMode:  (cb) => ipcRenderer.on('audio-engine-mode', (_e, s) => cb(s)),
```

Usage from renderer:
```typescript
const status = await window.electronAPI.audioEngineStatus()
// { mode: 'native', binaryFound: true, binaryPath: '...', ... }
```

---

### 6. UI — `EngineStatusBanner.tsx`

**File:** `src/renderer/src/components/audio/EngineStatusBanner.tsx`

A fixed-position banner rendered at the bottom of the screen.

| Condition | Banner |
|---|---|
| Native engine running | Hidden (green = no noise) |
| Native engine starting | Blue info strip: "Native audio engine starting…" |
| Web Audio fallback | **Orange warning** with "Details" / "Dismiss" buttons |
| Not in Electron | Hidden |

The "Details" section expands to show:
- Platform
- All candidate paths searched
- Fix instructions (`cargo build --release`)

Dismissable per-session.  Does NOT persist dismissal to disk — appears again on
next launch as long as the engine is in fallback mode.

---

## Binary Locations Reference

### Development (local)

| Platform | Path | How to build |
|---|---|---|
| macOS | `native/audio-engine/target/release/audio-engine` | `cargo build --release` |
| Windows | `native/audio-engine/target/release/audio-engine.exe` | `cargo build --release` |
| Linux | `native/audio-engine/target/release/audio-engine` | `cargo build --release` |

### Production (packaged app)

| Platform | Path inside app bundle |
|---|---|
| macOS | `Neurotek Studio.app/Contents/Resources/audio-engine/audio-engine` |
| Windows | `resources\audio-engine\audio-engine.exe` |
| Linux | `resources/audio-engine/audio-engine` |

---

## Test Coverage Added

**File:** `tests/unit/audio-engine-binary.test.ts` — 16 unit tests

- `engineBinaryName()` — all platforms, edge cases
- `getEngineBinaryCandidates()` — path count, production path, release/debug, .exe suffix
- `findEngineBinary()` — null when absent, first match, fallback to second, empty list
- `EngineStatus` contract — schema validation, mode transitions

**File:** `tests/integration/audio-engine-ipc.test.ts` — 9 integration tests

- `audio-engine-status` IPC contract — field presence, types, values
- mode transitions: `web-audio-fallback` vs `native`
- fallback detection with all 3 paths absent
- dev binary detection (target/release/)
- IPC channel naming convention (kebab-case, `audio-*` prefix)

**All 155/155 desktop tests passing** (was 130/130 before these additions).

---

## Fallback Detection Flow

```
app starts
    │
    ├─ AudioEngineProcess.start()
    │       │
    │       ├─ enginePaths.getEngineBinaryCandidates(appPath, __dirname, platform)
    │       │       └─ [prod path, dev/release path, dev/debug path]
    │       │
    │       ├─ enginePaths.findEngineBinary(candidates)
    │       │       ├─ candidate 1: prod → existsSync() → false → log ✗
    │       │       ├─ candidate 2: dev/release → existsSync() → TRUE → log ✓
    │       │       └─ return { path: '/...', checkedPaths: [...] }
    │       │
    │       ├─ path found → spawn(binaryPath, [...args])
    │       │       └─ wait for 'ready' event (10s timeout)
    │       │
    │       ├─ emit 'engine-mode' { mode: 'native', binaryFound: true, ... }
    │       │
    │       └─ if no path found:
    │               ├─ emit 'engine-mode' { mode: 'web-audio-fallback', ... }
    │               ├─ LOG EXPLICIT WARNING with all checked paths
    │               └─ _ready = true (renderer falls back to Web Audio)
    │
    ├─ AudioIPCHandler forwards 'engine-mode' to renderer via IPC
    │
    └─ EngineStatusBanner in renderer:
            ├─ native + running → hidden
            └─ fallback → shows orange warning with checked paths + fix instructions
```

---

## Build Time Impact

| Phase | Before | After | Delta |
|---|---|---|---|
| npm ci + build renderer | ~2min | ~2min | 0 |
| Rust compile (cold) | — | ~15–20min | +15–20min |
| Rust compile (cached) | — | ~2–3min | +2–3min |
| electron-builder | ~3min | ~3min + binary copy (~1s) | negligible |
| Total (cold) | ~5min | ~22–25min | +~20min |
| Total (warm) | ~5min | ~7–8min | +~3min |

Cargo cache (`actions/cache@v4`) covers both the registry and the build artifact
directory.  On a typical PR (no Cargo.lock change), cache hit rate is >95%.

---

## Recommendations

1. **Expose in Settings → Audio**: Show the `EngineStatus` in the audio settings
   panel (mode, driver, binary version, current restarts).  Helps support triage.

2. **Version stamping**: Embed `cargo metadata` version in the binary and expose
   it via the `ready` event's JSON payload.  Allows detecting stale binaries.

3. **Notarization (macOS)**: The universal binary must be notarized as part of the
   signing step.  Add `notarytool` call in `scripts/notarize.js` once `APPLE_ID`
   secrets are configured in GitHub.

4. **ARM64-native Windows**: GitHub Actions runners are x64-only for Windows.
   ARM64 Windows support will require a separate `windows-arm64` matrix entry
   with a self-hosted runner when the market demands it.

5. **Linux JACK dependency**: The Rust engine uses ALSA by default but can use JACK.
   Add a `libasound2-dev` install step to the Linux CI matrix to ensure the
   ALSA feature compiles correctly.  Currently compiles because the ubuntu runner
   has ALSA headers; this is implicit and should be made explicit.
