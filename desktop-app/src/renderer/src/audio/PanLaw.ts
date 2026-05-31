export type PanLawType = 'sine' | 'linear' | 'constant_power'

export interface PanGains { gainL: number; gainR: number }

export function computePanGains(pan: number, law: PanLawType): PanGains {
  const p = Math.max(-1, Math.min(1, pan))
  if (law === 'linear') {
    return { gainL: (1 - p) / 2, gainR: (1 + p) / 2 }
  }
  // sine / constant_power: -3dB center
  const angle = ((p + 1) / 2) * (Math.PI / 2)
  return { gainL: Math.cos(angle), gainR: Math.sin(angle) }
}
