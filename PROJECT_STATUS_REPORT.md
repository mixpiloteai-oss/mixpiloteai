# Project Status Report — Neurotek Studio
Generated: 2026-06-04

---

## Executive Summary

Neurotek Studio is an Electron + React + TypeScript desktop DAW targeting electronic music production (specifically the "mentalcore / hardtek" genre). The project is a TypeScript monorepo containing five active sub-packages: `desktop-app` (the main Electron application), `backend` (Node.js/Express API), `website` (marketing + admin site), `e2e` (Playwright tests), and `native/audio-engine` (a Rust binary for low-latency audio I/O). Two additional folders — `electron/` and `frontend/` — are **legacy JavaScript versions** that pre-date the current TypeScript rewrite and are no longer part of CI.

The project is at **pre-alpha / advanced prototype** stage. The DAW shell, arrangement view, mixer, piano roll, transport, and audio engine are functionally complete with real Web Audio API integration. The backend has production-grade auth, billing (Stripe + PayPal), quota, and collaboration infrastructure. However, critical DAW features — audio recording, VST hosting, live clip launching, routing matrix, collaboration real-time sync, and the native Rust audio engine integration — are either prototypes using hardcoded seed data or incomplete bridges. The project is not production-ready.

The biggest gaps are: (1) all "interactive" views except Arrangement and Mixer use static hardcoded data; (2) the native Rust audio engine exists and compiles, but the renderer still uses `WebAudioBridge` — the `NativeAudioBridge` is `// Future` per the source comment; (3) the `electron/` legacy folder and `frontend/` legacy folder add confusion and dead weight; (4) collaborative editing has a full OT/CRDT-style store but the `CollaborationClient` connects to a `'demo-project'` room unconditionally.

---

## Project Architecture

```
mixpiloteai/
├── desktop-app/                  # ACTIVE — Electron + React + TypeScript DAW (v0.3.2)
│   ├── src/main/                 # Electron main process (Node.js)
│   │   ├── index.ts              # IPC handler registration + window lifecycle
│   │   ├── audio/                # Native audio engine process management + watchdog
│   │   ├── modules/              # autosave, crash recovery, VST, MIDI, store, updater
│   │   ├── recording/            # WAV/FLAC recording file management + IPC
│   │   ├── safety/               # Project safety manager, backup rotator, crash guard
│   │   ├── samples/              # Sample database + file scanner + IPC
│   │   ├── export/               # FFmpeg transcoder (MP3/FLAC/AAC/OGG)
│   │   └── vst/                  # VstHost, VstScanner, VstSandbox, VstCrashGuard
│   ├── src/preload/index.ts      # Electron contextBridge — exposes electronAPI to renderer
│   └── src/renderer/src/         # React app (467 source files)
│       ├── App.tsx               # Auth gate, DAWShell, view router
│       ├── audio/                # Web Audio engine (Transport, MixerEngine, MIDI, export, VST bridge)
│       ├── components/           # 40+ component directories
│       ├── store/                # 38 Zustand stores
│       ├── hooks/                # useTransportSync, useSaveSystem, useCollaboration, etc.
│       ├── services/             # CollaborationClient, CloudSyncEngine, offlineAI, etc.
│       └── lib/                  # apiClient, config, bootLogger
│
├── backend/                      # ACTIVE — Express + TypeScript API (deployed on Railway)
│   ├── src/app.ts                # Express app (routes, middleware), no listen()
│   ├── src/index.ts              # Server entry point (listen)
│   ├── src/routes/               # 26 route files (auth, ai, payments, collab, etc.)
│   ├── src/middleware/           # auth, quota, rate limiter, anti-abuse, prompt injection guard
│   ├── src/services/             # aiGateway, stripeService, paypalService, collaborationService
│   ├── src/repositories/         # Supabase repository layer (with in-memory fallback)
│   ├── src/data/mockDB.ts        # In-memory fallback + Supabase adapter
│   ├── supabase/schema.sql       # Database schema
│   └── migrations/               # 7 SQL migrations (001–007)
│
├── website/                      # ACTIVE — Vite/React marketing + admin portal
│   └── src/pages/                # Landing, Pricing, Download, Marketplace, Admin/*
│
├── native/audio-engine/          # ACTIVE — Rust low-latency audio engine (child process)
│   └── src/                     # WASAPI/ASIO/CoreAudio drivers, plugin host, IPC protocol
│
├── ai-service/                   # PARTIAL — Python FastAPI local AI microservice
│   └── main.py                   # Endpoints for chat, template gen, kick/acid generation
│
├── e2e/                          # ACTIVE — Playwright tests (website + desktop)
│   └── tests/                    # smoke, pricing, checkout, admin, subscriptions, desktop-ui
│
├── electron/                     # LEGACY — Old plain-JS Electron shell (v1.0.0-beta.1)
├── frontend/                     # LEGACY — Old React frontend (v0.1.0)
│
├── .github/workflows/            # 5 CI/CD workflows
└── infra/                        # nginx config (placeholder)
```

---

## Feature Status Matrix

| Feature | Module | Status | Notes |
|---------|--------|--------|-------|
| Auth gate (login / demo) | `App.tsx` | FUNCTIONAL | Demo login sets `token='demo'`; Electron auto-sets `token='local'`; real login hits `/api/auth/login` |
| DAW shell layout | `DawLayout`, `Sidebar`, `TitleBar`, `TransportBar`, `StatusBar` | FUNCTIONAL | Full 4-panel layout with resize handles |
| Transport (play/stop/loop/BPM) | `transportStore` + `Transport.ts` + `Clock.ts` | FUNCTIONAL | Real AudioContext clock, rAF sync via `useTransportSync` |
| Metronome | `MetronomeEngine.ts` | FUNCTIONAL | Enabled/disabled via transport store |
| Arrangement view | `ArrangementCanvas.tsx`, `TrackHeaders.tsx` | FUNCTIONAL | Canvas-based clip rendering, drag/move/resize/split, automation lanes |
| Mixer | `MixerView.tsx`, `ChannelStrip.tsx`, `BusStrip.tsx` | FUNCTIONAL | Real gain/pan/mute/solo, VU metering, spectrum analyzer, bus routing |
| Piano Roll | `PianoRollView.tsx`, `NoteGrid.tsx`, `VelocityLane.tsx` | FUNCTIONAL | MIDI note editing, arpeggiator, scale panel, AI panel |
| Web Audio engine | `AudioEngine.ts`, `MixerEngine.ts`, `ChannelStrip.ts` | FUNCTIONAL | Master bus, channel strips, compressor, analyser |
| Clip system | `clipStore`, `projectStore`, `ClipEngine.ts` | FUNCTIONAL | Add/delete/split/duplicate/consolidate/stretch clips |
| Undo/redo | `historyStore.ts` | FUNCTIONAL | 100-entry stack, per-domain, anti-corruption guard |
| Auto-save | `useSaveSystem`, `AutoSaveEngine.ts`, IPC handlers | FUNCTIONAL | Dirty tracking, 30s interval, crash recovery integration |
| Crash recovery | `RecoveryDialog.tsx`, main process `crashRecovery.ts` | FUNCTIONAL | Detects prior crash, offers restore |
| Project snapshot history | `SnapshotHistoryPanel.tsx`, `saveStore` | FUNCTIONAL | UI exists, wired to save system |
| Export (WAV/MP3/FLAC/stems) | `ExportPanel.tsx`, `ExportPipeline.ts`, `FfmpegTranscoder.ts` | FUNCTIONAL | Full pipeline: normalise, dither, encode; MP3/FLAC via FFmpeg IPC |
| VST browser UI | `PluginBrowser/`, `vstStore.ts`, `VstHost.ts` | PARTIAL | IPC layer complete; scan/list/load/parameters/windows fully wired; real VST3 loading requires native binary + host linking |
| VST3 native host | `VstHost.ts`, `VstScanner.ts`, `VstSandbox.ts` | PARTIAL | Architecture in place (sandboxed child process per plugin); actual VST3 SDK bridging requires platform-specific native addon not present in repo |
| Live Mode (clip launcher) | `LiveMode.tsx` | PROTOTYPE | 6×8 hardcoded clip grid; BPM not wired to transport store; no real playback |
| Routing Matrix | `RoutingMatrix.tsx` | PROTOTYPE | Static hardcoded nodes; toggle updates local state only; no real audio routing connection |
| AI Assistant (chat) | `AIAssistant.tsx` | PARTIAL | Online mode hits `/api/ai/generate`; offline mode uses `offlineAI.ts` heuristics; no real AI pattern insertion into arrangement |
| AI Local Analysis | `LocalAIPanel.tsx`, `useLocalAI.ts`, local audio analysis engines | FUNCTIONAL | Real waveform / spectrum / structure analysis via Web Audio API; no cloud required |
| Collaboration | `CollabPanel.tsx`, `collaborationStore.ts`, `CollaborationClient.ts` | PARTIAL | OT-style op store fully typed; client connects to fixed `'demo-project'` room; backend `/api/collab` routes exist; not integrated to projectStore mutations |
| Marketplace browser | `MarketplaceBrowser.tsx`, `marketplaceStore.ts` | PARTIAL | UI complete with search/filter/download UI; data loaded from backend `/api/marketplace`; download/install flow uses store but no real file extraction |
| Performance mode | `performanceModeStore.ts`, `usePerformanceMode.ts`, `performance.css` | FUNCTIONAL | Low PC / Studio / Live GPU modes applied via `data-perfMode` attribute |
| Sample browser | `sampleBrowserStore.ts`, `SampleDatabase` (main process) | PARTIAL | UI exists; IPC wired to main process file scanner; preview engine in place |
| Audio recording | `RecordingEngine.ts`, `recordingStore.ts`, `RecordingIPC.ts` | PARTIAL | Take management, input device, WAV/FLAC writing in main process all coded; renderer UI exists but recording loop not fully connected to transport |
| MIDI device routing | `MidiDeviceManager.ts`, `MidiLearnManager.ts`, `midiStore.ts` | PARTIAL | MIDI engine, arpeggiator, step sequencer, learn manager all present; live hardware MIDI I/O depends on Electron + WebMIDI |
| Native Rust audio engine | `native/audio-engine/`, `AudioEngineProcess.ts`, `AudioBridge.ts` | PARTIAL | Rust binary builds (WASAPI/ASIO/CoreAudio drivers); IPC protocol defined; `AudioEngineProcess` spawns it; renderer still uses `WebAudioBridge` — `NativeAudioBridge` is marked `// Future` |
| Cloud sync | `CloudSyncEngine.ts`, `cloudSyncStore.ts`, `/api/cloud-sync` | PARTIAL | Service and store exist; initCloudSync called with projectId; backend route exists; not tested end-to-end |
| Onboarding | `OnboardingWelcome.tsx`, `onboardingStore.ts` | FUNCTIONAL | Multi-step wizard shown on first launch |
| Welcome dashboard | `WelcomeDashboard.tsx` | FUNCTIONAL | Template picker, recent projects |
| Update banner | `UpdateBanner.tsx`, `updater module` | FUNCTIONAL | Checks for updates via `electron-updater` |
| Subscription gating | `subscriptionStore.ts` | FUNCTIONAL | Fetches from `/api/subscriptions/status` on login; cached in localStorage |
| Keyboard shortcuts | `hotkeys/`, `ShortcutsPanel.tsx` | FUNCTIONAL | Comprehensive shortcut map rendered in F1 panel |
| Performance HUD | `AudioPerfHUD.tsx`, `PerformanceMonitor.ts` | FUNCTIONAL | Ctrl+Shift+P shows real-time audio stats |
| Admin dashboard (website) | `website/src/pages/Admin/*` | FUNCTIONAL | Full admin panel with users, subscriptions, analytics, payments, monitoring |
| Backend auth | `/api/auth/*` | FUNCTIONAL | JWT + refresh tokens, bcrypt, session management, email verification flow |
| Backend AI gateway | `/api/ai/*` | FUNCTIONAL | Quota-gated, rate-limited, prompt injection guard, Ollama local + cloud routing |
| Backend payments | `/api/payments/*` | FUNCTIONAL | Stripe + PayPal, webhooks, VAT, fraud check |
| Backend collaboration | `/api/collab/*`, `/api/teams/*` | FUNCTIONAL | Persistent ops, presence, chat, team management |

---

## UI Components Inventory

### Shell
| Path | Purpose | Status |
|------|---------|--------|
| `components/shell/TitleBar.tsx` | Custom window title bar with controls | FUNCTIONAL |
| `components/shell/Sidebar.tsx` | Navigation sidebar with view icons | FUNCTIONAL |
| `components/shell/StatusBar.tsx` | Bottom status bar (FPS, memory, network, audio) | FUNCTIONAL |
| `components/shell/MainMenu.tsx` | Top menu bar | FUNCTIONAL |
| `components/shell/QuickActionsBar.tsx` | Quick action buttons row | FUNCTIONAL |

### Transport
| Path | Purpose | Status |
|------|---------|--------|
| `components/transport/TransportBar.tsx` | Play/stop/record/loop/BPM/time sig | FUNCTIONAL |

### Arrangement
| Path | Purpose | Status |
|------|---------|--------|
| `components/arrangement/ArrangementView.tsx` | Container for arrangement + minimap | FUNCTIONAL |
| `components/arrangement/ArrangementCanvas.tsx` | Canvas clip rendering + drag/resize | FUNCTIONAL |
| `components/arrangement/TrackHeaders.tsx` | Left panel track headers | FUNCTIONAL |
| `components/arrangement/TimeRuler.tsx` | Bar/beat ruler | FUNCTIONAL |
| `components/arrangement/ArrangementMiniMap.tsx` | Overview minimap | FUNCTIONAL |
| `components/arrangement/AutomationLaneView.tsx` | Automation lane overlay | FUNCTIONAL |

### Mixer
| Path | Purpose | Status |
|------|---------|--------|
| `components/mixer/MixerView.tsx` | Full mixer with channel strips + bus strips + spectrum | FUNCTIONAL |
| `components/mixer/ChannelStrip.tsx` | Per-track fader, pan, EQ, sends | FUNCTIONAL |
| `components/mixer/SpectrumCanvas.tsx` | Real-time spectrum visualization | FUNCTIONAL |

### Piano Roll
| Path | Purpose | Status |
|------|---------|--------|
| `components/piano-roll/PianoRollView.tsx` | Full piano roll editor | FUNCTIONAL |
| `components/piano-roll/NoteGrid.tsx` | MIDI note canvas | FUNCTIONAL |
| `components/piano-roll/PianoKeys.tsx` | Piano keyboard on left | FUNCTIONAL |
| `components/piano-roll/VelocityLane.tsx` | Velocity editor lane | FUNCTIONAL |
| `components/piano-roll/ArpPanel.tsx` | Arpeggiator controls | FUNCTIONAL |
| `components/piano-roll/ScalePanel.tsx` | Scale snap | FUNCTIONAL |
| `components/piano-roll/AIPanel.tsx` | AI pattern suggestions in piano roll | PARTIAL |

### Views (Main Area)
| Path | Purpose | Status |
|------|---------|--------|
| `components/live/LiveMode.tsx` | Clip launcher | PROTOTYPE — hardcoded data |
| `components/routing/RoutingMatrix.tsx` | Audio routing | PROTOTYPE — hardcoded, no real routing |
| `components/ai-assistant/AIAssistant.tsx` | AI chat panel | PARTIAL |
| `components/ai-local/LocalAIPanel.tsx` | Local mix analysis | FUNCTIONAL |
| `components/performance/PerformanceModeSelector.tsx` | Perf mode selector | FUNCTIONAL |
| `components/export/ExportPanel.tsx` | Export studio | FUNCTIONAL |
| `components/collaboration/CollabPanel.tsx` | Realtime collab | PARTIAL |
| `components/marketplace/MarketplaceBrowser.tsx` | Pack/sample marketplace | PARTIAL |
| `components/plugin-browser/PluginBrowser.tsx` | VST browser | PARTIAL |

### Save/Recovery
| Path | Purpose | Status |
|------|---------|--------|
| `components/save/RecoveryDialog.tsx` | Crash recovery dialog | FUNCTIONAL |
| `components/save/SnapshotHistoryPanel.tsx` | Save snapshot browser | FUNCTIONAL |

### Onboarding / Help
| Path | Purpose | Status |
|------|---------|--------|
| `components/onboarding/OnboardingWelcome.tsx` | First-run wizard | FUNCTIONAL |
| `components/welcome/WelcomeDashboard.tsx` | Template/project picker | FUNCTIONAL |
| `components/help/ShortcutsPanel.tsx` | Keyboard shortcuts reference | FUNCTIONAL |
| `components/help/UserGuidePanel.tsx` | User guide | FUNCTIONAL |

### Layout
| Path | Purpose | Status |
|------|---------|--------|
| `components/layout/DawLayout.tsx` | 4-panel resizable layout (arrangement + mixer + browser + inspector) | FUNCTIONAL |

### Safety/Perf
| Path | Purpose | Status |
|------|---------|--------|
| `components/audio/AudioPerfHUD.tsx` | Audio performance HUD (Ctrl+Shift+P) | FUNCTIONAL |
| `components/perf/PerformanceOverlay.tsx` | Full perf overlay (F12) | FUNCTIONAL |
| `components/updater/UpdateBanner.tsx` | App update notification banner | FUNCTIONAL |
| `components/SafeViewBoundary.tsx` | Error boundary for each view | FUNCTIONAL |

---

## Zustand Stores Inventory

| Store | Key State | Key Actions | Consumers |
|-------|-----------|-------------|-----------|
| `projectStore` | `project` (tracks, clips, BPM, loop), `selectedTrackId`, `selectedClipId` | `moveClip`, `splitClip`, `duplicateClips`, `addTrack`, `rippleShiftClips` | Arrangement, Mixer, Piano Roll, Transport, LiveMode |
| `uiStore` | `activeView`, `aiPanelOpen`, `activeTool`, `zoomX/Y`, `scrollOffsetBars` | `setView`, `toggleAIPanel`, `setActiveTool`, `cycleTool` | App, DAWShell, Sidebar, TransportBar |
| `transportStore` | `playing`, `bpm`, `looping`, `positionBar/Beat/Tick`, `metronomeEnabled` | `play`, `stop`, `setBpm`, `toggleLoop`, `setLoopRegion` | TransportBar, App (useTransportSync) |
| `layoutStore` | `mode` (simple/advanced), `panelSizes` (browser/mixer/inspector open) | `setMode`, `toggleBrowser`, `toggleMixer`, `setPanelSize` | DawLayout |
| `saveStore` | `status` (state, isDirty, lastSavedAt), `historyOpen` | `setStatus`, `toggleHistory` | StatusBar, SnapshotHistoryPanel |
| `historyStore` | `past[]`, `future[]`, `canUndo`, `canRedo` | `push`, `undo`, `redo` | Hotkeys, menus |
| `vstStore` | `plugins[]`, `loadedInstances`, `scanning`, `favorites`, `collections` | `scanPlugins`, `loadInstance`, `addFavorite`, `createCollection` | PluginBrowser |
| `midiStore` | `devices[]`, `assignments`, `arpConfig`, `seqTracks`, `drumPads` | `setArpConfig`, `addAssignment`, `setSeqStep` | MIDI panel, piano roll |
| `recordingStore` | `armedTracks`, `recordingStates`, `takes`, `inputDevices`, `punchIn/Out` | `armTrack`, `addTake`, `setInputDevice`, `toggleMonitor` | Recording UI |
| `collaborationStore` | `connected`, `presence[]`, `chatMessages[]`, `comments[]`, `opLog[]` | `addPresence`, `receiveOp`, `sendChat`, `addComment`, `resolveComment` | CollabPanel |
| `subscriptionStore` | `plan`, `status`, `isActive`, `isPremium`, `daysRemaining` | `setSubscription`, `reset` | App, gated features |
| `marketplaceStore` | `products[]`, `installed[]`, `downloads[]`, `likedIds`, `searchQuery` | `loadProducts`, `purchaseProduct`, `downloadProduct` | MarketplaceBrowser |
| `cloudSyncStore` | `status`, `conflict`, `pendingCount`, `isOnline` | `setStatus`, `setConflict`, `setOnline` | StatusBar, CloudSync service |
| `localAIStore` | `result`, `analyzing` | `setResult`, `setAnalyzing` | LocalAIPanel |
| `onboardingStore` | `hasSeenWelcome`, `completedSteps` | `markWelcomeSeen`, `completeStep` | App, OnboardingWelcome |
| `performanceModeStore` | `mode` (eco/normal/performance/ultra) | `setMode` | App, PerformanceModeSelector |
| `perfMonitorStore` | `fps`, `cpuMs`, `memoryMB`, `monitoring` | `startMonitoring`, `stopMonitoring` | App, AudioPerfHUD, PerformanceOverlay |
| `networkStore` | `isOnline`, `aiAvailable`, `latencyMs` | `setOnline`, `setAiAvailable` | AIAssistant, StatusBar |
| `exportStore` | `history[]`, `currentExport`, `queue` | `addHistory`, `setCurrentExport` | ExportPanel |
| `pluginStore` | `plugins[]`, `loading`, `error` | `loadPlugins`, `installPlugin` | MarketplaceBrowser |
| `sampleBrowserStore` | `samples[]`, `scanning`, `searchQuery`, `filters` | `scanDirectory`, `search`, `preview` | Sample browser panel |
| `safetyStore` | `safetyStatus`, `lastSaveAt`, `recoveryAvailable` | `setSafetyStatus`, `markClean` | Safety system |
| `aiAssistantStore` | `messages[]`, `generating`, `history` | `addMessage`, `setGenerating` | AIAssistant |
| `aiHubStore` | `activeModule`, `suggestions[]` | `setActiveModule`, `addSuggestion` | AI Hub components |
| `deepAIStore` | `analysis`, `analyzing`, `lastAnalyzedAt` | `setAnalysis`, `setAnalyzing` | Deep AI panel |
| `automationStore` | `lanes[]`, `selectedLane`, `recordingEnabled` | `addLane`, `setPoint`, `toggleRecord` | AutomationLaneView |
| `workflowStore` | `currentTemplate`, `tips[]`, `completed` | `applyTemplate`, `dismissTip` | Workflow components |
| `sessionStore` | `sessionId`, `startedAt`, `activityLog[]` | `startSession`, `logActivity` | Analytics |
| `backupStore` | `backups[]`, `lastBackupAt` | `addBackup`, `restoreBackup` | Backup panel |
| `renderQueueStore` | `queue[]`, `processing` | `addToQueue`, `processNext` | Export queue |
| `engineExportStore` | `exportState`, `progress` | `startExport`, `setProgress` | Export engine integration |
| `generationStore` | `patterns[]`, `generating` | `addPattern`, `setGenerating` | AI generation UI |
| `mixAssistantStore` | `suggestions[]`, `analysis` | `addSuggestion`, `setAnalysis` | Mix assistant panel |
| `clipStore` | `selectedClips`, `clipboard`, `snapMode` | `selectClip`, `copyClips`, `paste` | Arrangement |
| `audioEditorStore` | `editRegion`, `waveform`, `zoom` | `setRegion`, `setZoom` | Sample editor |
| `browserStore` | `path`, `files[]`, `previewing` | `navigate`, `preview`, `addFavorite` | Sample browser |

---

## Audio Engine

The audio engine is split across three layers:

### Layer 1 — Web Audio API (renderer process, always active)
- **`AudioEngine.ts`** — Singleton managing `AudioContext`, master gain, limiter compressor, analyser. Provides `masterInput` node for track connections. Suspends on tab-hide.
- **`Transport.ts`** — Playback clock using `AudioContext.currentTime`. Handles play/pause/stop/loop/BPM/record.
- **`Clock.ts`** — Sub-beat accuracy scheduler (lookahead buffer pattern).
- **`MetronomeEngine.ts`** — Click track using oscillators.
- **`MixerEngine.ts`** — Manages channel strips, bus strips, master strip.
- **`ChannelStrip.ts`** — Per-track gain + pan + mute + EQ + sends.
- **`BusStrip.ts`** — Bus channel with sends.
- **`MasterStrip.ts`** — Master limiter + loudness meter.
- **`TrackMixer.ts`** — Connects track audio to channel strips.
- **`RecordingEngine.ts`** (renderer) + **`recording/RecordingEngine.ts`** (audio/) — MediaRecorder-based capture with take management.
- **`AutomationEngine.ts`**, **`automation/`** — Automation curve interpolation and playback.
- **`export/ExportPipeline.ts`** — Full offline export chain: normalize, dither, WAV/MP3/FLAC encoding. MP3/FLAC/AAC/OGG use FFmpeg via IPC.
- **`midi/MidiEngine.ts`**, **`MidiScheduler2.ts`**, **`ArpeggiatorEngine.ts`**, **`StepSequencerEngine.ts`** — MIDI processing stack.
- **`analysis/`**, **`ai/`** — Local mix analysis, pattern generators, AI music theory.

### Layer 2 — AudioBridge (renderer ↔ native) — PARTIAL
- **`AudioBridge.ts`** — `WebAudioBridge` implementation (ACTIVE). `NativeAudioBridge` is documented as `// Future`.
- The bridge interface (`IAudioBridge`) is well-defined.
- **`audio/vst/VstPluginClient.ts`** — Renderer-side IPC client for VST host (wired to main process `VstHost.ts`).

### Layer 3 — Native Rust binary (`native/audio-engine/`) — PARTIAL
- Fully implemented Rust binary with WASAPI (Windows), CoreAudio (macOS), ASIO drivers.
- JSON-over-stdin/stdout IPC protocol (`Command`/`Event` enums).
- Plugin host with VST3 and AU bridge stubs.
- **`AudioEngineProcess.ts`** spawns the binary, handles crashes, provides watchdog.
- **Status**: Binary compiles and runs; renderer does NOT use it yet — `WebAudioBridge` handles all audio. Migration path is documented in `AudioBridge.ts`.

---

## IPC Electron Bridge

### Renderer → Main (ipcRenderer.invoke)

| Channel | Purpose | Status |
|---------|---------|--------|
| `minimize-window` / `maximize-window` / `close-window` / `is-maximized` | Window controls | FUNCTIONAL |
| `set-always-on-top` / `open-external` / `debug-open-devtools` | Window utilities | FUNCTIONAL |
| `open-file-dialog` / `save-file-dialog` | Native file dialogs | FUNCTIONAL |
| `export:check-ffmpeg` / `export:transcode` / `export:write-file` | FFmpeg export pipeline | FUNCTIONAL |
| `ai:process-command` | Anthropic API call from main process (uses `ANTHROPIC_API_KEY`) | FUNCTIONAL |
| `perf:get-memory-metrics` / `perf:get-cpu-metrics` | Process memory/CPU stats | FUNCTIONAL |
| `mixer:open-window` / `mixer:close-window` | Detachable mixer window | FUNCTIONAL |
| `vst:scan` / `vst:list` / `vst:search` / `vst:search-advanced` | VST discovery | FUNCTIONAL |
| `vst:load-instance` / `vst:unload-instance` / `vst:bypass` | VST lifecycle | FUNCTIONAL |
| `vst:set-parameter` / `vst:get-parameter` / `vst:get-all-parameters` | VST parameters | FUNCTIONAL |
| `vst:get-state` / `vst:set-state` | VST state save/restore | FUNCTIONAL |
| `vst:open-window` / `vst:close-window` / `vst:resize-window` / `vst:pin-window` | VST plugin windows | FUNCTIONAL |
| `vst:favorites`, `vst:tags`, `vst:collections` | VST metadata management | FUNCTIONAL |
| `save-project` / `load-project` | Project file I/O | FUNCTIONAL |
| `offline-save` / `offline-load` / `offline-list` / `offline-delete` | Offline store | FUNCTIONAL |
| `settings-get` / `settings-set` / `settings-get-all` / `settings-reset` | Persistent settings | FUNCTIONAL |
| `autosave-set-data` / `autosave-get-data` / `autosave-mark-clean` | Auto-save | FUNCTIONAL |
| `perf:autosave-*` / `perf:recovery-*` | Perf autosave + crash recovery IPC | FUNCTIONAL |
| `recording:*` | Recording file management | FUNCTIONAL |
| `samples:scan` / `samples:search` / `samples:get` | Sample database | FUNCTIONAL |
| `audio:*` | Native audio engine commands | FUNCTIONAL (proxied to Rust process) |
| `get-midi-devices` | List MIDI devices | FUNCTIONAL |
| `check-update` / `download-update` / `install-update` | Auto-updater | FUNCTIONAL |
| `crash:log` / `crash:get-logs` | Crash reporting | FUNCTIONAL |
| `stability:*` | Stability monitoring | FUNCTIONAL |
| `version:*` | Version manager / rollback | FUNCTIONAL |
| `plugin:*` | Plugin host (sandboxed) | PARTIAL |
| `safety:*` | Project safety manager | FUNCTIONAL |

### Main → Renderer (webContents.send)

| Channel | Purpose |
|---------|---------|
| `crash-recovery-available` | Notify renderer of prior crash |
| `trigger-save` / `trigger-load` | Menu-driven save/load |
| `menu-action` | Generic menu actions (new-project, etc.) |
| `nav` | Navigate to a view |
| `power-event` | Suspend/resume events |
| `safety:app-quitting` | Signal clean exit to renderer |
| `vst:scan-progress` | VST scan progress updates |
| `audio:event` | Events from native audio engine |

---

## Backend API

### Auth (`/api/auth`)
| Method | Path | Auth | Status |
|--------|------|------|--------|
| POST | `/register` | — | FUNCTIONAL |
| POST | `/login` | — | FUNCTIONAL |
| POST | `/refresh` | — | FUNCTIONAL |
| GET | `/me` | JWT | FUNCTIONAL |
| POST | `/logout` / `/logout-all` | JWT | FUNCTIONAL |
| POST | `/forgot-password` / `/reset-password` | — | FUNCTIONAL |
| POST | `/verify-email` / `/resend-verification` | — | FUNCTIONAL |
| GET/DELETE | `/sessions` / `/sessions/:id` | JWT | FUNCTIONAL |
| POST | `/change-password` | JWT | FUNCTIONAL |

### AI (`/api/ai`)
| Method | Path | Auth | Status |
|--------|------|------|--------|
| POST | `/generate` | JWT+quota | FUNCTIONAL |
| POST | `/stream` | JWT+quota | FUNCTIONAL (SSE) |
| POST | `/analyze` / `/suggest` / `/template` | JWT+quota | FUNCTIONAL |

### Subscriptions (`/api/subscriptions`)
| Method | Path | Auth | Status |
|--------|------|------|--------|
| GET | `/status` | JWT | FUNCTIONAL |
| POST | `/upgrade` / `/cancel` / `/reactivate` | JWT | FUNCTIONAL |

### Payments (`/api/payments`)
- Stripe: checkout session, payment intent, subscription CRUD, webhooks, refunds
- PayPal: order create/capture, subscription create/cancel, webhooks, refunds
- VAT calculation
- All FUNCTIONAL (requires Stripe/PayPal env vars)

### Projects (`/api/projects`) — FUNCTIONAL (with Supabase or in-memory fallback)
### Templates (`/api/templates`) — FUNCTIONAL
### Packs (`/api/packs`) — FUNCTIONAL
### Marketplace (`/api/marketplace`) — FUNCTIONAL
### Collaboration (`/api/collab`, `/api/teams`) — FUNCTIONAL
### Cloud Sync (`/api/cloud-sync`) — FUNCTIONAL
### Save/Sync/Chunks (`/api/save`, `/api/sync`, `/api/chunks`) — FUNCTIONAL
### Admin (`/api/admin`, `/api/admin/analytics`, `/api/admin/realtime`) — FUNCTIONAL
### Errors/Metrics (`/api/errors`, `/api/metrics`) — FUNCTIONAL
### Updates (`/api/updates`) — FUNCTIONAL
### Local AI (`/api/local-ai`) — FUNCTIONAL (delegates to ai-service or Ollama)
### Export (`/api/export`) — FUNCTIONAL
### License (`/api/license`) — FUNCTIONAL
### Plugins (`/api/plugins`) — FUNCTIONAL
### CMS (`/api/cms`) — FUNCTIONAL
### Creators (`/api/creators`) — FUNCTIONAL

**Total: ~243 endpoint handlers** across 26 route files.

---

## CI/CD State

| Workflow | Trigger | What it does | Status |
|----------|---------|--------------|--------|
| `ci.yml` | push to `main`/`claude/**`, PRs | Backend tsc+tests; Website tsc+build; Desktop-app tsc | ACTIVE — desktop `tsc --noEmit || true` (suppressed errors) |
| `desktop-smoke.yml` | push to `main`/`claude/**` (renderer changes only) | Vite dev server + Playwright desktop UI smoke tests | ACTIVE |
| `playwright.yml` | push/PR | Playwright e2e tests against website + backend | ACTIVE |
| `build-website.yml` | push to `main`/`claude/**` (website changes only) | Website npm build + upload artifact | ACTIVE |
| `release-desktop.yml` | `desktop-v*` tag push or manual dispatch | Cross-platform (Linux/Windows/macOS) Electron build; Rust audio engine build; code signing; GitHub Release | ACTIVE |

**Note**: The CI desktop typecheck step uses `|| true`, meaning TypeScript errors in `desktop-app` are silently ignored in CI.

---

## Known Bugs & Critical Issues

1. **Live Mode not connected to transport** — `LiveMode.tsx` maintains its own `bpm` state (useState, initialized to 145) instead of reading from `transportStore`. The BPM controls change a local variable with no effect on audio.

2. **Routing Matrix is purely visual** — `RoutingMatrix.tsx` uses local React state (`useState`) for connections. No code connects this to `MixerEngine` or `BusRouter`. Toggling connections does nothing to actual audio routing.

3. **AI Assistant does not insert patterns** — `AIAssistant.tsx` displays generated pattern text in the chat, but has no code that calls `projectStore.addClip()` or modifies any store. The chat says "Ready to drop into piano roll" but no integration exists.

4. **Collaboration always connects to `'demo-project'`** — `useCollaboration.ts` line 17: `collaborationClient.connect('demo-project')`. Every session joins the same room regardless of the open project.

5. **Duplicate MidiScheduler** — Both `MidiScheduler.ts` and `MidiScheduler2.ts` exist with overlapping functionality. `MidiScheduler2.ts` is the "hardened" version using AudioContext clock, but both files export the same class name. It is unclear which one is active; no component directly imports either (they are used via `MidiEngine.ts`).

6. **Demo login credential exposed in UI** — `App.tsx` line 148 displays `demo@neurotek.ai · demo1234` in the login screen. This is acceptable for demo builds but must be removed before production.

7. **`desktop-app` TypeScript check suppressed in CI** — `ci.yml` line 79: `npx tsc --noEmit || true`. TypeScript errors never fail CI for the desktop app.

8. **`electron/` and `frontend/` legacy packages** — The root `package.json` still references `electron/` (legacy plain-JS) as `dev:desktop`. CI does not build either legacy package, but they consume ~300MB of `node_modules`.

9. **Native audio bridge not connected** — The Rust audio engine binary is built in CI and packaged, but `AudioBridge.ts` only ever instantiates `WebAudioBridge`. The `AudioEngineProcess.ts` spawns the Rust binary but output events are not routed back into the Web Audio graph.

10. **Sample browser depends on IPC for file scanning** — When running as a browser app (not Electron), `sampleBrowserStore` calls `window.electronAPI?.samples.scan()` which returns `undefined`. The store has no fallback.

---

## TypeScript Health

- **`desktop-app`**: `tsc --noEmit` exits 0 (clean). The CI `|| true` guard is no longer needed but remains.
- **`backend`**: `tsc --noEmit` exits 0 (clean).
- **`@ts-ignore` usage**: None found in either `desktop-app` or `backend` source.
- **`any` type usage in backend**: ~30 occurrences across `mockDB.ts`, repository files, and service files — concentrated in DB row mappers and mock data types.
- **`any` type usage in desktop-app renderer**: Minimal (0 found in primary search pass). The renderer stores and components are well-typed.
- **`// eslint-disable-next-line @typescript-eslint/ban-types`**: Found in `midiStore.ts` line 33 for a `Record<string, unknown>` type on preset data.
