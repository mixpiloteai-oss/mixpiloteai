import type { AutomationPoint, SerializedAutomation } from './vstTypes'

// ── VST Parameter Automation Manager ──────────────────────────────────────────
// Manages parameter automation curves for plugin instances in the renderer.

export class VstParameterManager {
  // instances -> paramIndex -> AutomationPoint[]
  private automation: Map<string, Map<number, AutomationPoint[]>> = new Map()

  addAutomation(instanceId: string, paramIndex: number, points: AutomationPoint[]): void {
    if (!this.automation.has(instanceId)) {
      this.automation.set(instanceId, new Map())
    }
    this.automation.get(instanceId)!.set(paramIndex, [...points])
  }

  removeAutomation(instanceId: string, paramIndex: number): void {
    this.automation.get(instanceId)?.delete(paramIndex)
  }

  getValueAtBeat(instanceId: string, paramIndex: number, beat: number): number {
    const params = this.automation.get(instanceId)
    if (!params) return 0.5

    const points = params.get(paramIndex)
    if (!points || points.length === 0) return 0.5

    // Sort points by beatPosition
    const sorted = [...points].sort((a, b) => a.beatPosition - b.beatPosition)

    if (beat <= sorted[0].beatPosition) return sorted[0].value
    if (beat >= sorted[sorted.length - 1].beatPosition) return sorted[sorted.length - 1].value

    // Find surrounding points
    let prevIdx = 0
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].beatPosition >= beat) {
        prevIdx = i - 1
        break
      }
    }

    const p1 = sorted[prevIdx]
    const p2 = sorted[prevIdx + 1]
    const t = (beat - p1.beatPosition) / (p2.beatPosition - p1.beatPosition)

    switch (p1.curve) {
      case 'linear':
        return p1.value + t * (p2.value - p1.value)
      case 'step':
        return p1.value
      case 'exponential': {
        const tExp = Math.pow(t, 2)
        return p1.value + tExp * (p2.value - p1.value)
      }
      default:
        return p1.value + t * (p2.value - p1.value)
    }
  }

  getAutomatedParams(instanceId: string): number[] {
    const params = this.automation.get(instanceId)
    if (!params) return []
    return Array.from(params.keys())
  }

  clearInstanceAutomation(instanceId: string): void {
    this.automation.delete(instanceId)
  }

  serializeAll(): SerializedAutomation {
    const instances: Record<string, Record<number, AutomationPoint[]>> = {}
    for (const [instanceId, params] of this.automation) {
      instances[instanceId] = {}
      for (const [paramIndex, points] of params) {
        instances[instanceId][paramIndex] = [...points]
      }
    }
    return { instances }
  }

  deserializeAll(data: SerializedAutomation): void {
    this.automation = new Map()
    for (const [instanceId, params] of Object.entries(data.instances)) {
      const paramMap = new Map<number, AutomationPoint[]>()
      for (const [paramIndexStr, points] of Object.entries(params)) {
        paramMap.set(Number(paramIndexStr), [...points])
      }
      this.automation.set(instanceId, paramMap)
    }
  }
}

export const vstParameterManager = new VstParameterManager()
