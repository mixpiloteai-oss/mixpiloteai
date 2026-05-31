// ─── AutomationGenerator.ts ──────────────────────────────────────────────────
// Parameter automation curve generator.

export type AutomationType =
  | 'filter_sweep_up' | 'filter_sweep_down'
  | 'volume_swell_in' | 'volume_swell_out'
  | 'vibrato'
  | 'tremolo'
  | 'pan_lfo'
  | 'reverb_buildup'
  | 'pitch_riser'

export type AutomationShape = 'linear' | 'exponential' | 'sine' | 's_curve' | 'step'

export interface AutomationPoint {
  beat:  number    // beat position (0-based)
  value: number    // normalized 0.0–1.0
}

export interface AutomationCurve {
  type:        AutomationType
  points:      AutomationPoint[]
  bars:        number
  paramLabel:  string
  minValue:    number
  maxValue:    number
}

// ── Shape functions (t = 0 → 1) ──────────────────────────────────────────────

function applyShape(t: number, shape: AutomationShape): number {
  switch (shape) {
    case 'linear':      return t
    case 'exponential': return t * t
    case 'sine':        return Math.sin(t * Math.PI / 2) ** 2
    case 's_curve':     return t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) ** 2
    case 'step':        return Math.round(t * 4) / 4
  }
}

// ── Param metadata ────────────────────────────────────────────────────────────

interface ParamMeta {
  label:    string
  minValue: number
  maxValue: number
}

const PARAM_META: Record<AutomationType, ParamMeta> = {
  filter_sweep_up:   { label: 'Filter Cutoff',   minValue: 20,   maxValue: 20000 },
  filter_sweep_down: { label: 'Filter Cutoff',   minValue: 20,   maxValue: 20000 },
  volume_swell_in:   { label: 'Volume',           minValue: 0,    maxValue: 1 },
  volume_swell_out:  { label: 'Volume',           minValue: 0,    maxValue: 1 },
  vibrato:           { label: 'Pitch Vibrato',    minValue: -50,  maxValue: 50 },
  tremolo:           { label: 'Volume',           minValue: 0,    maxValue: 1 },
  pan_lfo:           { label: 'Pan',              minValue: -1,   maxValue: 1 },
  reverb_buildup:    { label: 'Reverb Send',      minValue: 0,    maxValue: 1 },
  pitch_riser:       { label: 'Pitch Offset',     minValue: 0,    maxValue: 24 },
}

// ── Generator ─────────────────────────────────────────────────────────────────

export function generateAutomation(
  type: AutomationType,
  bars: number,
  shape: AutomationShape,
  _seed: number,
): AutomationCurve {
  const totalBeats = bars * 4
  const numPoints  = bars * 8  // every 0.5 beats
  const meta = PARAM_META[type]
  const points: AutomationPoint[] = []

  for (let i = 0; i < numPoints; i++) {
    const beat = i * 0.5
    const t    = numPoints > 1 ? i / (numPoints - 1) : 0
    let value  = 0

    switch (type) {
      case 'filter_sweep_up':
        value = 0.1 + applyShape(t, shape) * 0.9
        break

      case 'filter_sweep_down':
        value = 1.0 - applyShape(t, shape) * 0.9
        break

      case 'volume_swell_in':
        value = applyShape(t, shape)
        break

      case 'volume_swell_out':
        value = 1.0 - applyShape(t, shape)
        break

      case 'vibrato': {
        // ±0.05 around 0.5, frequency 4Hz relative to beat
        // Use 0.75 cycles per beat so oscillation is visible across 8th-note grid
        const freq = 0.75 // cycles per beat
        value = 0.5 + Math.sin(beat * freq * 2 * Math.PI) * 0.05
        break
      }

      case 'tremolo': {
        // 0.3–0.7, higher frequency than vibrato
        const freq = 1.5 // cycles per beat
        value = 0.5 + Math.sin(beat * freq * 2 * Math.PI) * 0.2
        break
      }

      case 'pan_lfo': {
        // 0→1→0 (left→center→right), slow LFO
        const freq = 0.25 // cycles per beat (slow)
        value = 0.5 + Math.sin(beat * freq * 2 * Math.PI) * 0.5
        break
      }

      case 'reverb_buildup': {
        // rises 0→0.8 then holds
        const rampEnd = 0.75
        value = t < rampEnd
          ? applyShape(t / rampEnd, shape) * 0.8
          : 0.8
        break
      }

      case 'pitch_riser': {
        // exponential rise 0→1
        value = applyShape(t, 'exponential')
        break
      }
    }

    points.push({ beat, value: Math.max(0, Math.min(1, value)) })
  }

  return {
    type,
    points,
    bars,
    paramLabel: meta.label,
    minValue:   meta.minValue,
    maxValue:   meta.maxValue,
  }
}
