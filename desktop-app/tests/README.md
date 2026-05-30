# Neurotek QA Suite

Production-grade automated tests for the Neurotek AI Electron desktop app.
Runs on plain Node 22 — **no extra dev-dependencies** — using the built-in
`node:test` runner and native TypeScript type-stripping
(`--experimental-strip-types`).

## Goals

- **Regression detection** for pure-logic modules (audio math, schema
  validation, music theory, piano-roll math, plugin blacklist, crash logger).
- **Stability** of crash-recovery & plugin-safety subsystems on every commit.
- **Performance gates**: assert that hot paths (WAV encode, schema validate,
  melody gen) stay under fixed time budgets.

## Running

```bash
npm test                # unit + integration
npm run test:unit       # just unit
npm run test:integration
npm run test:perf       # performance gates
npm run test:ci         # TAP reporter (for CI pipelines)
```

## Layout

```
tests/
  setup/
    electron-stub.mjs   module-register hook aliasing `import 'electron'`
    register.mjs        loaded via --import; activates the hook
    fixtures/           JSON fixtures for schema tests
  unit/                 isolated module tests
  integration/          cross-module flows (recovery, blacklist persistence)
  perf/                 performance regression gates
```

## Why `node:test`?

- Zero new packages — fits the project constraint (no jest/vitest/mocha).
- Native to Node 22, very fast startup, stable output, TAP support built in.
- Plays well with ESM and native TS type-stripping.

## The Electron stub

Main-process modules (`pluginBlacklist`, `errorReporter`) `import { app } from
'electron'`. The runtime hook in `setup/electron-stub.mjs` intercepts that
import and substitutes a tiny in-memory stub whose `app.getPath('userData')`
returns a per-pid directory under `os.tmpdir()`. Tests that need to clean
state do so by removing files in that directory **before** importing the SUT
(since the modules load their persisted DB at import time).

## Adding a new test

1. Put the file in the right bucket (`unit/`, `integration/`, `perf/`).
2. Import the SUT directly with a deep path (e.g.
   `../../src/renderer/src/audio/.../X.ts`). Verify it does **not**
   transitively import browser globals (`window`, `document`, `AudioContext`).
3. Use `describe`/`it` from `node:test`, assertions from `node:assert/strict`.
4. For modules that depend on `AudioBuffer`, define a duck-typed `FakeBuffer`
   inline (see `wav-encoder.test.ts`).

## Coverage scope & deliberate omissions

The following user-listed areas are **not** covered by these tests because
they require the live Web Audio / browser environment that Electron supplies
at runtime, and cannot be exercised under plain Node without dragging in a
JSDOM / Playwright stack (forbidden by the no-new-packages constraint):

- Live audio engine playback (`AudioContext`, `AudioWorklet`)
- MIDI device I/O (`navigator.requestMIDIAccess`)
- Timeline + mixer UI behaviors (React + Zustand stores that touch `window`)
- Real-time VST host wiring (native side, requires the packaged binary)
- Offline render via `OfflineAudioContext`

Their **pure-logic substrates** are covered: schema validation, WAV
serialization, dithering / LUFS math, music-theory generators, piano-roll
snap math, plugin blacklist persistence, crash-log rotation, and the
crash-recovery snapshot round-trip.

End-to-end coverage of the omitted areas belongs in a separate Playwright /
Spectron harness, run against a built artifact — out of scope for this
suite.
