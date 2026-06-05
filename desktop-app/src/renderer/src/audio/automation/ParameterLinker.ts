// ─── ParameterLinker.ts ───────────────────────────────────────────────────────
// Links automation lanes to audio parameter setters.

import type { AutomationEngine } from './AutomationEngine'

export type ParameterSetter = (denormalizedValue: number) => void

class ParameterLinker {
  private _links = new Map<string, ParameterSetter>()

  link(laneId: string, setter: ParameterSetter): () => void {
    this._links.set(laneId, setter)
    return () => this.unlink(laneId)
  }

  unlink(laneId: string): void {
    this._links.delete(laneId)
  }

  isLinked(laneId: string): boolean {
    return this._links.has(laneId)
  }

  applyAll(beat: number, engine: AutomationEngine): void {
    for (const [laneId, setter] of this._links) {
      const lane = engine.getLane(laneId)
      if (!lane || !lane.enabled) continue
      const denorm = engine.evaluateDenormalized(laneId, beat)
      setter(denorm)
    }
  }

  static makeVolumeSetter(setVolume: (v: number) => void): ParameterSetter {
    return (v) => setVolume(v)
  }

  static makePanSetter(setPan: (v: number) => void): ParameterSetter {
    return (v) => setPan(v)
  }
}

export { ParameterLinker }
export const parameterLinker = new ParameterLinker()
