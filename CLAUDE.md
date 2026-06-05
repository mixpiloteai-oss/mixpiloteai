# Neurotek Studio — Developer Reference

## Architecture Overview

```
mixpiloteai/
├── backend/          Node.js/Express API — authentication, payments, AI gateway, collaboration
├── desktop-app/      Electron 31 desktop DAW — main product
│   ├── src/main/     Electron main process (IPC, plugins, autosave, recording)
│   ├── src/preload/  Context bridge (exposes 100+ typed IPC methods to renderer)
│   ├── src/renderer/ React 18 UI (37 Zustand stores, Web Audio API, canvas DAW)
│   └── native/       C++ N-API addon for VST3 plugin hosting
├── native/           Rust audio engine (libloading-based, platform audio I/O via cpal)
├── website/          Marketing/docs site (React + Vite, deployed to Vercel)
├── e2e/              Playwright end-to-end tests (desktop + web)
└── infra/            Nginx reverse proxy config, SSL setup
```

## Monorepo Rules

- **Never** modify `backend/`, `website/`, or `e2e/` when working on the desktop app (and vice versa).
- **Never** commit `.env` files — only `.env.example` templates are tracked.
- **Never** use `any` types or `@ts-ignore` in TypeScript.
- **Never** hardcode credentials, API keys, or secrets in source code.
- Import paths: **no `.ts` extension** in imports (e.g. `import x from './foo'` not `'./foo.ts'`).

## Desktop App (`desktop-app/`)

### Stack
- **Electron** 31.3.1 + **electron-vite** 2.3.0
- **React** 18.3.1 + **TypeScript** strict
- **Zustand** 4.5.4 (37 stores — see `src/renderer/src/store/`)
- **Web Audio API** — Chris Wilson scheduler, AudioWorklet, real audio processing
- **TailwindCSS** 3.4.7

### Commands
```bash
npm run dev          # Start dev server (Vite HMR + Electron)
npm run build        # Production build
npm run typecheck    # tsc --noEmit (both renderer + main)
npm run test         # All unit + integration tests
npm run test:unit    # Unit tests only
npm run test:ci      # TAP output for CI
npm run native:build # Build VST3 C++ N-API addon (requires node-gyp)

# Platform releases (run after tagging desktop-vX.Y.Z)
npm run build:win
npm run build:mac
npm run build:linux
```

### IPC Architecture
All renderer↔main communication goes through `src/preload/index.ts` (context bridge) and is consumed via `src/renderer/src/ipc/ipcClient.ts` — a Proxy-based wrapper that provides typed, safe fallbacks for every method and never throws.

Never call `window.electronAPI` directly from renderer components — always use `ipcClient`.

### Audio Engine
- **Transport** (`src/renderer/src/audio/Clock.ts`): Chris Wilson scheduler, 100ms lookahead, AudioWorklet fallback
- **Automation** (`AutomationEngine.ts`): beat-driven, subscribes to `transport.onBeat()`
- **BusRouter** (`BusRouter.ts`): Web Audio send/return with DFS cycle detection
- **TempoMap** (`TempoMap.ts`): `{ bar, bpm }` event list for tempo automation
- **WaveformCache** (`audio/editor/WaveformCache.ts`): LRU-32 peak cache (min/max/rms per pixel)

### VST3 Plugin System
The plugin system is layered:
1. **Renderer** → `VstPluginClient.ts` (IPC calls via preload bridge)
2. **Main process** → `VstHost.ts` (IPC handlers, delegates to sandbox)
3. **Sandbox** → `VstSandbox.ts` (one forked child process per plugin instance)
4. **Worker** → `vst/sandbox/PluginWorker.ts` (calls native adapter)
5. **Native adapter** → `vst/native/IVst3Adapter.ts` (loads `native/vst3-node/build/Release/vst3-node.node`)
6. **C++ addon** → `native/vst3-node/` (N-API, node-gyp, inline VST3 COM interfaces)

Build the addon: `npm run native:build` (requires C++17 compiler + node-gyp).  
The app works without the addon — `NullVst3Adapter` falls back gracefully with a console.warn.

### State Management
37 Zustand stores live in `src/renderer/src/store/`. Key stores:
- `projectStore` — tracks, clips, project metadata
- `transportStore` — play state, BPM, loop points
- `historyStore` — undo/redo command stack
- `vstStore` — plugin instances, scan results
- `audioEditorStore` — sample editor session state
- `useArrangementViewStore` — arrangement canvas (tool, zoom, scroll, clipboard)

### Arrangement Canvas
3327-line React component (`components/arrangement/ArrangementCanvas.tsx`).  
Renders to `<canvas>` via RAF loop. Waveforms computed from real `Float32Array` peaks via `WaveformCache`. Copy/paste uses `ClipboardEntry` in `useArrangementViewStore`.

## Backend (`backend/`)

### Stack
- **Node.js** ≥22, **Express**, **TypeScript** strict
- **Supabase** (PostgreSQL + auth)
- **Anthropic SDK** (`@anthropic-ai/sdk`) for Claude AI gateway
- **Stripe** + **PayPal** for payments

### Commands
```bash
npm run dev          # ts-node watch
npm run build        # tsc → dist/
npm run test:ci      # TAP output for CI
npx tsc --noEmit     # Typecheck
```

### Environment (copy `backend/.env.example` → `backend/.env`)
Required vars:
```
SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
CLAUDE_API_KEY          # sk-ant-api03-...
JWT_SECRET, JWT_REFRESH_SECRET
ADMIN_JWT_SECRET, ADMIN_KEY
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
NODE_ENV                # development | production | test
```

### Env Validation
`src/utils/validateEnv.ts` runs at startup (skipped in `NODE_ENV=test`). Add any new required env vars there.

## Website (`website/`)

Deployed automatically to Vercel on push to `main` / PR branches.

```bash
npm run dev       # Local dev
npm run build     # Static export → out/
npx tsc --noEmit  # Typecheck
```

## Production Deployment

```bash
# 1. Copy and fill environment file
cp backend/.env.example backend/.env
# edit backend/.env with real values

# 2. Start services
docker compose -f docker-compose.production.yml up -d

# Services: backend (port 8080 internal) + nginx (80/443)
```

SSL certificates go in `infra/ssl/`. nginx config: `infra/nginx/nginx.conf`.

## CI/CD (`.github/workflows/`)

| Workflow | Trigger | What it does |
|---|---|---|
| `ci.yml` | Push to main/claude/**, all PRs | Backend typecheck+tests, website build, desktop typecheck |
| `release-desktop.yml` | Tag `desktop-vX.Y.Z` or manual dispatch | Multi-platform builds (Win/Mac/Linux), code signing, GitHub Release |
| `playwright.yml` | Push/PR | E2E tests (3-platform matrix) |
| `desktop-smoke.yml` | Push/PR | Quick desktop smoke tests |

### Creating a release
```bash
git tag desktop-v0.4.0
git push origin desktop-v0.4.0
# → triggers release-desktop.yml automatically
```

## Testing

### Desktop app tests
```bash
cd desktop-app
npm run test:unit          # src/renderer/src/ unit tests
npm run test:integration   # integration tests
```

Tests use Node.js `node:test` runner with `--experimental-strip-types`.  
No Jest, no Vitest — pure Node test runner.

### E2E tests
```bash
cd e2e
npx playwright test --config=playwright.desktop.config.ts   # Desktop smoke
npx playwright test --config=playwright.config.ts            # Website E2E
```

## Native Audio Engine (`native/audio-engine/`)

Rust binary, built with Cargo. Used for high-performance audio processing.

```bash
cd native/audio-engine
cargo build --release
```

Dependencies: `cpal` (audio I/O), `libloading` (VST3 .so loading), `tokio`, `serde`.

## Security Checklist

- [ ] All secrets via env vars, never in source
- [ ] `backend/.env.example` updated when adding new vars
- [ ] `validateEnv()` updated for new required vars
- [ ] No `console.log` of user data or tokens in production code
- [ ] IPC inputs validated in main process before use
- [ ] Plugin sandbox: one child process per VST3 instance, crash-isolated
- [ ] Auto-blacklist after 3 plugin crashes (`VstCrashGuard.ts`)

## Tech Debt (as of v0.4.0)

See `TECH_DEBT_REPORT.md` for full list. Critical items:
1. VST3 MIDI delivery via `IEventList` not yet wired (TODO in `vst3_host.cc`)
2. VST3 preset browsing needs `IUnitInfo` interface (Steinberg SDK)
3. `native/audio-engine/` Rust binary not yet IPC-connected to desktop-app main process
4. `timestretch` in `AudioEditorEngine` uses linear interpolation stub — WSOLA needed for production
5. Playwright E2E requires manual `SANDBOX_TEST_EMAIL`/`SANDBOX_TEST_PASSWORD` secrets for auth flows
