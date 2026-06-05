# AI MIDI/Audio Generation — Architecture

## Module Diagram (ASCII)

```
┌─────────────────────────────────────────────────────────────────┐
│                        UI Layer                                 │
│  GenerationPanel.tsx ──► MiniPianoRoll.tsx                      │
│          │                                                       │
│          ▼                                                       │
│  useGenerationStore (generationStore.ts)                        │
└─────────────────────────────────────────────┬───────────────────┘
                                              │
                                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              MidiGenerationEngine (orchestrator)                │
│   generate(req) ──dispatch──► DrumPatternLibrary                │
│                            ──► BasslineGenerator                │
│                            ──► MelodyGenerator                  │
│                            ──► AutomationGenerator              │
│   getSuggestions(analysis) ──► GenerationRequest[]             │
└───────────────────────────────┬─────────────────────────────────┘
                                │
            ┌───────────────────┼───────────────────┐
            ▼                   ▼                   ▼
┌───────────────────┐ ┌─────────────────┐ ┌─────────────────────┐
│  MusicTheory.ts   │ │  SeededRng.ts   │ │  PatternVariator.ts │
│  getScaleNotes    │ │  LCG PRNG       │ │  applyVariation     │
│  getChordNotes    │ │  deterministic  │ │  suggestVariations  │
│  getProgression   │ └─────────────────┘ └─────────────────────┘
│  nearestScaleNote │
│  styleToScale     │
└───────────────────┘
            │
            ▼
┌───────────────────────────────────────────────────────────────┐
│                    GenerationHistory                          │
│  push / accept / reject / list / clear / last                │
└───────────────────────────────────────────────────────────────┘
```

## Data Flow

```
GenerationRequest
      │
      ▼
MidiGenerationEngine.generate(req)
      │
      ├─ resolve key (default: C major)
      ├─ resolve seed (Date.now() if omitted)
      │
      ├─ target='drums'       → DrumPatternLibrary.getPattern()
      ├─ target='bassline'    → BasslineGenerator.generateBassline()
      ├─ target='melody'      → MelodyGenerator.generateMelody()
      ├─ target='chords'      → MelodyGenerator.generateMelody() (sparse)
      ├─ target='transition_buildup' → DrumPatternLibrary.getPattern()
      │                              + DrumPatternLibrary.createVariation('fill')
      │                              + AutomationGenerator.generateAutomation('filter_sweep_up')
      ├─ target='transition_drop'    → DrumPatternLibrary.getPattern()
      └─ target='automation'  → AutomationGenerator.generateAutomation()
            │
            ▼
      GenerationResult { pattern, automation, label, warnings }
            │
            ├─ push to GenerationHistory (singleton)
            │
            ▼
      useGenerationStore.generate(req) sets:
        previewPattern | previewAutomation
        history (from generationHistory.list())
        lastRequest
            │
            ▼
      GenerationPanel renders:
        MiniPianoRoll (canvas preview of GeneratedPattern)
        AutomationPreview (SVG line chart)
        Accept / Reject buttons
        History list
```

## Extension Points: Plugging In ML Models

Implement the `IPatternGenerator` interface (conceptual — not yet formalized):

```typescript
interface IPatternGenerator {
  generate(opts: GenerationRequest): Promise<GeneratedPattern>
}
```

Replace or augment `MidiGenerationEngine.generate()`:
1. Add a `cloudMode: boolean` flag to `GenerationRequest`
2. If cloud mode: call IPC `window.api.generatePattern(req)` in the main process
3. Main process delegates to the ML backend (e.g., a Python service via subprocess)
4. Result is returned as a `GeneratedPattern` (same shape)
5. Falls back to local generation if the cloud call fails

The local generators (DrumPatternLibrary, MelodyGenerator, etc.) remain as fallback.

## Seed System — Deterministic Reproducibility

Every generator accepts a `seed: number` parameter and uses `SeededRng(seed)` exclusively.

- **No `Math.random()` anywhere** in the generation pipeline.
- Identical (target, seed, key, style, bars) → identical output, always.
- `midiGenerationEngine.generate({ ..., seed: 42 })` is reproducible across sessions.
- The seed is stored in `GenerationRequest` and echoed in `GenerationResult`.
- UI shows the last seed used so users can reproduce a result.
- `regenerate()` in the store re-runs with `seed: undefined` → new `Date.now()` seed.

## Separation: Local vs Cloud

```
Local (always available, zero latency):
  MusicTheory, SeededRng, DrumPatternLibrary,
  MelodyGenerator, BasslineGenerator, PatternVariator,
  AutomationGenerator, GenerationHistory

Cloud / IPC (optional, future):
  ML-based generation → IPC call to main process
  → main process calls external service
  → returns GeneratedPattern (same shape)
  → graceful fallback to local if unavailable
```

This separation ensures the DAW always works offline with the full local generation suite,
while cloud-enhanced features can be layered on top without breaking any contracts.

## No-Random Guarantee

- All `Math.random()` calls are replaced by `SeededRng.next()`.
- `SeededRng` uses a standard LCG (Knuth constants) operating on 32-bit integer arithmetic.
- `Math.imul` provides correct 32-bit multiply, identical on all platforms.
- The generator state is fully contained in the `SeededRng` instance — no global state.
- Run `grep -r "Math\.random" src/renderer/src/audio/ai/` to verify: 0 matches.
