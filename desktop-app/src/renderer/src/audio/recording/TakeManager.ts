// ─── TakeManager ──────────────────────────────────────────────────────────────
// Manages recording takes per track. Pure data management, no I/O.

export interface Take {
  id:              string
  trackId:         string
  filePath:        string
  durationSamples: number
  sampleRate:      number
  channelCount:    number
  takeNumber:      number
  createdAt:       number
  label:           string
}

export interface RecordingResult {
  filePath:        string
  durationSamples: number
  sampleRate:      number
  channelCount:    number
  takeNumber:      number
}

export class TakeManager {
  private _takes:       Map<string, Take[]>  = new Map() // trackId → takes[]
  private _activeTakes: Map<string, string>  = new Map() // trackId → takeId
  private _counters:    Map<string, number>  = new Map() // trackId → next take number

  // ── Private helpers ────────────────────────────────────────────────────────

  private _ensureTrack(trackId: string): void {
    if (!this._takes.has(trackId)) {
      this._takes.set(trackId, [])
      this._counters.set(trackId, 1)
    }
  }

  private _generateId(): string {
    // Deterministic-enough unique id without crypto dependency
    return `take-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  addTake(trackId: string, result: RecordingResult): Take {
    this._ensureTrack(trackId)

    const nextNumber = this._counters.get(trackId) ?? 1
    const take: Take = {
      id:              this._generateId(),
      trackId,
      filePath:        result.filePath,
      durationSamples: result.durationSamples,
      sampleRate:      result.sampleRate,
      channelCount:    result.channelCount,
      takeNumber:      nextNumber,
      createdAt:       Date.now(),
      label:           `Take ${nextNumber}`,
    }

    this._takes.get(trackId)!.push(take)
    this._counters.set(trackId, nextNumber + 1)
    this._activeTakes.set(trackId, take.id)

    return take
  }

  getTakes(trackId: string): Take[] {
    return this._takes.get(trackId) ?? []
  }

  getActiveTake(trackId: string): Take | null {
    const activeId = this._activeTakes.get(trackId)
    if (!activeId) return null
    return this.getTakes(trackId).find(t => t.id === activeId) ?? null
  }

  setActiveTake(trackId: string, takeId: string): void {
    const takes = this.getTakes(trackId)
    const exists = takes.some(t => t.id === takeId)
    if (!exists) return
    this._activeTakes.set(trackId, takeId)
  }

  deleteTake(trackId: string, takeId: string): void {
    const takes = this.getTakes(trackId)
    const idx   = takes.findIndex(t => t.id === takeId)
    if (idx === -1) return

    takes.splice(idx, 1)

    // If deleting the active take, set active to the previous take (or null)
    if (this._activeTakes.get(trackId) === takeId) {
      if (takes.length === 0) {
        this._activeTakes.delete(trackId)
      } else {
        // Pick the take before the deleted index, clamped to 0
        const newIdx = Math.max(0, idx - 1)
        this._activeTakes.set(trackId, takes[newIdx].id)
      }
    }
  }

  renameTake(trackId: string, takeId: string, label: string): void {
    const take = this.getTakes(trackId).find(t => t.id === takeId)
    if (!take) return
    take.label = label
  }

  getTakeCount(trackId: string): number {
    return this.getTakes(trackId).length
  }

  clear(trackId: string): void {
    this._takes.delete(trackId)
    this._activeTakes.delete(trackId)
    this._counters.delete(trackId)
  }
}
