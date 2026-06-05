// ─── AutomationCurvePresets.ts ────────────────────────────────────────────────
// Pre-defined automation curve shapes.

import type { AutomationCurveType, AutomationPoint } from './AutomationTypes'

export interface CurvePreset {
  id: string
  name: string
  description: string
  generate(startBeat: number, endBeat: number): AutomationPoint[]
}

function pt(
  beat: number,
  value: number,
  curveType: AutomationCurveType = 'linear',
  inHandle = { dx: -0.2, dy: 0 },
  outHandle = { dx: 0.2, dy: 0 }
): AutomationPoint {
  return { id: `preset_${beat}_${value}`, beat, value, curveType, inHandle, outHandle }
}

export const CURVE_PRESETS: CurvePreset[] = [
  {
    id: 'fade-in',
    name: 'Fade In',
    description: 'Linear fade 0→1',
    generate: (s, e) => [pt(s, 0, 'linear'), pt(e, 1, 'linear')],
  },
  {
    id: 'fade-out',
    name: 'Fade Out',
    description: 'Linear fade 1→0',
    generate: (s, e) => [pt(s, 1, 'linear'), pt(e, 0, 'linear')],
  },
  {
    id: 'exp-fade-in',
    name: 'Exp Fade In',
    description: 'Exponential fade in',
    generate: (s, e) => [pt(s, 0, 'exponential'), pt(e, 1, 'exponential')],
  },
  {
    id: 'exp-fade-out',
    name: 'Exp Fade Out',
    description: 'Exponential fade out',
    generate: (s, e) => [pt(s, 1, 'exponential'), pt(e, 0, 'exponential')],
  },
  {
    id: 'sine-swell',
    name: 'Sine Swell',
    description: 'Sine curve 0→1→0',
    generate: (s, e) => {
      const mid = (s + e) / 2
      return [pt(s, 0, 'sine'), pt(mid, 1, 'sine'), pt(e, 0, 'sine')]
    },
  },
  {
    id: 's-curve',
    name: 'S-Curve',
    description: 'Smooth S-shaped transition',
    generate: (s, e) => [
      pt(s, 0, 'bezier', { dx: -0.2, dy: 0 }, { dx: 0.3, dy: 0.3 }),
      pt(e, 1, 'bezier', { dx: -0.3, dy: -0.3 }, { dx: -0.2, dy: 0 }),
    ],
  },
  {
    id: 'step-hold',
    name: 'Step Hold',
    description: 'Hold at 1 then drop to 0',
    generate: (s, e) => [pt(s, 1, 'step'), pt(e * 0.9, 1, 'step'), pt(e, 0, 'step')],
  },
  {
    id: 'lfo-sine',
    name: 'LFO Sine',
    description: 'One full sine cycle',
    generate: (s, e) => {
      const len = e - s
      return [
        pt(s, 0.5, 'sine'),
        pt(s + len * 0.25, 1, 'sine'),
        pt(s + len * 0.5, 0.5, 'sine'),
        pt(s + len * 0.75, 0, 'sine'),
        pt(e, 0.5, 'sine'),
      ]
    },
  },
]

export function getCurvePreset(id: string): CurvePreset | undefined {
  return CURVE_PRESETS.find((p) => p.id === id)
}
