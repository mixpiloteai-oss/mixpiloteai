# Technical Debt Report — Neurotek Studio
Generated: 2026-06-05 | Version: 0.4.0

---

## Status Legend
- 🔴 CRITICAL — blocks production use or causes data loss
- 🟠 HIGH — degrades user experience or causes incorrect behavior
- 🟡 MEDIUM — technical risk, maintenance burden, or missing feature
- 🟢 LOW — polish, convenience, or optimization

---

## Resolved in v0.3.x – v0.4.0

| ID | Description | Fixed in |
|---|---|---|
| CRIT-1 | TypeScript typecheck suppressed in CI (`\|\| true`) | v0.3.3 |
| CRIT-2 | AI patterns never inserted into project | v0.3.9 |
| CRIT-3 | Routing Matrix purely visual | v0.3.8 |
| CRIT-4 | AutomationEngine on setInterval drift | v0.3.4 |
| CRIT-5 | Real waveforms in ArrangementCanvas | v0.3.5 |
| CRIT-6 | Per-track compressor node missing | v0.3.6 |
| CRIT-7 | Piano roll undo/redo not wired | v0.3.7 |
| CRIT-8 | BusRouter no cycle detection | v0.3.8 |
| CRIT-9 | IPC never throws (ipcClient.ts Proxy wrapper) | v0.3.3 |
| CRIT-10 | Legacy electron/ directory (523 MB) deleted | v0.4.0 |
| CRIT-11 | Legacy frontend/ and ai-service/ deleted | v0.4.0 |

---

## Open Debt

### 🔴 CRITICAL

#### CRIT-12: VST3 MIDI delivery not wired (IEventList)
- **File**: `desktop-app/native/vst3-node/src/vst3_host.cc` — sendMidi() is a queue stub
- **Problem**: sendMidiEvent() queues MIDI but never delivers it: ProcessData::inputEvents is always nullptr. Notes sent to VST3 instruments are silently dropped.
- **Fix**: Implement IEventList wrapper; populate ProcessData.inputEvents in processBlock(). Requires Steinberg VST3 SDK (Apache 2.0: github.com/steinbergmedia/vst3sdk).
- **Effort**: 8-12h

#### CRIT-13: Rust audio engine not connected to Electron main process
- **File**: native/audio-engine/ (Rust) vs desktop-app/src/main/ (TypeScript)
- **Problem**: Rust engine binary is built but AudioEngineProcess.ts points to a JS fallback, not the Rust binary.
- **Fix**: Wire AudioEngineProcess.ts to spawn the compiled Rust binary; implement JSON IPC protocol from native/audio-engine/src/ipc/protocol.rs.
- **Effort**: 20-40h

### 🟠 HIGH

#### HIGH-1: VST3 preset browsing missing (IUnitInfo)
- **File**: vst3_host.cc — getPresetCount/getPresetName return 0/"" stubs
- **Fix**: Implement IUnitInfo::getProgramCount/getProgramName from Steinberg SDK.
- **Effort**: 4-8h

#### HIGH-2: TimeStretch is linear interpolation stub
- **File**: desktop-app/src/renderer/src/audio/editor/AudioEditorEngine.ts — timestretch()
- **Problem**: Marked STUB. Linear interpolation produces audible artifacts at large ratios.
- **Fix**: Integrate WSOLA or phase-vocoder algorithm.
- **Effort**: 16-40h

#### HIGH-3: Cloud sync (cloudSyncStore) is UI-only
- **File**: desktop-app/src/renderer/src/store/cloudSyncStore.ts
- **Problem**: Store tracks sync state but never calls backend API.
- **Fix**: Wire applySync() to POST /api/cloud-sync/push and GET /api/cloud-sync/pull.
- **Effort**: 8-16h

#### HIGH-4: Collaboration real-time sync not end-to-end tested
- **Files**: backend/src/routes/collaboration.ts, collaborationService.ts
- **Effort**: 8-16h

### 🟡 MEDIUM

#### MED-1: 114 raw console.log/warn/error calls in main process
- **Problem**: Not routed through DiagnosticLogger; log level not controllable in production.
- **Fix**: Use logger(category) from src/main/logger.ts (added in v0.4.0).
- **Effort**: 3-6h

#### MED-2: No rate limiting on desktop-app IPC handlers
- **Problem**: A malicious renderer could flood plugin-scan/plugin-load in a tight loop.
- **Fix**: Add per-method rate limits in VstHost.ts and pluginIPC.ts.
- **Effort**: 4-8h

#### MED-3: SampleDatabaseManager scan is sequential (main process blocking)
- **Problem**: 10,000+ file libraries block main process for seconds.
- **Fix**: Move scan to Worker thread; stream results back via IPC events.
- **Effort**: 6-12h

#### MED-4: Backend admin.ts (54 KB) list endpoints lack pagination
- **Problem**: Could OOM with large datasets.
- **Fix**: Add limit/offset query params.
- **Effort**: 4h

### 🟢 LOW

#### LOW-1: VST3 C++ addon processBlock uses mutex per call
- **Fix**: Lock-free ring buffer for parameter changes; remove mutex from hot path.
- **Effort**: 8-16h

#### LOW-2: 37 Zustand stores — no code-splitting
- **Problem**: All stores imported at startup, ~200ms unnecessary initial render cost.
- **Fix**: Lazy-import dormant stores behind React.lazy boundaries.
- **Effort**: 4h

---

## Security Audit Summary (v0.4.0)

| Check | Status |
|---|---|
| No hardcoded secrets in source | OK |
| .env files not committed | OK |
| validateEnv() runs at backend startup | OK |
| JWT secrets not logged | OK |
| Plugin sandbox crash isolation | OK |
| Auto-blacklist after 3 plugin crashes | OK |
| Rate limiting on backend API | OK |
| CORS configured | OK |
| X-Powered-By header disabled | OK |
| IPC inputs validated in main process | PARTIAL (see MED-2) |

---

## Dependency Audit (desktop-app v0.4.0)

electron@31.3.1, react@18.3.1, zustand@4.5.4, axios@1.7.2 — all current.
Run npm audit in each workspace directory to check for new advisories.

---

## Realistic Roadmap

| Priority | Item | Effort | Target |
|---|---|---|---|
| P0 | CRIT-12: VST3 MIDI IEventList | 8-12h | v0.4.1 |
| P0 | CRIT-13: Connect Rust audio engine | 20-40h | v0.5.0 |
| P1 | HIGH-1: VST3 preset browsing | 4-8h | v0.4.1 |
| P1 | HIGH-3: Cloud sync wired | 8-16h | v0.5.0 |
| P2 | HIGH-2: Real timestretch | 16-40h | v0.5.0 |
| P2 | MED-1: Logger migration | 3-6h | v0.4.2 |
| P3 | HIGH-4: Collaboration E2E tests | 8-16h | v0.5.0 |
| P3 | MED-3: Sample scan to Worker | 6-12h | v0.5.0 |
