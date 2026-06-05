import type { SerializedRack, RackLayerSnapshot } from './vstTypes'

// ── Instrument Rack ────────────────────────────────────────────────────────────
// Manages layered instrument plugin instances for a track.
// Supports note range and velocity range filtering per layer.

export interface RackLayer {
  layerId: string
  instanceId: string
  pluginId: string
  pluginName: string
  noteRangeLow: number
  noteRangeHigh: number
  velocityLow: number
  velocityHigh: number
  gainDb: number
  active: boolean
}

let layerCounter = 0

export class InstrumentRack {
  private readonly trackId: string
  private layers: RackLayer[] = []

  constructor(trackId: string) {
    this.trackId = trackId
  }

  addLayer(pluginId: string, pluginName: string, instanceId: string): RackLayer {
    const layerId = `layer_${this.trackId}_${++layerCounter}_${Date.now()}`
    const layer: RackLayer = {
      layerId,
      instanceId,
      pluginId,
      pluginName,
      noteRangeLow: 0,
      noteRangeHigh: 127,
      velocityLow: 0,
      velocityHigh: 127,
      gainDb: 0,
      active: true,
    }
    this.layers.push(layer)
    return layer
  }

  removeLayer(layerId: string): void {
    this.layers = this.layers.filter(l => l.layerId !== layerId)
  }

  setLayerNoteRange(layerId: string, low: number, high: number): void {
    const layer = this.layers.find(l => l.layerId === layerId)
    if (layer) {
      layer.noteRangeLow = low
      layer.noteRangeHigh = high
    }
  }

  setLayerVelocityRange(layerId: string, low: number, high: number): void {
    const layer = this.layers.find(l => l.layerId === layerId)
    if (layer) {
      layer.velocityLow = low
      layer.velocityHigh = high
    }
  }

  setLayerGain(layerId: string, gainDb: number): void {
    const layer = this.layers.find(l => l.layerId === layerId)
    if (layer) layer.gainDb = gainDb
  }

  setLayerActive(layerId: string, active: boolean): void {
    const layer = this.layers.find(l => l.layerId === layerId)
    if (layer) layer.active = active
  }

  getActiveLayersForNote(note: number, velocity: number): RackLayer[] {
    return this.layers.filter(l =>
      l.active &&
      note >= l.noteRangeLow &&
      note <= l.noteRangeHigh &&
      velocity >= l.velocityLow &&
      velocity <= l.velocityHigh
    )
  }

  getLayers(): readonly RackLayer[] {
    return this.layers
  }

  serializeState(): SerializedRack {
    return {
      trackId: this.trackId,
      layers: this.layers.map((l): RackLayerSnapshot => ({
        layerId: l.layerId,
        pluginId: l.pluginId,
        noteRangeLow: l.noteRangeLow,
        noteRangeHigh: l.noteRangeHigh,
        velocityLow: l.velocityLow,
        velocityHigh: l.velocityHigh,
        gainDb: l.gainDb,
        active: l.active,
        instanceState: null,
      })),
    }
  }

  restoreState(data: SerializedRack): void {
    this.layers = data.layers.map((snap): RackLayer => ({
      layerId: snap.layerId,
      instanceId: '',
      pluginId: snap.pluginId,
      pluginName: snap.pluginId,  // Name not stored in snapshot
      noteRangeLow: snap.noteRangeLow,
      noteRangeHigh: snap.noteRangeHigh,
      velocityLow: snap.velocityLow,
      velocityHigh: snap.velocityHigh,
      gainDb: snap.gainDb,
      active: snap.active,
    }))
  }
}

export function createInstrumentRack(trackId: string): InstrumentRack {
  return new InstrumentRack(trackId)
}
