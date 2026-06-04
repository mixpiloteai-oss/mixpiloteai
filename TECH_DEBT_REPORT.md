# Technical Debt Report — Neurotek Studio
Generated: 2026-06-04

---

## Critical Debt (blocks production)

### CRIT-1: TypeScript typecheck suppressed in CI
- **File**: `.github/workflows/ci.yml` line 79
- **Problem**: `npx tsc --noEmit || true` — TypeScript errors in `desktop-app` never fail CI. Any future type regression is invisible.
- **Fix**: Remove `|| true`. Run `npm run typecheck` (already defined in `desktop-app/package.json`).
- **Effort**: 0.5h

### CRIT-2: AI Assistant generates text but never modifies the project
- **File**: `desktop-app/src/renderer/src/components/ai-assistant/AIAssistant.tsx` (entire file)
- **Problem**: When a user asks "generate a kick pattern at 145 BPM", the response displays in the chat as ASCII art. There is no code that calls `useProjectStore.getState().addClip()` or `usePianoRollStore`. The feature is fake for production users.
- **Fix**: Parse the AI response (the backend already returns structured MIDI data via `/api/ai/generate`), create a `Clip` with `notes[]`, call `projectStore.addClip()`.
- **Effort**: 8–16h

### CRIT-3: Live Mode is a static mockup
- **File**: `desktop-app/src/renderer/src/components/live/LiveMode.tsx` (entire component)
- **Problem**: All 48 clips are hardcoded strings (`INITIAL_CLIPS`). BPM is local `useState` (not connected to `transportStore`). Clicking a clip sets a local `active` state variable — it does not trigger any audio playback.
- **Fix**: Connect to `projectStore` for clips, connect BPM to `transportStore`, wire to `ClipPlaybackCoordinator.ts` for actual audio triggering.
- **Effort**: 20–40h

### CRIT-4: Routing Matrix is purely visual
- **File**: `desktop-app/src/renderer/src/components/routing/RoutingMatrix.tsx` (entire component)
- **Problem**: `connections` state is `useState` local to the component. Toggling connections has no effect on `BusRouter.ts` or `MixerEngine.ts`. Audio routing is always the default hardwired chain.
- **Fix**: Replace local state with `routingStore` (or extend `mixerStore`), wire toggle handlers to `BusRouter.addSend()` / `removeSend()`.
- **Effort**: 10–20h

### CRIT-5: Collaboration always joins a hardcoded demo room
- **File**: `desktop-app/src/renderer/src/hooks/useCollaboration.ts` line 17
- **Problem**: `collaborationClient.connect('demo-project')` — every session connects to the same room. Multiple real users would corrupt each other's sessions.
- **Fix**: Pass the actual `project.id` from `projectStore`, and pass the user's auth token from `localStorage.getItem('token')`.
- **Effort**: 2h

### CRIT-6: Demo credentials hard-coded in login screen
- **File**: `desktop-app/src/renderer/src/App.tsx` line 148
- **Problem**: `demo@neurotek.ai · demo1234` is rendered as visible text on the login form, permanently exposing the demo password.
- **Fix**: Remove the credential hint before production release. Keep the "Continue as Demo" button.
- **Effort**: 0.25h

---

## High Debt (blocks stability)

### HIGH-1: Native Rust audio engine not connected to renderer
- **File**: `desktop-app/src/renderer/src/audio/AudioBridge.ts` (comment at top)
- **Problem**: The native Rust binary (`audio-engine`) is spawned by `AudioEngineProcess.ts` and has a full IPC protocol. However, `audio/index.ts` only creates a `WebAudioBridge`. The `NativeAudioBridge` is marked `// Future`. Low-latency ASIO/WASAPI/CoreAudio audio is unavailable despite being fully compiled.
- **Fix**: Implement `NativeAudioBridge` that implements `IAudioBridge` by proxying commands to `window.electronAPI.audio.*`. Swap it in `audio/index.ts` when running in Electron.
- **Effort**: 40–80h

### HIGH-2: Duplicate MidiScheduler
- **Files**: `audio/midi/MidiScheduler.ts` and `audio/midi/MidiScheduler2.ts`
- **Problem**: Two classes with the same conceptual purpose. `MidiScheduler2` is the improved version (uses AudioContext clock instead of setTimeout, has note-off guarantee, priority queue). The original `MidiScheduler.ts` still exists and is imported from `MidiEngine.ts`. Unclear which is active in practice.
- **Fix**: Audit `MidiEngine.ts` to confirm which scheduler it uses, delete the unused one, rename the winner to `MidiScheduler.ts`.
- **Effort**: 2–4h

### HIGH-3: Backend uses in-memory fallback with no persistence warning
- **File**: `backend/src/data/mockDB.ts` (the fallback path)
- **Problem**: When `SUPABASE_URL` is not set, all data is stored in process memory. A server restart loses all users and projects. In Railway production with a missing env var, this would silently lose data.
- **Fix**: Add a startup log warning `[CRITICAL] Running with in-memory DB — all data is ephemeral` and a health endpoint field indicating the DB mode. Add env validation that fails hard if `NODE_ENV=production` and Supabase is not configured.
- **Effort**: 2h

### HIGH-4: Recording engine not fully connected to transport
- **Files**: `audio/recording/RecordingEngine.ts`, `components/recording/`, `store/recordingStore.ts`
- **Problem**: Recording infrastructure (buffers, takes, WAV writer, IPC) is implemented. However, there is no hook that starts/stops the `RecordingEngine` when `transportStore.recording` flips. The record button in `TransportBar` toggles `transportStore.toggleRecord()` but nothing listens to `recording: true` to start capturing audio.
- **Fix**: In `useSaveSystem` or a new `useRecording` hook, subscribe to `transportStore.recording` and call `RecordingEngine.start()` / `stop()`.
- **Effort**: 4–8h

### HIGH-5: VST3 plugin hosting requires native addon not present
- **File**: `desktop-app/src/main/vst/VstHost.ts`, `VstSandbox.ts`, `VstScanner.ts`
- **Problem**: The VST IPC layer, database, sandbox, crash guard are all implemented. But actual VST3 plugin loading (`VstSandbox.ts` spawning `PluginWorker.ts`) relies on `node-vst3` or similar native Node addon, which is not in `package.json`. Calling `vst:load-instance` will fail at runtime.
- **File reference**: `desktop-app/src/main/vst/native/IVst3Adapter.ts` — interface only, no implementation.
- **Fix**: Either integrate a real VST3 native addon (e.g., `@rnbo/vst3`) or document that VST3 requires the Rust audio engine layer.
- **Effort**: 80–200h (depends on chosen approach)

### HIGH-6: Cloud sync not tested end-to-end
- **Files**: `services/CloudSyncEngine.ts`, `store/cloudSyncStore.ts`, `backend/src/routes/cloudSync.ts`
- **Problem**: The cloud sync service, store, and backend routes exist, but `initCloudSync` is never called in any component or hook. The `cloudSyncStore` is never subscribed to in the UI. Sync silently does nothing.
- **Fix**: Call `initCloudSync(project.id, token)` in `useSaveSystem` and add a sync status indicator to `StatusBar`.
- **Effort**: 4h

---

## Medium Debt (code quality)

### MED-1: Legacy `electron/` and `frontend/` folders at root
- **Files**: `/electron/` (plain-JS, v1.0.0-beta.1), `/frontend/` (React, v0.1.0)
- **Problem**: Two complete but obsolete application packages remain in the repo. Root `package.json` still defines `dev:desktop` as `cd electron && npm run dev`. They have their own `node_modules`, add ~300MB of disk overhead, and confuse new contributors.
- **Fix**: Delete both directories. Update root `package.json` scripts to reference `desktop-app`.
- **Effort**: 1h

### MED-2: Root `package.json` dev scripts point to legacy packages
- **File**: `/package.json` lines 5–15
- **Problem**: `dev:desktop` points to `electron/`, `dev:web` points to `frontend/`. The actual active packages are `desktop-app/` and `website/`.
- **Fix**: Rewrite scripts to use `desktop-app` and `website`.
- **Effort**: 0.5h

### MED-3: `any` types in backend repositories and mock data
- **Files**: `backend/src/data/mockDB.ts`, `backend/src/repositories/adminRepository.ts`, `backend/src/repositories/teamRepository.ts`, `backend/src/services/teamService.ts`
- **Problem**: ~30 `: any` occurrences, primarily in DB row mappers. Type safety is weakest at the data boundary.
- **Fix**: Replace with proper TypeScript interfaces for each Supabase table row.
- **Effort**: 4–8h

### MED-4: `ai:process-command` IPC makes raw HTTPS calls from main process
- **File**: `desktop-app/src/main/index.ts` lines 190–246
- **Problem**: Main process makes raw Node.js `https.request` calls to `api.anthropic.com`. This bypasses the backend's quota system, auth, and cost optimizer. Costs accrue directly against `ANTHROPIC_API_KEY` without user attribution.
- **Fix**: Route this through the backend `/api/ai/generate` endpoint using the user's JWT.
- **Effort**: 2h

### MED-5: Hardcoded CORS origins include a fake GitHub org URL
- **File**: `backend/src/app.ts` line 81
- **Problem**: `https://mixpiloteai.vercel.app` and the Vercel pattern regex reference the deployment domain. Also `desktop-app/src/lib/config.ts` likely has the backend URL hardcoded. These are fine, but the GitHub `wiki` and `issues` links in `main/index.ts` reference a non-existent org `mixpiloteai-oss`.
- **Fix**: Update GitHub links. Verify Vercel domain matches actual deployment.
- **Effort**: 0.5h

### MED-6: `AutoSaveEngine` duplicated in two locations
- **Files**: `audio/safety/AutoSaveEngine.ts` and `audio/save/AutoSaveEngine.ts`
- **Problem**: Two files with the same name in different subdirectories. The save system hooks into `audio/save/AutoSaveEngine.ts`, but `audio/safety/AutoSaveEngine.ts` also exists. Unclear if they serve different purposes.
- **Fix**: Audit which one is imported by `useSaveSystem.ts`, delete the unused one.
- **Effort**: 1h

### MED-7: `ProjectSafetyManager` and existing autosave are redundant
- **Files**: `desktop-app/src/main/safety/ProjectSafetyManager.ts`, `desktop-app/src/main/autosave.ts`, `desktop-app/src/main/autosave/` (the `AutoSaveManager` class)
- **Problem**: Three separate autosave/crash-recovery systems registered in `index.ts`: the legacy `autosaveModule`, the new `AutoSaveManager` (perf namespace), and `ProjectSafetyManager`. Each writes its own files to `userData`. Risk of conflict.
- **Fix**: Consolidate into `ProjectSafetyManager` as the single source of truth.
- **Effort**: 8h

### MED-8: `RecordingEngine.ts` at root of `audio/` and also in `audio/recording/`
- **Files**: `audio/RecordingEngine.ts` and `audio/recording/RecordingEngine.ts`
- **Problem**: Two recording engine files at different paths. The root-level one may be an older copy.
- **Fix**: Determine which one is imported, delete the duplicate.
- **Effort**: 1h

### MED-9: `LatencyCompensator` duplicated
- **Files**: `audio/LatencyCompensator.ts` and `audio/recording/LatencyCompensator.ts`
- **Problem**: Same class name in two locations.
- **Fix**: Determine canonical one, delete duplicate.
- **Effort**: 1h

### MED-10: `performance.css` selector coverage
- **File**: `desktop-app/src/renderer/src/styles/performance.css`
- **Problem**: Performance CSS uses `body[data-perf-mode]` selectors. The `App.tsx` sets `document.body.dataset.perfMode` (camelCase → `data-perf-mode` attribute). This is correct, but if the attribute key ever changes, the CSS becomes silently inert.
- **Fix**: Add a test or at least a comment linking the TS constant to the CSS attribute.
- **Effort**: 0.5h

---

## Low Debt (nice to have)

### LOW-1: MidiScheduler (v1) not deleted after v2 was written
- **File**: `audio/midi/MidiScheduler.ts`
- **Problem**: `MidiScheduler2.ts` is a full rewrite fixing multiple bugs. The original should be removed.
- **Effort**: 1h

### LOW-2: `mockData.ts` in both `frontend/src/data/` and `backend/src/data/`
- **Problem**: Each package has its own mock data definitions that could drift. The backend's `mockPacksDB.ts` uses `any` types.
- **Effort**: 2h

### LOW-3: `ai-service/` Python microservice not referenced by CI
- **File**: `ai-service/main.py`
- **Problem**: No CI job builds or tests the Python FastAPI service. No Dockerfile included. If it crashes in production, CI does not detect it.
- **Fix**: Add a `pytest` or `httpx` smoke test in CI.
- **Effort**: 2h

### LOW-4: `infra/nginx/` is empty placeholder
- **File**: `/infra/nginx/`
- **Problem**: Directory exists but contains no nginx config. If the team intends to self-host, this needs filling in.
- **Effort**: 2–4h

### LOW-5: Boot log in production
- **File**: `desktop-app/src/renderer/src/lib/bootLogger.ts`
- **Problem**: `bootLog.ok(...)` calls are not gated by `import.meta.env.DEV`. They run in production builds and print to the renderer console.
- **Fix**: Gate all `bootLog` calls with `if (import.meta.env.DEV)` or `if (import.meta.env.MODE !== 'production')`.
- **Effort**: 0.5h

### LOW-6: `AutomationEngine.ts` duplicated (audio root vs. audio/automation/)
- **Files**: `audio/AutomationEngine.ts` and `audio/automation/AutomationEngine.ts`
- **Problem**: Same pattern as RecordingEngine duplication.
- **Effort**: 1h

### LOW-7: Website has no E2E test for checkout happy path
- **File**: `e2e/tests/checkout-stripe.spec.ts`, `e2e/tests/checkout-paypal.spec.ts`
- **Problem**: Tests exist but they hit Stripe/PayPal in test mode — they require secrets (`STRIPE_TEST_KEY`, etc.) that are not present in CI without explicit configuration. Tests are marked to skip gracefully, but the happy path is never validated in CI.
- **Effort**: 4h (Stripe test mode setup)

### LOW-8: `eslint-disable` in midiStore
- **File**: `store/midiStore.ts` line 32
- **Problem**: `// eslint-disable-next-line @typescript-eslint/ban-types` to allow `Record<string, unknown>` — this rule suppression is unnecessary in modern TypeScript configs.
- **Effort**: 0.25h

### LOW-9: `FlacEncoderPcm.ts` / `FlacEncoderReal.ts` and `Mp3EncoderPcm.ts` / `Mp3EncoderReal.ts`
- **Files**: `audio/export/Flac*.ts`, `audio/export/Mp3*.ts`, and `audio/export/encoders/FlacEncoder.ts`, `Mp3Encoder.ts`
- **Problem**: Four encoder files for two codecs, plus separate files under `encoders/`. The "Real" variants use FFmpeg IPC, the "Pcm" variants are pure JS stubs. The `encoders/` subdirectory appears to be a third copy.
- **Effort**: 2h (consolidate to one encoder per format)
