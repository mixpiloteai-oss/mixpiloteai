# Next Steps Roadmap — Neurotek Studio
Generated: 2026-06-04

---

## Phase 1 — Stability (must fix before any new features)

These tasks fix broken or misleading behavior that will cause immediate user confusion or data loss.

### 1.1 Fix TypeScript check in CI
- **What**: Remove `|| true` from `.github/workflows/ci.yml` line 79.
- **Files**: `.github/workflows/ci.yml`
- **Dependencies**: None
- **Effort**: 0.5h

### 1.2 Remove demo credential from login screen
- **What**: Delete the `<p>demo@neurotek.ai · demo1234</p>` element from `LoginScreen`.
- **Files**: `desktop-app/src/renderer/src/App.tsx` line 148
- **Dependencies**: None
- **Effort**: 0.25h

### 1.3 Fix collaboration room ID
- **What**: Replace hardcoded `'demo-project'` with `useProjectStore.getState().project.id`. Pass auth token to `collaborationClient.connect()`.
- **Files**: `desktop-app/src/renderer/src/hooks/useCollaboration.ts` line 17
- **Dependencies**: `projectStore` must have a stable project ID (it does — `'proj-1'` in seed, should be user-created UUID)
- **Effort**: 2h

### 1.4 Consolidate autosave systems
- **What**: Remove legacy `autosaveModule` and `AutoSaveManager` registrations from `main/index.ts`. Keep only `ProjectSafetyManager` as the single crash recovery and autosave system. Update IPC handlers accordingly.
- **Files**: `desktop-app/src/main/index.ts` lines 313–343, `desktop-app/src/main/modules/autosave.ts`, `desktop-app/src/main/autosave.ts`
- **Dependencies**: Must verify `RecoveryDialog` still works after migration
- **Effort**: 8h

### 1.5 Delete legacy packages
- **What**: Delete `/electron/` and `/frontend/` directories. Update root `package.json` scripts to reference `desktop-app/` and `website/`.
- **Files**: `/electron/`, `/frontend/`, `/package.json`
- **Dependencies**: Verify no CI job references either directory
- **Effort**: 1h

### 1.6 Remove duplicate source files
- **What**: Delete `audio/RecordingEngine.ts` (keep `audio/recording/RecordingEngine.ts`), `audio/LatencyCompensator.ts` (keep `audio/recording/LatencyCompensator.ts`), `audio/AutomationEngine.ts` (keep `audio/automation/AutomationEngine.ts`), `audio/safety/AutoSaveEngine.ts` (keep `audio/save/AutoSaveEngine.ts`). Consolidate `MidiScheduler.ts` and `MidiScheduler2.ts` into one.
- **Files**: Listed above
- **Dependencies**: Verify imports in `MidiEngine.ts`, `useSaveSystem.ts`, transport hooks
- **Effort**: 4h

### 1.7 Add production guard for Supabase requirement
- **What**: In `backend/src/data/mockDB.ts`, if `NODE_ENV === 'production'` and Supabase is not configured, throw at startup instead of silently using in-memory storage.
- **Files**: `backend/src/data/mockDB.ts`, `backend/src/utils/validateEnv.ts`
- **Dependencies**: None
- **Effort**: 1h

### 1.8 Route AI cloud calls through backend (not direct from main process)
- **What**: Remove the raw Anthropic HTTPS call in `main/index.ts` `ai:process-command` handler. Instead, forward the request to the backend `/api/ai/generate` with the user's token.
- **Files**: `desktop-app/src/main/index.ts` lines 190–246
- **Dependencies**: Backend `/api/ai/generate` must accept the `daw-assistant` context type (it does)
- **Effort**: 2h

---

## Phase 2 — Core DAW Completeness

These tasks make the DAW actually usable for music production — connecting the UI to the audio engine.

### 2.1 Wire Live Mode to real data and audio
- **What**: Replace hardcoded `INITIAL_CLIPS` with project tracks and clips from `projectStore`. Remove local `bpm` useState; read from `transportStore`. Wire clip button clicks to `ClipPlaybackCoordinator.ts` to trigger actual audio playback. Use `useClipStore` for selection state.
- **Files**: `components/live/LiveMode.tsx` (full rewrite), `audio/ClipPlaybackCoordinator.ts`, `audio/clip/ClipScheduler.ts`
- **Dependencies**: `ClipPlaybackCoordinator` needs audio clips loaded from `WaveformLoader`; MIDI clips need `MidiScheduler`
- **Effort**: 20–40h

### 2.2 Wire Routing Matrix to audio engine
- **What**: Create a `routingStore` (or extend `mixerStore`) that holds `RoutingConnection[]`. Wire `RoutingMatrix.tsx` to this store. On connection toggle, call `BusRouter.ts` methods to add/remove sends between `ChannelStrip` and `BusStrip` nodes.
- **Files**: `components/routing/RoutingMatrix.tsx`, `audio/BusRouter.ts`, `store/` (new routingStore or extend mixerStore)
- **Dependencies**: `BusRouter.ts` must expose `addRoute(from: AudioNode, to: AudioNode)` API
- **Effort**: 10–20h

### 2.3 Complete audio recording loop
- **What**: In `useTransportSync` or a new `useRecording` hook, subscribe to `transportStore.recording`. When it becomes `true`, call `RecordingEngine.start(armedTracks)`. When `false`, call `stop()` and create clips from the recorded buffers. Wire punch-in/out from `recordingStore`.
- **Files**: `hooks/useTransportSync.ts` or new `hooks/useRecording.ts`, `audio/recording/RecordingEngine.ts`, `store/recordingStore.ts`
- **Dependencies**: Phase 1.6 (single RecordingEngine)
- **Effort**: 8–16h

### 2.4 AI Assistant pattern insertion
- **What**: Parse the AI response from `/api/ai/generate` for structured MIDI data (the backend already returns `{ notes, bpm, key }` objects). When the user sends a generation command, apply results by calling `projectStore.addClip()` with the generated notes. Add a confirmation UI ("Insert into arrangement?").
- **Files**: `components/ai-assistant/AIAssistant.tsx`, `store/projectStore.ts`, `lib/apiClient.ts`
- **Dependencies**: Backend `/api/ai/generate` must return structured MIDI (verify format); Piano Roll store must accept external note inserts
- **Effort**: 12–24h

### 2.5 Enable cloud sync
- **What**: Call `initCloudSync(project.id, token)` from `useSaveSystem` after login. Add sync status badge to `StatusBar.tsx`. Handle conflict resolution dialog (store already has `conflict` state).
- **Files**: `hooks/useSaveSystem.ts`, `store/cloudSyncStore.ts`, `services/CloudSyncEngine.ts`, `components/shell/StatusBar.tsx`
- **Dependencies**: Backend `/api/cloud-sync` endpoint must be running
- **Effort**: 6h

### 2.6 Sample browser full integration
- **What**: Ensure the sample browser works when `electronAPI` is unavailable (browser mode). Add a drag-and-drop handler that creates an audio clip in the arrangement. Wire preview to `AudioPreviewEngine.ts`.
- **Files**: `store/sampleBrowserStore.ts`, `audio/samples/AudioPreviewEngine.ts`, `components/browser/`
- **Dependencies**: None
- **Effort**: 8h

### 2.7 VST3 native addon integration (if in scope)
- **What**: Research and integrate a VST3 native Node.js addon (or use the Rust audio engine's plugin host). Implement `VstSandbox.ts`'s `PluginWorker.ts` to actually load VST3 DLLs/bundles. Update `VstHost.ts` `loadInstance()` to call the real host.
- **Files**: `desktop-app/src/main/vst/VstSandbox.ts`, `desktop-app/src/main/vst/sandbox/PluginWorker.ts`, `desktop-app/src/main/vst/native/IVst3Adapter.ts`
- **Dependencies**: Requires platform-specific native code; macOS AU support is separate
- **Effort**: 80–200h

---

## Phase 3 — AI Features

These tasks make the AI features genuinely useful rather than cosmetic.

### 3.1 Connect native Rust audio engine to renderer
- **What**: Implement `NativeAudioBridge` in `audio/AudioBridge.ts` that routes `play`, `stop`, `setBpm`, `setParameter` etc. through `window.electronAPI.audio.*` IPC calls to `AudioIPCHandler.ts`, which forwards them to the running Rust process. Swap it in `audio/index.ts` when `window.electronAPI` is present.
- **Files**: `audio/AudioBridge.ts`, `audio/index.ts`, `main/audio/AudioIPCHandler.ts`, `main/audio/AudioEngineProcess.ts`
- **Dependencies**: Phase 1.6 (clean audio layer)
- **Effort**: 40–80h

### 3.2 Local AI analysis → actionable suggestions
- **What**: `LocalAIPanel` already runs real analysis (frequency, structure, dynamics). Add a "Fix it" button next to each issue that calls the appropriate `mixAssistantStore` action (e.g., "Kick is too loud" → `setTrackGain('tk-kick', currentGain - 3)`).
- **Files**: `components/ai-local/LocalAIPanel.tsx`, `audio/mixing/EQSuggestionEngine.ts`, `audio/mixing/MixBalanceSuggestionEngine.ts`, `store/projectStore.ts`
- **Dependencies**: Analysis engines already in place
- **Effort**: 8h

### 3.3 Piano Roll AI pattern generation
- **What**: The `AIPanel.tsx` inside piano roll exists. Connect it to the AI engine so that when a user types "make a 4-bar acid bassline in D minor at 145 BPM", it calls `/api/ai/generate` with `messageType: 'acid'`, receives notes, and inserts them into the active clip via `usePianoRollStore`.
- **Files**: `components/piano-roll/AIPanel.tsx`, `store/` (pianoRollStore), `lib/apiClient.ts`
- **Dependencies**: Phase 2.4
- **Effort**: 8h

### 3.4 AI Assistant streaming
- **What**: The backend `/api/ai/stream` endpoint is SSE. The renderer `AIAssistant.tsx` currently uses a regular `fetch`. Migrate to `EventSource` or `fetch` with response body streaming for real-time token display.
- **Files**: `components/ai-assistant/AIAssistant.tsx`
- **Dependencies**: None
- **Effort**: 4h

### 3.5 Python AI microservice CI + Docker
- **What**: Add `pytest` + `httpx` smoke tests for `ai-service/main.py`. Add a `Dockerfile`. Add a CI job that builds and smoke-tests the service.
- **Files**: `ai-service/main.py`, new `ai-service/Dockerfile`, new `ai-service/tests/`
- **Dependencies**: None
- **Effort**: 4h

### 3.6 Offline AI heuristics improvement
- **What**: `offlineAI.ts` uses pattern-matching rules for offline responses. Replace with the local `audio/ai/` generators (pattern generator, bassline generator, etc.) so the offline mode produces real MIDI data even without network.
- **Files**: `services/offlineAI.ts`, `audio/ai/PatternGenerator.ts`, `audio/ai/BasslineGenerator.ts`
- **Dependencies**: Phase 2.4
- **Effort**: 12h

---

## Phase 4 — Commercial Release

These tasks are required for a paid product launch.

### 4.1 Code signing infrastructure
- **What**: Configure `WIN_CERT_PFX_BASE64`, `MAC_CERT_P12_BASE64`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` GitHub secrets. Verify `release-desktop.yml` notarization works. Test auto-update flow end-to-end.
- **Files**: `.github/workflows/release-desktop.yml` (already has signing logic; needs secrets)
- **Dependencies**: Valid code signing certificates purchased
- **Effort**: 4–8h (plus certificate procurement)

### 4.2 Production environment validation
- **What**: Verify Railway deployment has all required env vars (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `STRIPE_SECRET_KEY`, `PAYPAL_CLIENT_ID`, etc.). Test Stripe webhook signature verification end-to-end with live keys.
- **Files**: `backend/src/utils/validateEnv.ts`, Railway environment config
- **Dependencies**: Phase 1.7
- **Effort**: 4h

### 4.3 Remove/gate demo login bypass
- **What**: The `demoLogin()` function sets `token='demo'` without any server validation. In production, this should either be disabled or require a valid demo account JWT. The `token='local'` Electron bypass should require a valid license check.
- **Files**: `desktop-app/src/renderer/src/App.tsx` lines 74–77, `desktop-app/src/main/index.ts` (add license validation)
- **Dependencies**: License system (`/api/license`) already exists in backend
- **Effort**: 4h

### 4.4 E2E checkout tests in CI
- **What**: Configure Stripe test mode keys as CI secrets. Enable `e2e/tests/checkout-stripe.spec.ts` and `checkout-paypal.spec.ts` to run against the staging backend. They currently skip gracefully when secrets are absent.
- **Files**: `.github/workflows/playwright.yml`, `e2e/tests/checkout-stripe.spec.ts`
- **Dependencies**: Staging environment up and running
- **Effort**: 4h

### 4.5 Performance baseline tests
- **What**: The `desktop-app/tests/perf/` directory and `audio/AudioPerformanceBenchmark.ts` exist. Add CI benchmarks that fail if audio callback time exceeds a threshold (e.g., 10ms for 512-frame buffer at 48kHz).
- **Files**: `desktop-app/tests/perf/`, `audio/AudioPerformanceBenchmark.ts`
- **Dependencies**: Phase 3.1 (native engine connected)
- **Effort**: 8h

### 4.6 GDPR / data deletion API
- **What**: Add `DELETE /api/users/me` endpoint that hard-deletes all user data from Supabase. Required for EU app store listing and GDPR compliance. Backend has `userRepository` and migration infrastructure.
- **Files**: `backend/src/routes/auth.ts` or new `backend/src/routes/users.ts`, `backend/src/repositories/userRepository.ts`
- **Dependencies**: None
- **Effort**: 4h

### 4.7 App store metadata and screenshots
- **What**: Prepare Windows Store / Mac App Store / direct download assets: screenshots of all major views, description text, privacy policy URL, support URL.
- **Files**: `desktop-app/build/`, `website/src/pages/Download.tsx`
- **Dependencies**: Phase 3.1 (native engine), UI is complete
- **Effort**: 16h

### 4.8 Localization completion
- **What**: The app has locale files for 10 languages (`en`, `fr`, `de`, `es`, `it`, `ja`, `ko`, `pt`, `ru`, `zh`) under `frontend/src/locales/`. The desktop app `i18n` setup is in `frontend/src/i18n/`. Verify all UI strings in `desktop-app/src/renderer/src/` go through the i18n system, not hardcoded English.
- **Files**: `desktop-app/src/renderer/src/` (all components with hardcoded strings), `frontend/src/locales/`
- **Dependencies**: None
- **Effort**: 40h

---

## Summary Priority Matrix

| Priority | Task | Effort |
|----------|------|--------|
| P0 | Fix CI typecheck suppression | 0.5h |
| P0 | Remove demo credentials from login UI | 0.25h |
| P0 | Fix collaboration room ID | 2h |
| P0 | Delete legacy `electron/` and `frontend/` | 1h |
| P0 | Add Supabase production guard | 1h |
| P1 | Consolidate 3 autosave systems | 8h |
| P1 | Delete duplicate source files | 4h |
| P1 | Route AI calls through backend | 2h |
| P1 | Wire recording to transport | 8–16h |
| P1 | Enable cloud sync | 6h |
| P2 | Wire Live Mode to real data + audio | 20–40h |
| P2 | Wire Routing Matrix to audio engine | 10–20h |
| P2 | AI Assistant pattern insertion | 12–24h |
| P2 | Sample browser full integration | 8h |
| P3 | Native Rust audio engine bridge | 40–80h |
| P3 | VST3 native plugin loading | 80–200h |
| P3 | Local AI → actionable mix suggestions | 8h |
| P3 | Piano Roll AI pattern generation | 8h |
| P4 | Code signing setup | 4–8h |
| P4 | Production env validation | 4h |
| P4 | GDPR data deletion endpoint | 4h |
| P4 | E2E checkout tests in CI | 4h |
| P4 | Localization audit | 40h |
